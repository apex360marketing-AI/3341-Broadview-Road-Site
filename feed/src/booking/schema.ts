/**
 * Zod schemas for the booking endpoints.
 *
 * Validates every public-facing request shape before it touches GHL or KV.
 * Keep field-level limits in sync with the docs (CLAUDE.md) and the
 * tokens.json defaults the site relies on.
 */
import { z } from "zod";

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");
const Uuid = z.string().uuid();
const Email = z.string().email().max(254);
const Name = z.string().min(1).max(120);
const Phone = z.string().max(40).nullable();
const Message = z.string().max(2000).nullable();

/**
 * POST /book request body. Note: `cancellation_policy_ack` is collected
 * on /pay (Build 6) and replayed back here for the audit trail — it isn't
 * required at /book time, so we accept it optional.
 */
export const BookRequestSchema = z.object({
  request_id: Uuid,
  listing_id: z.string().min(1).max(64),
  name: Name,
  email: Email,
  phone: Phone,
  checkin: IsoDate,
  checkout: IsoDate,
  guests: z.number().int().min(1).max(20),
  message: Message,
  marketing_opt_in: z.boolean(),
  consent_text_shown: z.string().min(1).max(2000),
  cancellation_policy_ack: z.boolean().optional(),
  honeypot_company: z.string(),     // must be ""
  opened_at: z.number().int().min(0)
});
export type BookRequest = z.infer<typeof BookRequestSchema>;

/**
 * POST /booking/:id/secure request body — sent from /pay after Stripe
 * Elements produces a payment_method_id.
 */
export const SecureRequestSchema = z.object({
  payment_method_id: z.string().min(1).max(120),
  billing_country: z.string().length(2),    // ISO 3166-1 alpha-2
  honeypot_company: z.string(),
  opened_at: z.number().int().min(0)
});
export type SecureRequest = z.infer<typeof SecureRequestSchema>;

/**
 * Helpers for date math used by both /availability and /book.
 */
export function diffDays(from: string, to: string): number {
  const fromMs = Date.parse(from + "T00:00:00Z");
  const toMs = Date.parse(to + "T00:00:00Z");
  return Math.round((toMs - fromMs) / 86400000);
}

export function isValidDateRange(from: string, to: string, minNights: number, maxDays: number): { ok: true } | { ok: false; reason: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return { ok: false, reason: "from must be YYYY-MM-DD" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) return { ok: false, reason: "to must be YYYY-MM-DD" };
  const nights = diffDays(from, to);
  if (nights < minNights) return { ok: false, reason: `Minimum ${minNights} nights` };
  if (nights > maxDays) return { ok: false, reason: `Stay too long (max ${maxDays} days)` };
  const todayIso = new Date().toISOString().slice(0, 10);
  if (from < todayIso) return { ok: false, reason: "Check-in must be in the future" };
  return { ok: true };
}
