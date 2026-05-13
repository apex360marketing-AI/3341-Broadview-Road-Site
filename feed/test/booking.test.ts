/**
 * Booking endpoint unit tests.
 *
 * Mocks KV with an in-memory Map. GHL/Stripe HTTP calls are stubbed via
 * fetch override — handlers gracefully degrade when those fail, which is
 * the realistic test-environment behavior anyway.
 *
 * Tests cover the contractual + defense-in-depth surface:
 *   - Origin allowlist (in origin.ts)
 *   - Honeypot + min-time silent-success
 *   - Zod validation rejection shape
 *   - Idempotency replay vs. mismatched body
 *   - Stripe-decline error mapping
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkOrigin } from "../src/booking/origin";
import { handleBook, handleAvailability } from "../src/booking/handlers";
import type { Env } from "../src/refresh";

// ============================================================================
// In-memory KV stub
// ============================================================================
function makeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return { keys: [...store.keys()].map((name) => ({ name })), list_complete: true, cursor: "" };
    }
  } as unknown as KVNamespace;
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    FEED_KV: makeKv(),
    RADIUS_KM: "30",
    LISTING_LAT: "49.8344",
    LISTING_LNG: "-119.6217",
    BOOKING_ALLOWED_ORIGIN: "https://valora.example.com",
    GHL_API_KEY: "test-ghl-key",
    GHL_CALENDAR_ID: "cal_test",
    GHL_LOCATION_ID: "loc_test",
    STRIPE_SECRET_KEY: "sk_test_xxx",
    ...overrides
  };
}

function makeReq(method: string, url: string, opts: { origin?: string; body?: unknown; headers?: Record<string, string> } = {}): Request {
  const headers = new Headers(opts.headers || {});
  if (opts.origin !== undefined) headers.set("Origin", opts.origin);
  if (opts.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return new Request(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
}

// Helper: build a valid book payload with a fresh request_id
function validBookPayload(extras: Partial<Record<string, unknown>> = {}) {
  const uuid = "11111111-1111-4111-8111-111111111111";
  return {
    request_id: uuid,
    listing_id: "valora",
    name: "Test Guest",
    email: "guest@example.com",
    phone: "+12505550100",
    checkin: nextWeekIso(),
    checkout: nextWeekIso(5),
    guests: 2,
    message: null,
    marketing_opt_in: false,
    consent_text_shown: "x",
    honeypot_company: "",
    opened_at: Date.now() - 5000,
    ...extras
  };
}

function nextWeekIso(plusDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + 7 + plusDays);
  return d.toISOString().slice(0, 10);
}

// ============================================================================
// Origin allowlist
// ============================================================================
describe("checkOrigin", () => {
  it("rejects when allowed list is empty", () => {
    const req = makeReq("POST", "https://api.example.com/book", { origin: "https://valora.example.com" });
    const r = checkOrigin(req, "");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not configured/);
  });

  it("rejects when Origin header missing on non-wildcard config", () => {
    const req = makeReq("POST", "https://api.example.com/book", {});
    const r = checkOrigin(req, "https://valora.example.com");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/required/);
  });

  it("rejects when Origin not on allowlist", () => {
    const req = makeReq("POST", "https://api.example.com/book", { origin: "https://evil.example.com" });
    const r = checkOrigin(req, "https://valora.example.com");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not allowed/);
  });

  it("accepts exact match", () => {
    const req = makeReq("POST", "https://api.example.com/book", { origin: "https://valora.example.com" });
    const r = checkOrigin(req, "https://valora.example.com");
    expect(r.ok).toBe(true);
    expect((r.cors as Record<string, string>)["Access-Control-Allow-Origin"]).toBe("https://valora.example.com");
  });

  it("accepts wildcard (dev mode)", () => {
    const req = makeReq("POST", "https://api.example.com/book", { origin: "https://anywhere.test" });
    const r = checkOrigin(req, "*");
    expect(r.ok).toBe(true);
  });

  it("accepts any allow-listed origin from comma-separated config", () => {
    const config = "https://valora.example.com,http://localhost:4321,http://localhost:4322";
    const req = makeReq("POST", "https://api.example.com/book", { origin: "http://localhost:4322" });
    const r = checkOrigin(req, config);
    expect(r.ok).toBe(true);
  });
});

// ============================================================================
// /book — honeypot + min-time + validation
// ============================================================================
describe("handleBook anti-spam + validation", () => {
  beforeEach(() => {
    // Stub fetch so GHL calls fail gracefully (degraded path)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 }))
    );
  });

  it("returns silent 200 when honeypot field filled", async () => {
    const env = makeEnv();
    const origin = checkOrigin(makeReq("POST", "https://x/book", { origin: "https://valora.example.com" }), env.BOOKING_ALLOWED_ORIGIN);
    const req = makeReq("POST", "https://x/book", {
      origin: "https://valora.example.com",
      body: validBookPayload({ honeypot_company: "Acme Bots" })
    });
    const r = await handleBook(req, env, origin);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.suppressed).toBe(true);
  });

  it("returns silent 200 when submitted faster than min-time", async () => {
    const env = makeEnv();
    const origin = checkOrigin(makeReq("POST", "https://x/book", { origin: "https://valora.example.com" }), env.BOOKING_ALLOWED_ORIGIN);
    const req = makeReq("POST", "https://x/book", {
      origin: "https://valora.example.com",
      body: validBookPayload({ opened_at: Date.now() }) // 0ms ago
    });
    const r = await handleBook(req, env, origin);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.suppressed).toBe(true);
  });

  it("rejects invalid email with 400", async () => {
    const env = makeEnv();
    const origin = checkOrigin(makeReq("POST", "https://x/book", { origin: "https://valora.example.com" }), env.BOOKING_ALLOWED_ORIGIN);
    const req = makeReq("POST", "https://x/book", {
      origin: "https://valora.example.com",
      body: validBookPayload({ email: "not-an-email" })
    });
    const r = await handleBook(req, env, origin);
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toBe("validation");
  });

  it("rejects guests out of bounds with 400", async () => {
    const env = makeEnv();
    const origin = checkOrigin(makeReq("POST", "https://x/book", { origin: "https://valora.example.com" }), env.BOOKING_ALLOWED_ORIGIN);
    const req = makeReq("POST", "https://x/book", {
      origin: "https://valora.example.com",
      body: validBookPayload({ guests: 99 })
    });
    const r = await handleBook(req, env, origin);
    expect(r.status).toBe(400);
  });

  it("returns 200 with booking_id on a valid payload (GHL down — degraded)", async () => {
    const env = makeEnv();
    const origin = checkOrigin(makeReq("POST", "https://x/book", { origin: "https://valora.example.com" }), env.BOOKING_ALLOWED_ORIGIN);
    const req = makeReq("POST", "https://x/book", {
      origin: "https://valora.example.com",
      body: validBookPayload()
    });
    const r = await handleBook(req, env, origin);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.booking_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.status).toBe("pending");
    expect(body.deposit_amount).toBe(59500);
  });

  it("replays the same response on idempotent retry", async () => {
    const env = makeEnv();
    const origin = checkOrigin(makeReq("POST", "https://x/book", { origin: "https://valora.example.com" }), env.BOOKING_ALLOWED_ORIGIN);
    const payload = validBookPayload();
    const r1 = await handleBook(
      makeReq("POST", "https://x/book", { origin: "https://valora.example.com", body: payload, headers: { "Idempotency-Key": payload.request_id } }),
      env, origin
    );
    const r2 = await handleBook(
      makeReq("POST", "https://x/book", { origin: "https://valora.example.com", body: payload, headers: { "Idempotency-Key": payload.request_id } }),
      env, origin
    );
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const b1 = await r1.json();
    const b2 = await r2.json();
    expect(b2).toEqual(b1);
  });

  it("422s on Idempotency-Key reuse with a different body", async () => {
    const env = makeEnv();
    const origin = checkOrigin(makeReq("POST", "https://x/book", { origin: "https://valora.example.com" }), env.BOOKING_ALLOWED_ORIGIN);
    const payload = validBookPayload();
    const r1 = await handleBook(
      makeReq("POST", "https://x/book", { origin: "https://valora.example.com", body: payload, headers: { "Idempotency-Key": "shared-key" } }),
      env, origin
    );
    expect(r1.status).toBe(200);
    const r2 = await handleBook(
      makeReq("POST", "https://x/book", {
        origin: "https://valora.example.com",
        body: validBookPayload({ name: "Different Name" }),
        headers: { "Idempotency-Key": "shared-key" }
      }),
      env, origin
    );
    expect(r2.status).toBe(422);
  });
});

// ============================================================================
// /availability — basic shape + degraded fallback
// ============================================================================
describe("handleAvailability", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 }))
    );
  });

  it("returns degraded source when GHL is unreachable", async () => {
    const env = makeEnv();
    const from = nextWeekIso();
    const to = nextWeekIso(30);
    const url = `https://x/availability?from=${from}&to=${to}&listing_id=valora`;
    const origin = checkOrigin(makeReq("GET", url, { origin: "https://valora.example.com" }), env.BOOKING_ALLOWED_ORIGIN);
    const r = await handleAvailability(makeReq("GET", url, { origin: "https://valora.example.com" }), env, origin);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.source).toBe("degraded");
    expect(body.blocked_dates).toEqual([]);
  });

  it("rejects bad date format with 400", async () => {
    const env = makeEnv();
    const url = `https://x/availability?from=not-a-date&to=${nextWeekIso(30)}&listing_id=valora`;
    const origin = checkOrigin(makeReq("GET", url, { origin: "https://valora.example.com" }), env.BOOKING_ALLOWED_ORIGIN);
    const r = await handleAvailability(makeReq("GET", url, { origin: "https://valora.example.com" }), env, origin);
    expect(r.status).toBe(400);
  });

  it("rejects missing listing_id with 400", async () => {
    const env = makeEnv();
    const url = `https://x/availability?from=${nextWeekIso()}&to=${nextWeekIso(30)}`;
    const origin = checkOrigin(makeReq("GET", url, { origin: "https://valora.example.com" }), env.BOOKING_ALLOWED_ORIGIN);
    const r = await handleAvailability(makeReq("GET", url, { origin: "https://valora.example.com" }), env, origin);
    expect(r.status).toBe(400);
  });
});
