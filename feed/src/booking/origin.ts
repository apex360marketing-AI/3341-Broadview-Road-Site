/**
 * Origin allowlist for browser-originated booking endpoints.
 *
 * Static-site bundles can't safely hold a shared secret, so we enforce
 * Origin header matching as the first defense (combined with per-IP
 * rate limiting and honeypot + min-time anti-spam in handlers).
 *
 * BOOKING_ALLOWED_ORIGIN is a comma-separated list — production should
 * usually be a single value; dev can add localhost origins.
 */

export interface OriginCheckResult {
  ok: boolean;
  origin: string | null;
  reason?: string;
  cors: HeadersInit;
}

/**
 * Returns CORS headers tuned to the resolved origin, plus an ok flag.
 * Caller is responsible for short-circuiting on !ok with a 403.
 *
 * Treats "*" in BOOKING_ALLOWED_ORIGIN as "allow any" — useful in dev,
 * NEVER ship to prod that way (booking endpoints would be open to abuse).
 */
export function checkOrigin(
  req: Request,
  allowedRaw: string | undefined
): OriginCheckResult {
  const origin = req.headers.get("Origin");
  const allowed = (allowedRaw || "").split(",").map((s) => s.trim()).filter(Boolean);

  // No config → fail closed (better than open by default)
  if (allowed.length === 0) {
    return {
      ok: false,
      origin,
      reason: "BOOKING_ALLOWED_ORIGIN not configured",
      cors: baseCorsHeaders(null)
    };
  }

  // Wildcard — allow any origin (dev only)
  if (allowed.includes("*")) {
    return {
      ok: true,
      origin: origin ?? "*",
      cors: baseCorsHeaders(origin ?? "*")
    };
  }

  // No Origin header on a non-wildcard config → reject. Same-origin requests
  // from a browser will always include Origin; server-to-server callers
  // should use /refresh (which has its own auth) instead.
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
    "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
    "Access-Control-Max-Age": "300"
  };
}
