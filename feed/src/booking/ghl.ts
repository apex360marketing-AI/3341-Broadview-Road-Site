/**
 * GoHighLevel REST client — minimal, Worker-friendly (uses plain fetch).
 *
 * Two operations:
 *   1. getCalendarBlockedDates() — read existing appointments in a date
 *      range and project them into a flat list of YYYY-MM-DD strings.
 *   2. createAppointment()       — upsert a contact (with consent + opt-in
 *      custom fields), then create a calendar appointment for the stay.
 *
 * The API base + endpoint paths target the documented LeadConnector API
 * surface as of v2021-07-28. The operator may need to update endpoint
 * paths if GHL revs the API again — they're isolated to this file so
 * the rest of the booking flow stays stable.
 *
 * The Worker's bundle stays small by NOT pulling in @gohighlevel/sdk —
 * fetch + JSON is enough for the 3 calls we make.
 */
import type { Env } from "../refresh";
import type { BookingRecord } from "./types";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

interface GHLAppointment {
  id?: string;
  startTime: string;  // ISO with offset
  endTime: string;
}

interface GHLEventsResponse {
  events?: GHLAppointment[];
}

interface GHLContactResponse {
  contact?: { id: string };
}

interface GHLCreateAppointmentResponse {
  id?: string;
  appointment?: { id: string };
}

function authHeaders(env: Env): HeadersInit {
  return {
    Authorization: `Bearer ${env.GHL_API_KEY}`,
    Version: GHL_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
}

/**
 * Walks a date range, calls GHL Calendar API for existing appointments,
 * and returns a list of YYYY-MM-DD strings that are blocked.
 *
 * The 'check-out day' of an existing reservation is NOT blocked (allows
 * back-to-back stays — standard STR convention). We block every day from
 * the appointment's start UP TO BUT NOT INCLUDING its end date.
 */
export async function getCalendarBlockedDates(
  env: Env,
  from: string,        // YYYY-MM-DD
  to: string           // YYYY-MM-DD
): Promise<string[]> {
  if (!env.GHL_API_KEY || !env.GHL_CALENDAR_ID || !env.GHL_LOCATION_ID) {
    throw new Error("GHL not configured");
  }

  // GHL expects ISO timestamps; convert from/to YYYY-MM-DD by anchoring to UTC.
  const startTime = `${from}T00:00:00.000Z`;
  const endTime = `${to}T23:59:59.999Z`;

  const url = new URL(`${GHL_BASE}/calendars/events`);
  url.searchParams.set("locationId", env.GHL_LOCATION_ID);
  url.searchParams.set("calendarId", env.GHL_CALENDAR_ID);
  url.searchParams.set("startTime", startTime);
  url.searchParams.set("endTime", endTime);

  const r = await fetch(url.toString(), {
    method: "GET",
    headers: authHeaders(env)
  });
  if (!r.ok) {
    throw new Error(`GHL calendars/events ${r.status}`);
  }
  const data = (await r.json()) as GHLEventsResponse;
  const events = Array.isArray(data.events) ? data.events : [];

  const blocked = new Set<string>();
  for (const ev of events) {
    if (!ev.startTime || !ev.endTime) continue;
    const startDate = ev.startTime.slice(0, 10);
    const endDate = ev.endTime.slice(0, 10);
    // Iterate from start (inclusive) to end (exclusive)
    const cursor = new Date(startDate + "T00:00:00Z");
    const stopAt = new Date(endDate + "T00:00:00Z");
    while (cursor < stopAt) {
      blocked.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return [...blocked].sort();
}

/**
 * Creates (or upserts) a GHL contact for the guest with consent
 * custom fields, then creates a calendar appointment for the stay.
 * Returns the GHL appointment ID + contact ID for our BookingRecord.
 *
 * Two-step is intentional — the contact must exist before the
 * appointment can reference it.
 */
export async function createAppointment(
  env: Env,
  record: BookingRecord
): Promise<{ ghl_contact_id: string; ghl_appointment_id: string }> {
  if (!env.GHL_API_KEY || !env.GHL_CALENDAR_ID || !env.GHL_LOCATION_ID) {
    throw new Error("GHL not configured");
  }

  // Step 1: upsert contact with consent fields. customFields shape varies by
  // GHL config — operator must create custom fields named exactly:
  //   marketing_opt_in, consent_text_shown, cancellation_policy_ack
  // and pass their IDs in via env if they differ. For v1.1 we send by name.
  const contactBody = {
    locationId: env.GHL_LOCATION_ID,
    firstName: record.name.split(" ")[0],
    lastName: record.name.split(" ").slice(1).join(" ") || "",
    email: record.email,
    phone: record.phone || undefined,
    source: "valora-site",
    customFields: [
      { key: "marketing_opt_in", field_value: record.marketing_opt_in },
      { key: "consent_text_shown", field_value: record.consent_text_shown }
    ]
  };

  const contactRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: "POST",
    headers: authHeaders(env),
    body: JSON.stringify(contactBody)
  });
  if (!contactRes.ok) {
    throw new Error(`GHL contacts/upsert ${contactRes.status}`);
  }
  const contactData = (await contactRes.json()) as GHLContactResponse;
  const ghl_contact_id = contactData.contact?.id;
  if (!ghl_contact_id) {
    throw new Error("GHL contacts/upsert returned no contact id");
  }

  // Step 2: create appointment spanning the full stay.
  const startTime = `${record.checkin}T16:00:00.000Z`;  // 4 PM check-in convention
  const endTime = `${record.checkout}T11:00:00.000Z`;   // 11 AM check-out convention

  const apptBody = {
    locationId: env.GHL_LOCATION_ID,
    calendarId: env.GHL_CALENDAR_ID,
    contactId: ghl_contact_id,
    startTime,
    endTime,
    title: `${record.listing_name} — ${record.guests} guests (${record.booking_id})`,
    appointmentStatus: "new",
    address: record.message || undefined
  };

  const apptRes = await fetch(`${GHL_BASE}/calendars/events/appointments`, {
    method: "POST",
    headers: authHeaders(env),
    body: JSON.stringify(apptBody)
  });
  if (!apptRes.ok) {
    throw new Error(`GHL appointments create ${apptRes.status}`);
  }
  const apptData = (await apptRes.json()) as GHLCreateAppointmentResponse;
  const ghl_appointment_id = apptData.id || apptData.appointment?.id;
  if (!ghl_appointment_id) {
    throw new Error("GHL appointments create returned no appointment id");
  }

  return { ghl_contact_id, ghl_appointment_id };
}
