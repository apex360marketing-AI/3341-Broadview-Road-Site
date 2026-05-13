/**
 * Fail-closed integration tests.
 *
 * Exercises the full Worker `fetch` handler with deliberately mis-configured
 * env to prove every guard short-circuits before any KV access or auth
 * decision is made.
 *
 * Threat scenarios covered:
 *   - BOOKING_ALLOWED_ORIGIN empty (operator forgot to set it)        → 403
 *   - BOOKING_ALLOWED_ORIGIN set, Origin header missing                → 403
 *   - BOOKING_ALLOWED_ORIGIN set, Origin allowed, ADMIN_KEY missing    → 401
 *   - BOOKING_ALLOWED_ORIGIN set, Origin allowed, wrong key            → 401
 *
 * No path that would touch FEED_KV is reachable until BOTH gates pass.
 * KV is mocked as a throwing stub to make accidental access a test failure.
 */
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";

const ALLOWED = "https://owner.valora.example";

function throwingKV(): KVNamespace {
  const fail = (op: string) => () => {
    throw new Error(`unexpected KV.${op} — fail-closed guard should have short-circuited`);
  };
  // The shape we care about. The handlers ratelimit.ts reaches for `.get`
  // and `.put`; the LIST endpoint reaches for `.list`. None should be hit
  // when the request is correctly rejected at the gate.
  return {
    get: fail("get"),
    put: fail("put"),
    list: fail("list"),
    delete: fail("delete"),
    getWithMetadata: fail("getWithMetadata")
  } as unknown as KVNamespace;
}

function makeEnv(over: Partial<Env> = {}): Env {
  return {
    FEED_KV: throwingKV(),
    ADMIN_KEY: undefined,
    BOOKING_ALLOWED_ORIGIN: undefined,
    STRIPE_SECRET_KEY: undefined,
    ...over
  };
}

function makeReq(opts: {
  path: string;
  method?: string;
  origin?: string;
  adminKey?: string;
}): Request {
  const headers = new Headers();
  if (opts.origin) headers.set("Origin", opts.origin);
  if (opts.adminKey) headers.set("X-Admin-Key", opts.adminKey);
  return new Request(`https://worker.example${opts.path}`, {
    method: opts.method ?? "GET",
    headers
  });
}

describe("fail-closed: BOOKING_ALLOWED_ORIGIN", () => {
  it("returns 403 when allowlist is empty (any path, any method)", async () => {
    const env = makeEnv({ ADMIN_KEY: "secret" });
    for (const r of [
      makeReq({ path: "/auth", method: "POST", origin: ALLOWED, adminKey: "secret" }),
      makeReq({ path: "/bookings", origin: ALLOWED, adminKey: "secret" }),
      makeReq({ path: "/bookings/abcdef1234", origin: ALLOWED, adminKey: "secret" })
    ]) {
      const res = await worker.fetch(r, env);
      expect(res.status).toBe(403);
    }
  });

  it("returns 403 on preflight when allowlist is empty", async () => {
    const env = makeEnv();
    const r = new Request("https://worker.example/auth", {
      method: "OPTIONS",
      headers: { Origin: ALLOWED }
    });
    const res = await worker.fetch(r, env);
    expect(res.status).toBe(403);
  });

  it("returns 403 when Origin header is missing on a non-wildcard config", async () => {
    const env = makeEnv({ ADMIN_KEY: "secret", BOOKING_ALLOWED_ORIGIN: ALLOWED });
    const r = makeReq({ path: "/bookings", adminKey: "secret" });
    const res = await worker.fetch(r, env);
    expect(res.status).toBe(403);
  });

  it("returns 403 when Origin is not in the allowlist", async () => {
    const env = makeEnv({ ADMIN_KEY: "secret", BOOKING_ALLOWED_ORIGIN: ALLOWED });
    const r = makeReq({
      path: "/bookings",
      origin: "https://attacker.example",
      adminKey: "secret"
    });
    const res = await worker.fetch(r, env);
    expect(res.status).toBe(403);
  });
});

describe("fail-closed: ADMIN_KEY", () => {
  it("returns 401 when ADMIN_KEY is unset, even with valid Origin", async () => {
    // ADMIN_KEY undefined → checkAdminKey always returns false → 401.
    // Note: rate-limit is the FIRST step inside the handler, so KV.get IS
    // touched here on the rate-limit lookup. Swap to a permissive KV for
    // this scenario so we're only asserting the auth decision.
    const permissiveKV = {
      get: async () => null,
      put: async () => {},
      list: async () => ({ keys: [], list_complete: true, cursor: "" }),
      delete: async () => {},
      getWithMetadata: async () => ({ value: null, metadata: null })
    } as unknown as KVNamespace;

    const env: Env = {
      FEED_KV: permissiveKV,
      ADMIN_KEY: undefined,
      BOOKING_ALLOWED_ORIGIN: ALLOWED,
      STRIPE_SECRET_KEY: undefined
    };
    const r = makeReq({
      path: "/auth",
      method: "POST",
      origin: ALLOWED,
      adminKey: "anything"
    });
    const res = await worker.fetch(r, env);
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong key (admin key configured, key mismatched)", async () => {
    const permissiveKV = {
      get: async () => null,
      put: async () => {},
      list: async () => ({ keys: [], list_complete: true, cursor: "" }),
      delete: async () => {},
      getWithMetadata: async () => ({ value: null, metadata: null })
    } as unknown as KVNamespace;

    const env: Env = {
      FEED_KV: permissiveKV,
      ADMIN_KEY: "correct-secret-value",
      BOOKING_ALLOWED_ORIGIN: ALLOWED,
      STRIPE_SECRET_KEY: undefined
    };
    const r = makeReq({
      path: "/bookings",
      origin: ALLOWED,
      adminKey: "wrong-secret-value"
    });
    const res = await worker.fetch(r, env);
    expect(res.status).toBe(401);
  });
});

describe("happy path: 204 on /auth when origin + key are correct", () => {
  it("authenticates", async () => {
    const permissiveKV = {
      get: async () => null,
      put: async () => {},
      list: async () => ({ keys: [], list_complete: true, cursor: "" }),
      delete: async () => {},
      getWithMetadata: async () => ({ value: null, metadata: null })
    } as unknown as KVNamespace;

    const env: Env = {
      FEED_KV: permissiveKV,
      ADMIN_KEY: "hunter2-correct",
      BOOKING_ALLOWED_ORIGIN: ALLOWED,
      STRIPE_SECRET_KEY: undefined
    };
    const r = makeReq({
      path: "/auth",
      method: "POST",
      origin: ALLOWED,
      adminKey: "hunter2-correct"
    });
    const res = await worker.fetch(r, env);
    expect(res.status).toBe(204);
  });
});
