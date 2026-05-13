/**
 * Domain types for the booking flow.
 *
 * BookingRecord — the canonical KV-persisted shape created by /book and
 * mutated by /booking/:id/secure. Stored at key `booking:{uuid}` with
 * a TTL of 1h while pending, 30d after the auth-hold is in place.
 *
 * AvailabilityCachePayload — the response shape for GET /availability,
 * also the cache shape stored at `avail:{listing}:{ym}` with a 5-minute TTL.
 */

export type BookingStatus = "pending" | "secured" | "expired";

export interface BookingRecord {
  booking_id: string;          // UUID, same value as client's request_id
  status: BookingStatus;
  listing_id: string;
  listing_name: string;

  // Guest details (PII — never logged)
  name: string;
  email: string;
  phone: string | null;

  // Stay
  checkin: string;             // YYYY-MM-DD
  checkout: string;            // YYYY-MM-DD
  guests: number;
  nights: number;
  message: string | null;

  // Deposit / payment
  deposit_amount: number;      // cents (CAD 59500 = $595.00)
  currency: "CAD";
  payment_intent_id: string | null;
  hold_expires_at: string | null;  // ISO; populated after secure
  secured_at: string | null;       // ISO; populated after secure

  // Consent + audit
  marketing_opt_in: boolean;
  consent_text_shown: string;
  ghl_contact_id: string | null;
  ghl_appointment_id: string | null;

  // Lifecycle
  created_at: string;          // ISO
  expires_at: string;          // ISO; pending bookings auto-expire after 1h
}

export interface AvailabilityCachePayload {
  listing_id: string;
  from: string;                // YYYY-MM-DD
  to: string;                  // YYYY-MM-DD
  blocked_dates: string[];     // YYYY-MM-DD[]
  min_nights: number;
  source: "ghl" | "cache" | "degraded";
  cached_at: string;           // ISO
}

/**
 * Idempotency record — stored at `idempotency:{key}` with a 24h TTL.
 * On a repeat /book POST with the same Idempotency-Key header, the prior
 * response is replayed. If the body differs under the same key we 422.
 */
export interface IdempotencyRecord {
  key: string;
  body_hash: string;           // SHA-256 of the canonical payload
  response: unknown;           // The booking response we returned
  created_at: string;
}
