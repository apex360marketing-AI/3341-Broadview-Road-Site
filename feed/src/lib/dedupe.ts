/**
 * Cross-provider dedupe.
 *
 * The same concert can show up on Ticketmaster + Eventbrite + PredictHQ. We
 * collapse them with a "title + startsAt + nearby location" fuzzy match.
 *
 * Rules:
 *  - Title comparison is normalized: lowercased, punctuation stripped,
 *    leading articles ("the", "a", "an") removed, whitespace collapsed.
 *  - startsAt matches if the two start times are within ±60 minutes.
 *  - Location matches if both events have coords AND haversine ≤ 0.5 miles,
 *    OR if either event lacks coords (we treat unknown as "could match").
 *
 * Priority order when collapsing (keep the BEST record):
 *   1. Ticketmaster — most authoritative for ticketed shows
 *   2. Eventbrite   — best for descriptions + images
 *   3. PredictHQ    — best coverage but thinnest metadata
 *   4. Tourism Kelowna / Manual — operator override always wins over scrapers
 *      but loses to ticketing providers (Ticketmaster has the live SKU)
 *
 * Manual wins over auto-discovery → reordered below.
 */
import type { Event } from "../schema";
import { haversineMiles } from "./haversine";

const SOURCE_PRIORITY: Record<string, number> = {
  Manual: 100,
  "Tourism Kelowna": 90,
  Ticketmaster: 80,
  Eventbrite: 70,
  PredictHQ: 60,
};

const TITLE_TIME_WINDOW_MS = 60 * 60 * 1000; // ±60 min
const LOCATION_FUZZ_MILES = 0.5;

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // strip punctuation, keep unicode letters/digits
    .replace(/^\s*(the|a|an)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface EventWithCoords extends Event {
  _lat?: number;
  _lng?: number;
}

function timesMatch(aIso: string, bIso: string): boolean {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (isNaN(a) || isNaN(b)) return false;
  return Math.abs(a - b) <= TITLE_TIME_WINDOW_MS;
}

function locationsMatch(a: EventWithCoords, b: EventWithCoords): boolean {
  const aHas = typeof a._lat === "number" && typeof a._lng === "number";
  const bHas = typeof b._lat === "number" && typeof b._lng === "number";
  if (!aHas || !bHas) return true; // unknown → possible match (don't block dedupe)
  const d = haversineMiles(a._lat as number, a._lng as number, b._lat as number, b._lng as number);
  return d <= LOCATION_FUZZ_MILES;
}

/**
 * Dedupe events. Optional `coords` parallel array lets the caller pass
 * provider coords for the location-fuzz check; if omitted, we rely on
 * title + time only.
 */
export function dedupe(
  events: Event[],
  coords?: Array<{ lat: number | null; lng: number | null } | undefined>
): Event[] {
  const decorated: EventWithCoords[] = events.map((e, i) => {
    const c = coords?.[i];
    const lat = c?.lat;
    const lng = c?.lng;
    return {
      ...e,
      ...(typeof lat === "number" && typeof lng === "number"
        ? { _lat: lat, _lng: lng }
        : {}),
    };
  });

  const kept: EventWithCoords[] = [];

  for (const candidate of decorated) {
    const candidateNormTitle = normalizeTitle(candidate.title);
    const dupIdx = kept.findIndex(
      (k) =>
        normalizeTitle(k.title) === candidateNormTitle &&
        timesMatch(k.startsAt, candidate.startsAt) &&
        locationsMatch(k, candidate)
    );

    if (dupIdx === -1) {
      kept.push(candidate);
      continue;
    }

    // Collision. Keep the higher-priority source.
    const incumbent = kept[dupIdx]!;
    const incumbentScore = SOURCE_PRIORITY[String(incumbent.source)] ?? 0;
    const candidateScore = SOURCE_PRIORITY[String(candidate.source)] ?? 0;
    if (candidateScore > incumbentScore) {
      kept[dupIdx] = candidate;
    }
    // else: drop candidate, incumbent wins
  }

  // Strip the internal _lat/_lng before returning.
  return kept.map(({ _lat, _lng, ...rest }) => rest);
}
