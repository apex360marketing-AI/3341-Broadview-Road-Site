/**
 * KV layer for the booking flow. All keys live in FEED_KV under
 * dedicated prefixes so they don't collide with the events cache.
 *
 *   booking:{uuid}         BookingRecord — pending 1h, secured 30d
 *   avail:{listing}:{ym}   AvailabilityCachePayload — 5 min
 *   idempotency:{key}      IdempotencyRecord — 24h
 *   ratelimit:book:{ip}    {count, windowStartMs} — see ratelimit.ts pattern
 */
import type {
  BookingRecord,
  AvailabilityCachePayload,
  IdempotencyRecord
} from "./types";

const TTL_PENDING_S = 60 * 60;            // 1h
const TTL_SECURED_S = 30 * 24 * 60 * 60;  // 30d
const TTL_AVAIL_S = 5 * 60;               // 5 min
const TTL_IDEM_S = 24 * 60 * 60;          // 24h

const KEY_BOOKING = (id: string) => `booking:${id}`;
const KEY_AVAIL = (listing: string, ym: string) => `avail:${listing}:${ym}`;
const KEY_IDEM = (key: string) => `idempotency:${key}`;

export async function putBooking(kv: KVNamespace, record: BookingRecord): Promise<void> {
  const ttl = record.status === "pending" ? TTL_PENDING_S : TTL_SECURED_S;
  await kv.put(KEY_BOOKING(record.booking_id), JSON.stringify(record), {
    expirationTtl: ttl
  });
}

export async function getBooking(kv: KVNamespace, id: string): Promise<BookingRecord | null> {
  const raw = await kv.get(KEY_BOOKING(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BookingRecord;
  } catch {
    return null;
  }
}

export async function putAvailability(kv: KVNamespace, listing: string, ym: string, payload: AvailabilityCachePayload): Promise<void> {
  await kv.put(KEY_AVAIL(listing, ym), JSON.stringify(payload), {
    expirationTtl: TTL_AVAIL_S
  });
}

export async function getAvailability(kv: KVNamespace, listing: string, ym: string): Promise<AvailabilityCachePayload | null> {
  const raw = await kv.get(KEY_AVAIL(listing, ym));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AvailabilityCachePayload;
  } catch {
    return null;
  }
}

export async function putIdempotency(kv: KVNamespace, record: IdempotencyRecord): Promise<void> {
  await kv.put(KEY_IDEM(record.key), JSON.stringify(record), {
    expirationTtl: TTL_IDEM_S
  });
}

export async function getIdempotency(kv: KVNamespace, key: string): Promise<IdempotencyRecord | null> {
  const raw = await kv.get(KEY_IDEM(key));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IdempotencyRecord;
  } catch {
    return null;
  }
}

/**
 * SHA-256 of a stable JSON serialisation — used to detect Idempotency-Key
 * reuse with a different body (a misuse that we 422 on).
 */
export async function hashBody(body: unknown): Promise<string> {
  const canonical = JSON.stringify(body, Object.keys(body as object).sort());
  const buf = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
