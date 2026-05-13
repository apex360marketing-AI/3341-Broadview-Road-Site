/**
 * Booking endpoint handlers.
 *
 * Wires together schema validation, Origin allowlist, KV storage, GHL
 * Calendar API, and Stripe — without leaking PII to logs. Every handler
 * returns a Response with appropriate CORS headers.
 *
 * Defense-in-depth pattern per endpoint:
 *   1. Origin allowlist (origin.ts) — short-circuit 403 on mismatch
 *   2. Method check
 *   3. Body parse + Zod validation
 *   4. Honeypot + min-time-to-submit silent-success (where applicable)
 *   5. Per-IP rate limit (booking has its own key prefix)
 *   6. Idempotency / state checks
 *   7. Side effects (GHL, Stripe)
 *   8. Persist + respond
 */
import type { Env } from "../refresh";
import type { OriginCheckResult } from "./origin";
import {
  BookRequestSchema,
  SecureRequestSchema,
  diffDays,
  isValidDateRange,
  type BookRequest
} from "./schema";
import type {
  BookingRecord,
  AvailabilityCachePayload,
  IdempotencyRecord
} from "./types";
import {
  getBooking,
  putBooking,
  getAvailability,
  putAvailability,
  getIdempotency,
  putIdempotency,
  hashBody
} from "./store";
import { getCalendarBlockedDates, createAppointment } from "./ghl";
import { createAuthHold, StripeError } from "./stripe";

const MIN_NIGHTS_DEFAULT = 2;          // matches tokens.MIN_NIGHTS (Valora default)
const MAX_DAYS_RANGE = 90;             // sanity cap for /availability + /book
const RATE_LIMIT_BOOK = 3;             // /book per IP / hr
const RATE_LIMIT_SECURE = 10;          // /secure per IP / hr
const RATE_LIMIT_AVAIL = 30;           // /availability per IP / hr
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MIN_TIME_TO_SUBMIT_MS = 3000;

function clientIp(req: Request): string {
  return (
    req.headers.get("CF-Connecting-IP") ??
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

async function bookingRateLimit(
  kv: KVNamespace,
  scope: "book" | "secure" | "avail",
  ip: string,
  limit: number
): Promise<{ allowed: boolean; retryAfter: number }> {
  const key = `ratelimit:${scope}:${ip}`;
  const now = Date.now();
  const raw = await kv.get(key);
  let record: { count: number; windowStartMs: number };
  if (raw) {
    try {
      record = JSON.parse(raw);
    } catch {
      record = { count: 0, windowStartMs: now };
    }
  } else {
    record = { count: 0, windowStartMs: now };
  }
  if (now - record.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
    record = { count: 0, windowStartMs: now };
  }
  record.count += 1;
  const ttl = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.windowStartMs)) / 1000));
  await kv.put(key, JSON.stringify(record), { expirationTtl: ttl + 5 });
  if (record.count > limit) {
    return { allowed: false, retryAfter: ttl };
  }
  return { allowed: true, retryAfter: 0 };
}

function jsonResponse(body: unknown, status: number, cors: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

// ============================================================================
// GET /availability?from=YYYY-MM-DD&to=YYYY-MM-DD&listing_id=...
// ============================================================================
export async function handleAvailability(
  req: Request,
  env: Env,
  origin: OriginCheckResult
): Promise<Response> {
  const ip = clientIp(req);
  const rl = await bookingRateLimit(env.FEED_KV, "avail", ip, RATE_LIMIT_AVAIL);
  if (!rl.allowed) {
    return jsonResponse({ error: "rate_limited", retryAfterSeconds: rl.retryAfter }, 429, {
      ...origin.cors,
      "Retry-After": String(rl.retryAfter)
    });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const listingId = url.searchParams.get("listing_id") || "";

  if (!listingId || !from || !to) {
    return jsonResponse({ error: "missing_params", required: ["from", "to", "listing_id"] }, 400, origin.cors);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return jsonResponse({ error: "bad_date_format" }, 400, origin.cors);
  }
  const span = diffDays(from, to);
  if (span <= 0 || span > MAX_DAYS_RANGE) {
    return jsonResponse({ error: "bad_range", maxDays: MAX_DAYS_RANGE }, 400, origin.cors);
  }

  // Cache key keyed by YYYY-MM (the first month of the range — good enough
  // for our 5-min TTL since most clients fetch a single 90-day window).
  const ymKey = from.slice(0, 7);
  const cached = await getAvailability(env.FEED_KV, listingId, ymKey);
  if (cached && cached.from === from && cached.to === to) {
    return jsonResponse({ ...cached, source: "cache" }, 200, origin.cors);
  }

  let blocked: string[] = [];
  let source: AvailabilityCachePayload["source"] = "ghl";
  try {
    blocked = await getCalendarBlockedDates(env, from, to);
  } catch (err) {
    console.warn("[availability] GHL fetch failed", String(err));
    // Degraded — allow all dates, host will confirm manually
    blocked = [];
    source = "degraded";
  }

  const payload: AvailabilityCachePayload = {
    listing_id: listingId,
    from,
    to,
    blocked_dates: blocked,
    min_nights: MIN_NIGHTS_DEFAULT,
    source,
    cached_at: new Date().toISOString()
  };

  if (source === "ghl") {
    await putAvailability(env.FEED_KV, listingId, ymKey, payload);
  }
  return jsonResponse(payload, 200, origin.cors);
}

// ============================================================================
// POST /book
// ============================================================================
export async function handleBook(
  req: Request,
  env: Env,
  origin: OriginCheckResult
): Promise<Response> {
  const ip = clientIp(req);
  const rl = await bookingRateLimit(env.FEED_KV, "book", ip, RATE_LIMIT_BOOK);
  if (!rl.allowed) {
    return jsonResponse({ error: "rate_limited", retryAfterSeconds: rl.retryAfter }, 429, {
      ...origin.cors,
      "Retry-After": String(rl.retryAfter)
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "bad_json" }, 400, origin.cors);
  }
  const parsed = BookRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "validation", issues: parsed.error.flatten() }, 400, origin.cors);
  }
  const data: BookRequest = parsed.data;

  // Honeypot — silent fake-success
  if (data.honeypot_company !== "") {
    return jsonResponse({ booking_id: data.request_id, status: "pending", suppressed: true }, 200, origin.cors);
  }
  // Min-time anti-spam — same silent fake-success
  if (Date.now() - data.opened_at < MIN_TIME_TO_SUBMIT_MS) {
    return jsonResponse({ booking_id: data.request_id, status: "pending", suppressed: true }, 200, origin.cors);
  }

  // Idempotency-Key support (defaults to request_id if header missing)
  const idemKey = req.headers.get("Idempotency-Key") || data.request_id;
  const bodyHash = await hashBody(data);
  const existing = await getIdempotency(env.FEED_KV, idemKey);
  if (existing) {
    if (existing.body_hash !== bodyHash) {
      return jsonResponse({ error: "idempotency_key_reuse_with_different_body" }, 422, origin.cors);
    }
    return jsonResponse(existing.response, 200, origin.cors);
  }

  // Date validation
  const dateCheck = isValidDateRange(data.checkin, data.checkout, MIN_NIGHTS_DEFAULT, MAX_DAYS_RANGE);
  if (!dateCheck.ok) {
    return jsonResponse({ error: "bad_dates", reason: dateCheck.reason }, 400, origin.cors);
  }

  // Re-check availability (defense in depth — the date picker enforces it
  // but a bot could POST anything)
  let blocked: string[] = [];
  try {
    blocked = await getCalendarBlockedDates(env, data.checkin, data.checkout);
  } catch {
    // GHL unreachable — proceed; host will validate manually
  }
  if (blocked.length > 0) {
    return jsonResponse({ error: "dates_unavailable", blocked_dates: blocked }, 409, origin.cors);
  }

  const nights = diffDays(data.checkin, data.checkout);
  const nowIso = new Date().toISOString();
  const oneHourLater = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const depositCents = 59500;          // $595.00 CAD — matches tokens.DEPOSIT_AMOUNT_CAD

  const record: BookingRecord = {
    booking_id: data.request_id,
    status: "pending",
    listing_id: data.listing_id,
    listing_name: "VALORA",            // operator may templatize later via env
    name: data.name,
    email: data.email,
    phone: data.phone,
    checkin: data.checkin,
    checkout: data.checkout,
    guests: data.guests,
    nights,
    message: data.message,
    deposit_amount: depositCents,
    currency: "CAD",
    payment_intent_id: null,
    hold_expires_at: null,
    secured_at: null,
    marketing_opt_in: data.marketing_opt_in,
    consent_text_shown: data.consent_text_shown,
    ghl_contact_id: null,
    ghl_appointment_id: null,
    created_at: nowIso,
    expires_at: oneHourLater
  };

  // Try to write the GHL appointment. If GHL is unreachable, still persist
  // the booking — the operator can reconcile manually. Mark ghl_* null.
  try {
    const ghl = await createAppointment(env, record);
    record.ghl_contact_id = ghl.ghl_contact_id;
    record.ghl_appointment_id = ghl.ghl_appointment_id;
  } catch (err) {
    console.warn("[book] GHL createAppointment failed — continuing", String(err));
  }

  await putBooking(env.FEED_KV, record);

  const response = {
    booking_id: record.booking_id,
    status: record.status,
    deposit_amount: record.deposit_amount,
    currency: record.currency,
    checkin: record.checkin,
    checkout: record.checkout,
    nights: record.nights,
    expires_at: record.expires_at
  };

  const idem: IdempotencyRecord = {
    key: idemKey,
    body_hash: bodyHash,
    response,
    created_at: nowIso
  };
  await putIdempotency(env.FEED_KV, idem);

  return jsonResponse(response, 200, origin.cors);
}

// ============================================================================
// GET /booking/:id
// ============================================================================
export async function handleGetBooking(
  _req: Request,
  env: Env,
  origin: OriginCheckResult,
  bookingId: string
): Promise<Response> {
  const record = await getBooking(env.FEED_KV, bookingId);
  if (!record) {
    return jsonResponse({ error: "not_found" }, 404, origin.cors);
  }
  // Auto-expire pending bookings that drifted past their expires_at
  if (record.status === "pending" && Date.parse(record.expires_at) < Date.now()) {
    return jsonResponse({ error: "expired", booking_id: bookingId }, 410, origin.cors);
  }
  return jsonResponse(
    {
      booking_id: record.booking_id,
      status: record.status,
      listing_name: record.listing_name,
      host_first_name: "Shyla",         // matches tokens.HOST_FIRST_NAME
      checkin: record.checkin,
      checkout: record.checkout,
      guests: record.guests,
      nights: record.nights,
      deposit_amount: record.deposit_amount,
      currency: record.currency,
      hold_expires_at: record.hold_expires_at,
      secured_at: record.secured_at
    },
    200,
    origin.cors
  );
}

// ============================================================================
// POST /booking/:id/secure
// ============================================================================
export async function handleSecure(
  req: Request,
  env: Env,
  origin: OriginCheckResult,
  bookingId: string
): Promise<Response> {
  const ip = clientIp(req);
  const rl = await bookingRateLimit(env.FEED_KV, "secure", ip, RATE_LIMIT_SECURE);
  if (!rl.allowed) {
    return jsonResponse({ error: "rate_limited", retryAfterSeconds: rl.retryAfter }, 429, {
      ...origin.cors,
      "Retry-After": String(rl.retryAfter)
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "bad_json" }, 400, origin.cors);
  }
  const parsed = SecureRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "validation", issues: parsed.error.flatten() }, 400, origin.cors);
  }
  const data = parsed.data;

  // Anti-spam — silent fake-success
  if (data.honeypot_company !== "") {
    return jsonResponse({ booking_id: bookingId, status: "secured", suppressed: true }, 200, origin.cors);
  }
  if (Date.now() - data.opened_at < MIN_TIME_TO_SUBMIT_MS) {
    return jsonResponse({ booking_id: bookingId, status: "secured", suppressed: true }, 200, origin.cors);
  }

  const record = await getBooking(env.FEED_KV, bookingId);
  if (!record) return jsonResponse({ error: "not_found" }, 404, origin.cors);
  if (record.status === "expired") return jsonResponse({ error: "expired" }, 410, origin.cors);

  // Idempotent — already secured? Return existing record
  if (record.status === "secured") {
    return jsonResponse(
      {
        booking_id: record.booking_id,
        status: "secured",
        hold_expires_at: record.hold_expires_at,
        hold_amount: record.deposit_amount,
        currency: record.currency
      },
      200,
      origin.cors
    );
  }

  // Pending expired by clock? bail
  if (Date.parse(record.expires_at) < Date.now()) {
    return jsonResponse({ error: "expired" }, 410, origin.cors);
  }

  // Create the Stripe auth-hold
  let pi;
  try {
    pi = await createAuthHold(env, {
      booking_id: bookingId,
      amount: record.deposit_amount,
      currency: record.currency,
      payment_method_id: data.payment_method_id,
      customer_email: record.email,
      description: `Booking hold ${bookingId} — ${record.checkin} → ${record.checkout}`
    });
  } catch (err) {
    if (err instanceof StripeError) {
      return jsonResponse({ error: "card_declined", code: err.code, message: err.message }, 402, origin.cors);
    }
    console.error("[secure] stripe unexpected", String(err));
    return jsonResponse({ error: "payment_processor_unavailable", retry_able: true }, 502, origin.cors);
  }

  record.status = "secured";
  record.payment_intent_id = pi.id;
  record.hold_expires_at = pi.hold_expires_at;
  record.secured_at = new Date().toISOString();
  await putBooking(env.FEED_KV, record);

  return jsonResponse(
    {
      booking_id: record.booking_id,
      status: "secured",
      hold_expires_at: record.hold_expires_at,
      hold_amount: record.deposit_amount,
      currency: record.currency
    },
    200,
    origin.cors
  );
}
