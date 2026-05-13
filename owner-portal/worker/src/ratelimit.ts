/**
 * Per-IP rate limit for the owner-portal worker.
 *
 * Uses the same KV namespace as the public worker, but writes under a
 * dedicated `ownerlimit:` prefix so it doesn't collide with the public
 * worker's `ratelimit:` keys.
 *
 * Two scopes:
 *   auth — POST /auth, tight limit (brute-force protection)
 *   read — GET /bookings, GET /bookings/:id, generous
 */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1h

export type RateScope = "auth" | "read";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  kv: KVNamespace,
  scope: RateScope,
  ip: string,
  limit: number
): Promise<RateLimitResult> {
  const key = `ownerlimit:${scope}:${ip}`;
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
  const ttl = Math.max(
    1,
    Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.windowStartMs)) / 1000)
  );
  await kv.put(key, JSON.stringify(record), { expirationTtl: ttl + 5 });
  if (record.count > limit) {
    return { allowed: false, retryAfterSeconds: ttl };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("CF-Connecting-IP") ??
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
