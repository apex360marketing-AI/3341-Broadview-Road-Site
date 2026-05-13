/**
 * Tourism Kelowna provider — STUB with MANUAL OVERRIDE.
 *
 * Tourism Kelowna publishes events on their website but does NOT expose a
 * public JSON feed or API. Scraping their site is fragile and against their
 * TOS. This file is a structural placeholder that documents the gap.
 *
 * MANUAL OVERRIDE PATH
 * --------------------
 * The Worker reads a JSON env var `FEED_MANUAL_OVERRIDE` (set via
 * `wrangler secret put FEED_MANUAL_OVERRIDE`). The value must be a JSON
 * array of RawEvent-shaped objects. Each entry is spliced into the feed
 * exactly like a provider result, so the operator can bolt on bespoke
 * events (e.g. a winery tasting that doesn't show up on Eventbrite).
 *
 * Example value (the WHOLE thing is one JSON string passed to wrangler):
 *   [
 *     {
 *       "providerId":"tk-manual-001",
 *       "source":"Tourism Kelowna",
 *       "title":"Mission Hill Estate — Summer Solstice Tasting",
 *       "description":"Curated 6-course pairing on the terrace.",
 *       "url":"https://www.missionhillwinery.com/event/solstice-2026",
 *       "startsAt":"2026-06-21T19:00:00-07:00",
 *       "endsAt":"2026-06-21T22:00:00-07:00",
 *       "imageUrl":"https://example.com/mission-hill.jpg",
 *       "lat":49.8242,
 *       "lng":-119.5839,
 *       "categoryHint":"winery"
 *     }
 *   ]
 *
 * If the env var is missing or unparseable, the provider returns `stub`
 * with an empty events array — non-fatal.
 */
import type { RawEvent } from "../schema";
import type { ProviderResult } from "./types";

export async function fetchTourismKelownaEvents(args: {
  overrideJson?: string | undefined;
}): Promise<ProviderResult> {
  if (!args.overrideJson) {
    return { status: "stub", events: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(args.overrideJson);
  } catch (err) {
    console.warn("[tourism-kelowna] FEED_MANUAL_OVERRIDE not valid JSON", err);
    return { status: "stub", events: [] };
  }

  if (!Array.isArray(parsed)) {
    console.warn("[tourism-kelowna] FEED_MANUAL_OVERRIDE must be an array");
    return { status: "stub", events: [] };
  }

  const events: RawEvent[] = [];
  for (const item of parsed) {
    if (!isLikelyRawEvent(item)) continue;
    events.push({
      providerId: String(item.providerId),
      source: (item.source as "Tourism Kelowna" | "Manual") ?? "Tourism Kelowna",
      title: String(item.title),
      description: item.description ?? null,
      url: String(item.url),
      startsAt: String(item.startsAt),
      endsAt: item.endsAt ?? null,
      imageUrl: item.imageUrl ?? null,
      lat: typeof item.lat === "number" ? item.lat : null,
      lng: typeof item.lng === "number" ? item.lng : null,
      categoryHint: item.categoryHint ?? null,
    });
  }

  return { status: events.length > 0 ? "ok" : "stub", events };
}

function isLikelyRawEvent(x: unknown): x is Record<string, unknown> & {
  providerId: string;
  title: string;
  url: string;
  startsAt: string;
} {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.providerId === "string" &&
    typeof o.title === "string" &&
    typeof o.url === "string" &&
    typeof o.startsAt === "string"
  );
}
