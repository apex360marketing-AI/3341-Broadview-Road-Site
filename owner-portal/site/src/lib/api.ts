/**
 * Browser-side API client for the owner-portal worker.
 *
 * Phase 1: read-only (list + detail). No mutations. The admin key is read
 * from sessionStorage on every call; if the worker returns 401 the caller
 * is responsible for clearing the key and redirecting to the login gate.
 *
 * The key NEVER goes in localStorage — sessionStorage clears on tab close,
 * which matches the "shared internal terminal" threat model best.
 *
 * This file is browser-only — it touches `sessionStorage` and `fetch`. It
 * is intentionally NOT imported by Astro frontmatter / SSR paths.
 */

const KEY_STORAGE = 'owner-portal:key';

export type BookingStatus = 'pending' | 'secured' | 'expired';

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

export interface BookingDetail extends BookingSummary {
  phone: string | null;
  message: string | null;
  payment_intent_id: string | null;
  marketing_opt_in: boolean;
  consent_text_shown: string;
  ghl_contact_id: string | null;
  ghl_appointment_id: string | null;
}

export interface ListResponse {
  bookings: BookingSummary[];
  truncated: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getKey(): string | null {
  try {
    return sessionStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setKey(key: string): void {
  try {
    sessionStorage.setItem(KEY_STORAGE, key);
  } catch {
    /* ignore */
  }
}

export function clearKey(): void {
  try {
    sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

async function call<T>(apiUrl: string, path: string, init: RequestInit = {}): Promise<T> {
  const key = getKey();
  if (!key) throw new ApiError(401, 'not_authenticated');

  const base = apiUrl.replace(/\/+$/, '');
  const r = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'X-Admin-Key': key,
      Accept: 'application/json'
    }
  });
  if (r.status === 401) {
    clearKey();
    throw new ApiError(401, 'unauthorized');
  }
  if (r.status === 429) {
    throw new ApiError(429, 'rate_limited');
  }
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new ApiError(r.status, txt || `http_${r.status}`);
  }
  return (await r.json()) as T;
}

export async function verifyKey(apiUrl: string, candidate: string): Promise<boolean> {
  const base = apiUrl.replace(/\/+$/, '');
  try {
    const r = await fetch(`${base}/auth`, {
      method: 'POST',
      headers: { 'X-Admin-Key': candidate }
    });
    return r.status === 204;
  } catch {
    return false;
  }
}

export function listBookings(apiUrl: string, status?: BookingStatus): Promise<ListResponse> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return call<ListResponse>(apiUrl, `/bookings${qs}`);
}

export function getBooking(apiUrl: string, id: string): Promise<BookingDetail> {
  return call<BookingDetail>(apiUrl, `/bookings/${encodeURIComponent(id)}`);
}
