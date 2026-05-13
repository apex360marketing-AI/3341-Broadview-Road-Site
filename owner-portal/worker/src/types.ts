/**
 * Domain types — re-declared (NOT imported) from ../../feed/src/booking/types.ts
 * so this worker has zero dependency on the public worker's source tree.
 *
 * The shape MUST match. If the public worker rev's the BookingRecord shape,
 * this file is re-synced manually as part of the same change.
 *
 * KV records are written by ../../feed/ and merely READ here (Phase 1).
 * Phase 2 will mutate `status`, `payment_intent_id`, `secured_at`, etc.
 */

export type BookingStatus = "pending" | "secured" | "expired";

export interface BookingRecord {
  booking_id: string;
  status: BookingStatus;
  listing_id: string;
  listing_name: string;

  name: string;
  email: string;
  phone: string | null;

  checkin: string;
  checkout: string;
  guests: number;
  nights: number;
  message: string | null;

  deposit_amount: number;
  currency: "CAD";
  payment_intent_id: string | null;
  hold_expires_at: string | null;
  secured_at: string | null;

  marketing_opt_in: boolean;
  consent_text_shown: string;
  ghl_contact_id: string | null;
  ghl_appointment_id: string | null;

  created_at: string;
  expires_at: string;
}

export interface Env {
  FEED_KV: KVNamespace;
  ADMIN_KEY?: string;
  BOOKING_ALLOWED_ORIGIN?: string;
  STRIPE_SECRET_KEY?: string; // Phase 2 — unused in Phase 1
}

/** Slim projection sent on the list endpoint. */
export interface BookingSummary {
  booking_id: string;
  status: BookingStatus;
  listing_id: string;
  name: string;
  email: string;
  checkin: string;
  checkout: string;
  guests: number;
  nights: number;
  deposit_amount: number;
  currency: string;
  created_at: string;
  secured_at: string | null;
  hold_expires_at: string | null;
  expires_at: string;
}

export function toSummary(r: BookingRecord): BookingSummary {
  return {
    booking_id: r.booking_id,
    status: r.status,
    listing_id: r.listing_id,
    name: r.name,
    email: r.email,
    checkin: r.checkin,
    checkout: r.checkout,
    guests: r.guests,
    nights: r.nights,
    deposit_amount: r.deposit_amount,
    currency: r.currency,
    created_at: r.created_at,
    secured_at: r.secured_at,
    hold_expires_at: r.hold_expires_at,
    expires_at: r.expires_at
  };
}
