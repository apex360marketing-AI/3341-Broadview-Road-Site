/**
 * Origin allowlist — mirrors ../../feed/src/booking/origin.ts.
 *
 * Static-site bundles can't safely hold a shared secret, so the worker
 * pairs the X-Admin-Key check with an Origin header check as defense in
 * depth. The owner SITE is the only allowed origin in production.
 *
 * BOOKING_ALLOWED_ORIGIN is a comma-separated list. "*" allows anything
 * (dev only). Empty / unset = fail closed.
 */

export interface OriginCheckResult {
  ok: boolean;
  origin: string | null;
  reason?: string;
  cors: HeadersInit;
}

export function checkOrigin(
  req: Request,
  allowedRaw: string | undefined
): OriginCheckResult {
  const origin = req.headers.get("Origin");
  const allowed = (allowedRaw || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (allowed.length === 0) {
    return {
      ok: false,
      origin,
      reason: "BOOKING_ALLOWED_ORIGIN not configured",
      cors: baseCorsHeaders(null)
    };
  }

  if (allowed.includes("*")) {
    return {
      ok: true,
      origin: origin ?? "*",
      cors: baseCorsHeaders(origin ?? "*")
    };
  }

  if (!origin) {
    return {
      ok: false,
      origin: null,
      reason: "Origin header required",
      cors: baseCorsHeaders(null)
    };
  }

  if (!allowed.includes(origin)) {
    return {
      ok: false,
      origin,
      reason: "Origin not allowed",
      cors: baseCorsHeaders(null)
    };
  }

  return {
    ok: true,
    origin,
    cors: baseCorsHeaders(origin)
  };
}

function baseCorsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin || "null",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Access-Control-Max-Age": "300"
  };
}
