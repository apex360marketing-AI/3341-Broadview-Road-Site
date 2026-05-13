/**
 * Ticketmaster Discovery API adapter.
 *
 * Endpoint: GET https://app.ticketmaster.com/discovery/v2/events.json
 *   ?latlong=49.8344,-119.6217
 *   &radius=50
 *   &unit=miles
 *   &apikey={KEY}
 *
 * Free quota: 5000 requests/day per app. We make 4/day from cron — plenty.
 *
 * Response:
 *   { _embedded: { events: [...] }, page: { totalPages, number } }
 *
 * Each event:
 *   {
 *     id, name, url,
 *     dates: { start: { dateTime, localDate, localTime } },
 *     images: [{ url, width, height, ratio }],
 *     classifications: [{ segment: { name } }],
 *     _embedded: { venues: [{ location: { latitude, longitude } }] }
 *   }
 *
 * `dates.start.dateTime` is usually a UTC ISO string. When it's missing
 * (TBA-time events) we fall back to `localDate` (date-only) which our
 * normalizer promotes to UTC midnight.
 */
import type { RawEvent } from "../schema";
import type { ProviderResult } from "./types";

const ENDPOINT = "https://app.ticketmaster.com/discovery/v2/events.json";
const PROVIDER_TIMEOUT_MS = 5_000;
const MAX_PAGES = 3;
const PAGE_SIZE = 100;

interface TMImage {
  url?: string | null;
  width?: number;
  height?: number;
  ratio?: string;
}

interface TMVenue {
  location?: { latitude?: string | null; longitude?: string | null } | null;
}

interface TMEvent {
  id: string;
  name?: string | null;
  url?: string | null;
  info?: string | null;
  description?: string | null;
  dates?: {
    start?: { dateTime?: string | null; localDate?: string | null } | null;
    end?: { dateTime?: string | null } | null;
  } | null;
  images?: TMImage[];
  classifications?: Array<{ segment?: { name?: string | null } | null } | null> | null;
  _embedded?: { venues?: TMVenue[] } | null;
}

interface TMResponse {
  _embedded?: { events?: TMEvent[] };
  page?: { totalPages?: number; number?: number };
}

export async function fetchTicketmasterEvents(args: {
  apiKey: string;
  lat: number;
  lng: number;
  radiusMiles: number;
}): Promise<ProviderResult> {
  if (!args.apiKey) {
    return { status: "fail", events: [], error: "missing key" };
  }

  const events: RawEvent[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(ENDPOINT);
    url.searchParams.set("latlong", `${args.lat},${args.lng}`);
    url.searchParams.set("radius", String(args.radiusMiles));
    url.searchParams.set("unit", "miles");
    url.searchParams.set("size", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));
    url.searchParams.set("apikey", args.apiKey);

    let res: Response;
    try {
      res = await fetchWithTimeout(url.toString(), PROVIDER_TIMEOUT_MS);
    } catch (err) {
      return { status: "fail", events, error: `network: ${String(err)}` };
    }

    if (res.status === 401 || res.status === 403) {
      return { status: "fail", events, error: `http ${res.status}` };
    }
    if (res.status === 429) {
      return { status: "fail", events, error: "rate limited" };
    }
    if (res.status >= 500) {
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

    let body: TMResponse;
    try {
      body = (await res.json()) as TMResponse;
    } catch (err) {
      console.warn("[ticketmaster] bad JSON", err);
      return { status: "fail", events, error: "bad json" };
    }

    const pageEvents = body._embedded?.events ?? [];
    for (const ev of pageEvents) {
      const mapped = mapEvent(ev);
      if (mapped) events.push(mapped);
    }

    const totalPages = body.page?.totalPages ?? 1;
    if (page + 1 >= totalPages) break;
  }

  return { status: "ok", events };
}

function mapEvent(ev: TMEvent): RawEvent | null {
  const title = ev.name?.trim();
  const url = ev.url?.trim();
  const startsAt = ev.dates?.start?.dateTime || ev.dates?.start?.localDate;
  if (!title || !url || !startsAt) return null;

  const imageUrl = pickBestImage(ev.images ?? []);

  const venue = ev._embedded?.venues?.[0];
  const lat = parseCoord(venue?.location?.latitude ?? null);
  const lng = parseCoord(venue?.location?.longitude ?? null);

  const segment = ev.classifications?.[0]?.segment?.name ?? null;

  return {
    providerId: ev.id,
    source: "Ticketmaster",
    title,
    description: ev.info ?? ev.description ?? null,
    url,
    startsAt,
    endsAt: ev.dates?.end?.dateTime ?? null,
    imageUrl: imageUrl ?? null,
    lat,
    lng,
    categoryHint: segment,
  };
}

/**
 * Ticketmaster returns multiple sizes; pick the largest 16:9-ish so the
 * front-end card crop looks reasonable. Falls back to first available.
 */
function pickBestImage(images: TMImage[]): string | null {
  if (images.length === 0) return null;
  const sixteenNine = images
    .filter((i) => i.url && (i.ratio === "16_9" || i.ratio === "3_2"))
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  if (sixteenNine[0]?.url) return sixteenNine[0].url;
  const anySorted = [...images]
    .filter((i) => !!i.url)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return anySorted[0]?.url ?? null;
}

function parseCoord(s: string | null): number | null {
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
