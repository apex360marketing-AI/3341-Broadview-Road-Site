/**
 * Read-only handlers for Phase 1.
 *
 *   POST /auth              — verify X-Admin-Key only; no body
 *   GET  /bookings          — list (optional ?status=)
 *   GET  /bookings/:id      — single record
 *
 * Every handler enforces:
 *   1. Origin allowlist (caller already short-circuits in index.ts)
 *   2. Per-IP rate limit (auth tight, reads generous)
 *   3. Constant-time admin-key compare
 *
 * NO mutations — Phase 2 will add confirm/decline in a separate file.
 */
import type { Env, BookingRecord, BookingSummary, BookingStatus } from "./types";
import { toSummary } from "./types";
import type { OriginCheckResult } from "./origin";
import { checkAdminKey } from "./auth";
import { checkRateLimit, clientIp } from "./ratelimit";

const RATE_LIMIT_AUTH = 8;        // POST /auth per IP / hr — brute-force gate
const RATE_LIMIT_READ = 120;      // /bookings reads per IP / hr
const MAX_LIST = 100;

function jsonResponse(body: unknown, status: number, cors: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function unauthorized(cors: HeadersInit): Response {
  return jsonResponse({ error: "unauthorized" }, 401, cors);
}

// ============================================================================
// POST /auth — verifies the X-Admin-Key header and returns 204 on success.
// ============================================================================
export async function handleAuth(
  req: Request,
  env: Env,
  origin: OriginCheckResult
): Promise<Response> {
  const ip = clientIp(req);
  const rl = await checkRateLimit(env.FEED_KV, "auth", ip, RATE_LIMIT_AUTH);
  if (!rl.allowed) {
    return jsonResponse({ error: "rate_limited", retryAfterSeconds: rl.retryAfterSeconds }, 429, {
      ...origin.cors,
      "Retry-After": String(rl.retryAfterSeconds)
    });
  }
  if (!checkAdminKey(req.headers.get("X-Admin-Key"), env.ADMIN_KEY)) {
    return unauthorized(origin.cors);
  }
  return new Response(null, { status: 204, headers: origin.cors });
}

// ============================================================================
// GET /bookings  (optional ?status=pending|secured|expired)
// ============================================================================
export async function handleListBookings(
  req: Request,
  env: Env,
  origin: OriginCheckResult
): Promise<Response> {
  const ip = clientIp(req);
  const rl = await checkRateLimit(env.FEED_KV, "read", ip, RATE_LIMIT_READ);
  if (!rl.allowed) {
    return jsonResponse({ error: "rate_limited", retryAfterSeconds: rl.retryAfterSeconds }, 429, {
      ...origin.cors,
      "Retry-After": String(rl.retryAfterSeconds)
    });
  }
  if (!checkAdminKey(req.headers.get("X-Admin-Key"), env.ADMIN_KEY)) {
    return unauthorized(origin.cors);
  }

  const url = new URL(req.url);
  const filter = url.searchParams.get("status");
  const statusFilter: BookingStatus | null =
    filter === "pending" || filter === "secured" || filter === "expired" ? filter : null;

  // KV list — cap by MAX_LIST; one property + low volume makes this safe.
  // If we ever hit the cap we surface `truncated: true` so the client
  // can show a "showing 100 of N" hint.
  const listed = await env.FEED_KV.list({ prefix: "booking:", limit: MAX_LIST + 1 });
  const truncated = listed.keys.length > MAX_LIST;
  const slice = truncated ? listed.keys.slice(0, MAX_LIST) : listed.keys;

  // Fan-out reads. Promise.all is fine for ≤100 KV gets on a single Worker
  // invocation — empirically ~30–80ms total. Sequential would be too slow.
  const records = await Promise.all(
    slice.map(async (k) => {
      const raw = await env.FEED_KV.get(k.name);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as BookingRecord;
      } catch {
        return null;
      }
    })
  );

  let bookings: BookingSummary[] = records
    .filter((r): r is BookingRecord => r !== null)
    .map(toSummary);

  if (statusFilter) {
    bookings = bookings.filter((b) => b.status === statusFilter);
  }

  // Newest first by created_at (lexicographic on ISO timestamps works).
  bookings.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return jsonResponse({ bookings, truncated }, 200, origin.cors);
}

// ============================================================================
// GET /bookings/:id
// ============================================================================
export async function handleGetBooking(
  req: Request,
  env: Env,
  origin: OriginCheckResult,
  bookingId: string
): Promise<Response> {
  const ip = clientIp(req);
  const rl = await checkRateLimit(env.FEED_KV, "read", ip, RATE_LIMIT_READ);
  if (!rl.allowed) {
    return jsonResponse({ error: "rate_limited", retryAfterSeconds: rl.retryAfterSeconds }, 429, {
      ...origin.cors,
      "Retry-After": String(rl.retryAfterSeconds)
    });
  }
  if (!checkAdminKey(req.headers.get("X-Admin-Key"), env.ADMIN_KEY)) {
    return unauthorized(origin.cors);
  }

  const raw = await env.FEED_KV.get(`booking:${bookingId}`);
  if (!raw) return jsonResponse({ error: "not_found" }, 404, origin.cors);
  let record: BookingRecord;
  try {
    record = JSON.parse(raw) as BookingRecord;
  } catch {
    return jsonResponse({ error: "corrupt_record" }, 500, origin.cors);
  }

  // Return the full record — the dashboard's detail view shows everything
  // including consent + GHL audit fields. Phase 2 actions will operate on
  // this same shape.
  return jsonResponse(record, 200, origin.cors);
}
