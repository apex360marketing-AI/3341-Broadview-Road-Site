/**
 * Stripe REST client — minimal, Worker-friendly. Plain fetch (no SDK).
 *
 * Used by POST /booking/:id/secure to authorise the deposit hold:
 *   - capture_method = manual  (the auth-hold mechanic — Stripe authorises
 *     but does NOT capture until the host confirms within ~7 days)
 *   - confirm = true           (immediate confirmation since the
 *     payment_method_id was tokenised on the browser via Stripe Elements)
 *   - idempotency key = "secure:{booking_id}"  (replay safety)
 *
 * Returns the PaymentIntent id + the hold expiry timestamp so we can
 * store it on the BookingRecord and surface it to the guest.
 */
import type { Env } from "../refresh";

const STRIPE_BASE = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = "2024-12-18.acacia";

// Stripe auth-holds last 7 days for cards (industry-standard window).
const HOLD_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export interface PaymentIntentResult {
  id: string;
  status: string;            // 'requires_action' | 'requires_capture' | 'requires_payment_method' | 'succeeded' | etc.
  hold_expires_at: string;
}

interface StripePaymentIntent {
  id: string;
  status: string;
  client_secret?: string;
  last_payment_error?: { code?: string; decline_code?: string; message?: string };
}

/**
 * URL-encoded form body — Stripe API uses application/x-www-form-urlencoded,
 * not JSON. We flatten nested keys with bracket notation as Stripe expects.
 */
function encodeStripeForm(params: Record<string, string | number | boolean | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
}

/**
 * Create + confirm a PaymentIntent in manual-capture mode (the auth-hold).
 * Stripe automatically attaches the supplied payment_method_id and confirms
 * synchronously when `confirm=true` is set on creation.
 */
export async function createAuthHold(
  env: Env,
  args: {
    booking_id: string;
    amount: number;           // cents
    currency: string;         // "cad"
    payment_method_id: string;
    customer_email: string;
    description: string;
  }
): Promise<PaymentIntentResult> {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");

  const body = encodeStripeForm({
    amount: args.amount,
    currency: args.currency.toLowerCase(),
    payment_method: args.payment_method_id,
    capture_method: "manual",
    confirm: true,
    "automatic_payment_methods[enabled]": true,
    "automatic_payment_methods[allow_redirects]": "never",
    receipt_email: args.customer_email,
    description: args.description,
    "metadata[booking_id]": args.booking_id
  });

  const r = await fetch(`${STRIPE_BASE}/payment_intents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION,
      "Idempotency-Key": `secure:${args.booking_id}`
    },
    body
  });

  const pi = (await r.json()) as StripePaymentIntent;

  if (!r.ok || !pi.id) {
    const code = pi.last_payment_error?.decline_code || pi.last_payment_error?.code || `stripe_${r.status}`;
    throw new StripeError(code, pi.last_payment_error?.message || "Card could not be authorized");
  }

  // Stripe auth-holds are good for ~7 days for card payments
  const hold_expires_at = new Date(Date.now() + HOLD_LIFETIME_MS).toISOString();

  return {
    id: pi.id,
    status: pi.status,
    hold_expires_at
  };
}

export class StripeError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "StripeError";
  }
}
