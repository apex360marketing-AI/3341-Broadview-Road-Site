/**
 * Eventbrite Public API adapter.
 *
 * Endpoint: GET https://www.eventbriteapi.com/v3/events/search/
 *   ?location.address=West+Kelowna,+BC
 *   &location.within=50mi
 *   &token={TOKEN}
 *   &expand=venue
 *
 * The Public Search endpoint is rate-limited but free for low-volume use.
 * Response shape (truncated):
 *   { events: [...], pagination: { has_more_items, continuation } }
 *
 * Each event:
 *   { id, name:{text}, description:{text}, url, start:{utc}, end:{utc},
 *     logo:{url}, venue:{latitude, longitude}, category_id }
 *
 * Note (2025-01): Eventbrite has periodically deprecated public Search
 * access. If the API returns 404/403 across the board we mark provider
 * as 'fail' and proceed without it — the rest of the pipeline degrades
 * gracefully.
 */
import type { RawEvent } from "../schema";
import type { ProviderResult } from "./types";

const ENDPOINT = "https://www.eventbriteapi.com/v3/events/search/";
const PROVIDER_TIMEOUT_MS = 5_000;
const MAX_PAGES = 3; // hard cap — we don't need every event in the universe

interface EventbriteEvent {
  id: string;
  name?: { text?: string | null } | null;
  description?: { text?: string | null } | null;
  url?: string | null;
  start?: { utc?: string | null } | null;
  end?: { utc?: string | null } | null;
  logo?: { url?: string | null } | null;
  venue?: { latitude?: string | null; longitude?: string | null } | null;
  category_id?: string | null;
}

interface EventbriteResponse {
  events?: EventbriteEvent[];
  pagination?: { has_more_items?: boolean; continuation?: string | null };
}

export async function fetchEventbriteEvents(args: {
  token: string;
  locationAddress: string;
  radiusMiles: number;
}): Promise<ProviderResult> {
  if (!args.token) {
    return { status: "fail", events: [], error: "missing token" };
  }

  const events: RawEvent[] = [];
  let continuation: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(ENDPOINT);
    url.searchParams.set("location.address", args.locationAddress);
    url.searchParams.set("location.within", `${args.radiusMiles}mi`);
    url.searchParams.set("expand", "venue");
    url.searchParams.set("token", args.token);
    if (continuation) url.searchParams.set("continuation", continuation);

    let res: Response;
    try {
      res = await fetchWithTimeout(url.toString(), PROVIDER_TIMEOUT_MS);
    } catch (err) {
      return { status: "fail", events, error: `network: ${String(err)}` };
    }

    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return { status: "fail", events, error: `http ${res.status}` };
    }
    if (res.status === 429) {
      // Respect Retry-After by bailing — cron runs again in 6h.
      return { status: "fail", events, error: "rate limited" };
    }
    if (res.status >= 500) {
      // One retry with 500ms backoff.
      await sleep(500);
      try {
        res = await fetchWithTimeout(url.toString(), PROVIDER_TIMEOUT_MS);
      } catch (err) {
        return { status: "fail", events, error: `retry network: ${String(err)}` };
      }
      if (!res.ok) return { status: "fail", events, error: `http ${res.status}` };
    }
    if (!res.ok) {
      return { status: "fail", events, error: `http ${res.status}` };
    }

    let body: EventbriteResponse;
    try {
      body = (await res.json()) as EventbriteResponse;
    } catch (err) {
      console.warn("[eventbrite] bad JSON", err);
      return { status: "fail", events, error: "bad json" };
    }

    for (const ev of body.events ?? []) {
      const mapped = mapEvent(ev);
      if (mapped) events.push(mapped);
    }

    if (!body.pagination?.has_more_items || !body.pagination?.continuation) {
      break;
    }
    continuation = body.pagination.continuation ?? null;
    if (!continuation) break;
  }

  return { status: "ok", events };
}

function mapEvent(ev: EventbriteEvent): RawEvent | null {
  const title = ev.name?.text?.trim();
  const url = ev.url?.trim();
  const startsAt = ev.start?.utc;
  if (!title || !url || !startsAt) return null;

  const lat = parseCoord(ev.venue?.latitude);
  const lng = parseCoord(ev.venue?.longitude);

  return {
    providerId: ev.id,
    source: "Eventbrite",
    title,
    description: ev.description?.text ?? null,
    url,
    startsAt,
    endsAt: ev.end?.utc ?? null,
    imageUrl: ev.logo?.url ?? null,
    lat,
    lng,
    categoryHint: ev.category_id ?? null,
  };
}

function parseCoord(s: string | null | undefined): number | null {
  if (s == null) return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } })
    .finally(() => clearTimeout(timeout));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
