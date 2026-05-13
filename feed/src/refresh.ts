/**
 * Aggregation pipeline.
 *
 * Run every provider in parallel via Promise.allSettled, then:
 *   1. Flatten successful results into RawEvent[]
 *   2. Normalize each RawEvent → Event (Zod-validated)
 *   3. Filter by radius (events WITH coords; events without coords pass)
 *   4. Filter out events that have already started (drop past events)
 *   5. Dedupe across providers
 *   6. Sort ascending by startsAt
 *   7. Cap at MAX_EVENTS (30)
 *   8. Write to KV under `feed:current`
 *
 * Resilience contract:
 *   - If ALL real providers fail AND KV has a cached payload → keep cache.
 *     The /feed endpoint will then serve stale data with X-Feed-Status: stale.
 *   - If ALL real providers fail AND no cache → write an empty payload so the
 *     site doesn't break (renders the empty-state message).
 */
import { SCHEMA_VERSION, MAX_EVENTS, type Event, type FeedPayload, type RawEvent } from "./schema";
import { normalizeEvent } from "./lib/normalize";
import { dedupe } from "./lib/dedupe";
import { fetchEventbriteEvents } from "./providers/eventbrite";
import { fetchPredictHQEvents } from "./providers/predicthq";
import { fetchTicketmasterEvents } from "./providers/ticketmaster";
import { fetchYelpEvents } from "./providers/yelp";
import { fetchGooglePlacesEvents } from "./providers/google-places";
import { fetchTourismKelownaEvents } from "./providers/tourism-kelowna";
import type { ProviderResult } from "./providers/types";

export interface Env {
  FEED_KV: KVNamespace;
  EVENTBRITE_TOKEN?: string;
  PREDICTHQ_TOKEN?: string;
  TICKETMASTER_API_KEY?: string;
  REFRESH_KEY?: string;
  FEED_MANUAL_OVERRIDE?: string;
  RADIUS_KM: string;
  LISTING_LAT: string;
  LISTING_LNG: string;
}

export type ProviderStatus = "ok" | "fail" | "stub";

export interface RefreshResult {
  eventCount: number;
  providers: {
    eventbrite: ProviderStatus;
    predicthq: ProviderStatus;
    ticketmaster: ProviderStatus;
    yelp: ProviderStatus;
    googlePlaces: ProviderStatus;
    tourismKelowna: ProviderStatus;
  };
  cacheKept: boolean;
  updatedAt: string;
}

const KV_KEY_CURRENT = "feed:current";
const KM_TO_MILES = 0.621371;

/**
 * The main pipeline. Exported for the Worker (cron + POST /refresh) and for
 * the cold-start path inside GET /feed.
 *
 * `inlineBudgetMs` (optional): when invoked from GET /feed with no cache, we
 * limit total wall-clock by aborting whichever providers haven't finished.
 * The user sees something within ~3s instead of waiting for the slowest
 * upstream. Per-provider timeouts (5s) are separate from this overall budget.
 */
export async function refresh(env: Env, opts?: { inlineBudgetMs?: number }): Promise<RefreshResult> {
  const listingLat = parseFloat(env.LISTING_LAT);
  const listingLng = parseFloat(env.LISTING_LNG);
  const radiusKm = parseFloat(env.RADIUS_KM);

  if (!isFinite(listingLat) || !isFinite(listingLng) || !isFinite(radiusKm)) {
    throw new Error("Invalid LISTING_LAT/LISTING_LNG/RADIUS_KM env vars");
  }

  // Schema speaks in miles (distanceMiles), so convert at the boundary.
  const radiusMiles = radiusKm * KM_TO_MILES;

  const providerPromises = [
    fetchEventbriteEvents({
      token: env.EVENTBRITE_TOKEN ?? "",
      locationAddress: "West Kelowna, BC",
      radiusMiles,
    }),
    fetchPredictHQEvents({
      token: env.PREDICTHQ_TOKEN ?? "",
      lat: listingLat,
      lng: listingLng,
      radiusMiles,
    }),
    fetchTicketmasterEvents({
      apiKey: env.TICKETMASTER_API_KEY ?? "",
      lat: listingLat,
      lng: listingLng,
      radiusMiles,
    }),
    fetchYelpEvents(),
    fetchGooglePlacesEvents(),
    fetchTourismKelownaEvents({ overrideJson: env.FEED_MANUAL_OVERRIDE }),
  ] as const;

  const settled = opts?.inlineBudgetMs
    ? await withBudget(providerPromises, opts.inlineBudgetMs)
    : await Promise.allSettled(providerPromises);

  const [
    eventbriteR,
    predicthqR,
    ticketmasterR,
    yelpR,
    googleR,
    tkR,
  ] = settled;

  const statuses = {
    eventbrite: statusOf(eventbriteR),
    predicthq: statusOf(predicthqR),
    ticketmaster: statusOf(ticketmasterR),
    yelp: statusOf(yelpR),
    googlePlaces: statusOf(googleR),
    tourismKelowna: statusOf(tkR),
  };

  const raws: RawEvent[] = [
    ...eventsOf(eventbriteR),
    ...eventsOf(predicthqR),
    ...eventsOf(ticketmasterR),
    ...eventsOf(yelpR),
    ...eventsOf(googleR),
    ...eventsOf(tkR),
  ];

  const realProvidersFailed =
    statuses.eventbrite === "fail" &&
    statuses.predicthq === "fail" &&
    statuses.ticketmaster === "fail";

  if (realProvidersFailed && raws.length === 0) {
    const existing = await env.FEED_KV.get(KV_KEY_CURRENT);
    if (existing) {
      const parsed = safeParseFeed(existing);
      const eventCount = parsed?.events.length ?? 0;
      return {
        eventCount,
        providers: statuses,
        cacheKept: true,
        updatedAt: parsed?.updatedAt ?? new Date(0).toISOString(),
      };
    }
  }

  // Normalize.
  const events: Event[] = [];
  const coords: Array<{ lat: number | null; lng: number | null } | undefined> = [];
  const nowMs = Date.now();

  for (const raw of raws) {
    const ev = normalizeEvent(raw, { listingLat, listingLng });
    if (!ev) continue;

    // Drop events that have already started (past events shouldn't appear in
    // a "this week" feed). Tolerate small clock skew with -10min slack.
    const startMs = new Date(ev.startsAt).getTime();
    if (startMs < nowMs - 10 * 60 * 1000) continue;

    // Radius filter (events without coords pass through; see normalize.ts).
    const hasCoords = typeof raw.lat === "number" && typeof raw.lng === "number";
    if (hasCoords && ev.distanceMiles > radiusMiles) continue;

    events.push(ev);
    coords.push({ lat: raw.lat ?? null, lng: raw.lng ?? null });
  }

  const deduped = dedupe(events, coords);

  // Sort ascending by startsAt.
  deduped.sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0));

  // Hard cap.
  const capped = deduped.slice(0, MAX_EVENTS);

  const updatedAt = new Date().toISOString();
  const payload: FeedPayload = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt,
    events: capped,
  };

  await env.FEED_KV.put(KV_KEY_CURRENT, JSON.stringify(payload));

  return {
    eventCount: capped.length,
    providers: statuses,
    cacheKept: false,
    updatedAt,
  };
}

export async function readCachedFeed(kv: KVNamespace): Promise<FeedPayload | null> {
  const raw = await kv.get(KV_KEY_CURRENT);
  if (!raw) return null;
  return safeParseFeed(raw);
}

function safeParseFeed(raw: string): FeedPayload | null {
  try {
    return JSON.parse(raw) as FeedPayload;
  } catch {
    return null;
  }
}

function statusOf(r: PromiseSettledResult<ProviderResult>): ProviderStatus {
  if (r.status === "rejected") return "fail";
  return r.value.status;
}

function eventsOf(r: PromiseSettledResult<ProviderResult>): RawEvent[] {
  if (r.status === "rejected") return [];
  return r.value.events;
}

async function withBudget<T extends readonly Promise<ProviderResult>[]>(
  promises: T,
  budgetMs: number
): Promise<{ -readonly [K in keyof T]: PromiseSettledResult<Awaited<T[K]>> }> {
  const wrapped = promises.map((p) =>
    Promise.race<PromiseSettledResult<ProviderResult>>([
      p.then(
        (v) => ({ status: "fulfilled", value: v } as const),
        (reason) => ({ status: "rejected", reason } as const)
      ),
      new Promise<PromiseSettledResult<ProviderResult>>((resolve) =>
        setTimeout(
          () => resolve({ status: "rejected", reason: new Error("budget exceeded") }),
          budgetMs
        )
      ),
    ])
  );
  return (await Promise.all(wrapped)) as {
    -readonly [K in keyof T]: PromiseSettledResult<Awaited<T[K]>>;
  };
}
