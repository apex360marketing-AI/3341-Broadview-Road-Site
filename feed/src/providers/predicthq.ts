/**
 * PredictHQ Events API adapter.
 *
 * Endpoint: GET https://api.predicthq.com/v1/events/
 *   ?within=50mi@49.8344,-119.6217
 *   &active.gte=YYYY-MM-DD
 *   &category=concerts,festivals,community,sports,conferences
 * Headers: Authorization: Bearer {TOKEN}
 *
 * Response: { count, next, results: [...] }
 *
 * Each event:
 *   { id, title, description, start, end, category,
 *     location:[lng,lat]    // NOTE: GeoJSON order is [lng, lat]!
 *   }
 *
 * Free tier permits ~1000 requests/month — well within 4 cron refreshes/day.
 */
import type { RawEvent } from "../schema";
import type { ProviderResult } from "./types";

const ENDPOINT = "https://api.predicthq.com/v1/events/";
const PROVIDER_TIMEOUT_MS = 5_000;
const CATEGORIES = "concerts,festivals,community,sports,conferences,performing-arts,expos";

interface PredictHQEvent {
  id: string;
  title?: string | null;
  description?: string | null;
  start?: string | null;
  end?: string | null;
  category?: string | null;
  /** GeoJSON-style [lng, lat]. */
  location?: [number, number] | null;
  /** Some events include the canonical PHQ URL in `phq_attendance` or none at all — we synthesize one. */
}

interface PredictHQResponse {
  results?: PredictHQEvent[];
  next?: string | null;
}

export async function fetchPredictHQEvents(args: {
  token: string;
  lat: number;
  lng: number;
  radiusMiles: number;
}): Promise<ProviderResult> {
  if (!args.token) {
    return { status: "fail", events: [], error: "missing token" };
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const url = new URL(ENDPOINT);
  url.searchParams.set("within", `${args.radiusMiles}mi@${args.lat},${args.lng}`);
  url.searchParams.set("active.gte", today);
  url.searchParams.set("category", CATEGORIES);
  url.searchParams.set("limit", "100");

  let res: Response;
  try {
    res = await fetchWithTimeout(url.toString(), args.token, PROVIDER_TIMEOUT_MS);
  } catch (err) {
    return { status: "fail", events: [], error: `network: ${String(err)}` };
  }

  if (res.status === 401 || res.status === 403) {
    return { status: "fail", events: [], error: `http ${res.status}` };
  }
  if (res.status === 429) {
    return { status: "fail", events: [], error: "rate limited" };
  }
  if (res.status >= 500) {
    await sleep(500);
    try {
      res = await fetchWithTimeout(url.toString(), args.token, PROVIDER_TIMEOUT_MS);
    } catch (err) {
      return { status: "fail", events: [], error: `retry network: ${String(err)}` };
    }
    if (!res.ok) return { status: "fail", events: [], error: `http ${res.status}` };
  }
  if (!res.ok) {
    return { status: "fail", events: [], error: `http ${res.status}` };
  }

  let body: PredictHQResponse;
  try {
    body = (await res.json()) as PredictHQResponse;
  } catch (err) {
    console.warn("[predicthq] bad JSON", err);
    return { status: "fail", events: [], error: "bad json" };
  }

  const events: RawEvent[] = [];
  for (const ev of body.results ?? []) {
    const mapped = mapEvent(ev);
    if (mapped) events.push(mapped);
  }

  return { status: "ok", events };
}

function mapEvent(ev: PredictHQEvent): RawEvent | null {
  const title = ev.title?.trim();
  const startsAt = ev.start;
  if (!title || !startsAt) return null;

  // PredictHQ doesn't always expose a canonical public URL on free tier; we
  // synthesize a deep-link to their event detail page (gracefully redirects
  // to a 404 if missing — non-fatal).
  const url = `https://www.predicthq.com/events/${encodeURIComponent(ev.id)}`;

  // GeoJSON order: [lng, lat].
  let lat: number | null = null;
  let lng: number | null = null;
  if (Array.isArray(ev.location) && ev.location.length === 2) {
    const [maybeLng, maybeLat] = ev.location;
    if (typeof maybeLat === "number" && typeof maybeLng === "number") {
      lat = maybeLat;
      lng = maybeLng;
    }
  }

  return {
    providerId: ev.id,
    source: "PredictHQ",
    title,
    description: ev.description ?? null,
    url,
    startsAt,
    endsAt: ev.end ?? null,
    imageUrl: null, // PredictHQ doesn't supply images on free tier
    lat,
    lng,
    categoryHint: ev.category ?? null,
  };
}

function fetchWithTimeout(url: string, token: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  }).finally(() => clearTimeout(timeout));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
