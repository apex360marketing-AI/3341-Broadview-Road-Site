/**
 * KV-backed per-IP rate limit for POST /refresh.
 *
 * Window: 1 hour. Limit: 6 requests/IP/hour. Tight on purpose — /refresh is
 * an operator-triggered re-aggregation that hits the upstream provider
 * quotas; we don't need anyone hitting it more than once every 10 minutes.
 *
 * Implementation: sliding-ish window via a JSON record `{count, windowStartMs}`.
 * Cheap, single KV read + write per request. Not perfectly accurate under
 * heavy contention (KV is eventually consistent), but more than enough for
 * stopping a typo'd loop from melting our provider quotas.
 */
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LIMIT = 6;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  kv: KVNamespace,
  ip: string
): Promise<RateLimitResult> {
  const key = `ratelimit:${ip}`;
  const now = Date.now();

  const raw = await kv.get(key);
  let record: { count: number; windowStartMs: number };
  if (raw) {
    try {
      record = JSON.parse(raw) as { count: number; windowStartMs: number };
    } catch {
      record = { count: 0, windowStartMs: now };
    }
  } else {
    record = { count: 0, windowStartMs: now };
  }

  // Window expired → reset.
  if (now - record.windowStartMs >= WINDOW_MS) {
    record = { count: 0, windowStartMs: now };
  }

  record.count += 1;

  const ttlSeconds = Math.max(
    1,
    Math.ceil((WINDOW_MS - (now - record.windowStartMs)) / 1000)
  );
  await kv.put(key, JSON.stringify(record), { expirationTtl: ttlSeconds + 5 });

  if (record.count > LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: ttlSeconds,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, LIMIT - record.count),
    retryAfterSeconds: 0,
  };
}
