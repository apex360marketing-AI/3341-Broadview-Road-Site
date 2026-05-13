/**
 * Integration-ish test for the radius-filter + sort behavior in refresh.ts.
 *
 * We don't spin up the whole Worker (no Cloudflare runtime in vitest); we
 * verify the same logic by running normalizeEvent → filter → sort over a
 * synthetic dataset.
 */
import { describe, it, expect } from "vitest";
import { normalizeEvent } from "../src/lib/normalize";
import { dedupe } from "../src/lib/dedupe";
import type { RawEvent, Event } from "../src/schema";

const CTX = { listingLat: 49.8344, listingLng: -119.6217 };
// 30 km ≈ 18.6 mi (matches the prod RADIUS_KM=30 in wrangler.toml).
const RADIUS_MILES = 18.6;

function pipeline(raws: RawEvent[]): Event[] {
  const events: Event[] = [];
  const coords: Array<{ lat: number | null; lng: number | null } | undefined> = [];
  for (const raw of raws) {
    const ev = normalizeEvent(raw, CTX);
    if (!ev) continue;
    const hasCoords = typeof raw.lat === "number" && typeof raw.lng === "number";
    if (hasCoords && ev.distanceMiles > RADIUS_MILES) continue;
    events.push(ev);
    coords.push({ lat: raw.lat ?? null, lng: raw.lng ?? null });
  }
  const deduped = dedupe(events, coords);
  deduped.sort((a, b) =>
    a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0
  );
  return deduped;
}

describe("radius filter + sort pipeline", () => {
  it("drops events outside the radius", () => {
    const raws: RawEvent[] = [
      // Vancouver — far outside 50mi
      {
        providerId: "v1",
        source: "Ticketmaster",
        title: "Vancouver Show",
        url: "https://example.com/vancouver",
        startsAt: "2026-05-30T19:00:00Z",
        lat: 49.2827,
        lng: -123.1207,
      },
      // West Kelowna — inside
      {
        providerId: "wk1",
        source: "Eventbrite",
        title: "Local Tasting",
        url: "https://example.com/local",
        startsAt: "2026-05-30T19:00:00Z",
        lat: 49.8242,
        lng: -119.5839,
      },
    ];
    const out = pipeline(raws);
    expect(out.map((e) => e.title)).toEqual(["Local Tasting"]);
  });

  it("keeps events lacking coords (can't filter what we don't measure)", () => {
    const raws: RawEvent[] = [
      {
        providerId: "x",
        source: "Ticketmaster",
        title: "No Coords Show",
        url: "https://example.com/x",
        startsAt: "2026-05-30T19:00:00Z",
      },
    ];
    const out = pipeline(raws);
    expect(out.length).toBe(1);
  });

  it("sorts ascending by startsAt", () => {
    const raws: RawEvent[] = [
      {
        providerId: "a",
        source: "Eventbrite",
        title: "Late",
        url: "https://example.com/a",
        startsAt: "2026-08-30T19:00:00Z",
        lat: 49.8344,
        lng: -119.6217,
      },
      {
        providerId: "b",
        source: "Eventbrite",
        title: "Early",
        url: "https://example.com/b",
        startsAt: "2026-05-30T19:00:00Z",
        lat: 49.8344,
        lng: -119.6217,
      },
      {
        providerId: "c",
        source: "Eventbrite",
        title: "Middle",
        url: "https://example.com/c",
        startsAt: "2026-07-04T19:00:00Z",
        lat: 49.8344,
        lng: -119.6217,
      },
    ];
    const out = pipeline(raws);
    expect(out.map((e) => e.title)).toEqual(["Early", "Middle", "Late"]);
  });

  it("dedupes after normalization", () => {
    const raws: RawEvent[] = [
      {
        providerId: "a",
        source: "Eventbrite",
        title: "Adele Live",
        url: "https://eventbrite.com/a",
        startsAt: "2026-05-30T19:00:00Z",
        lat: 49.888,
        lng: -119.496,
      },
      {
        providerId: "b",
        source: "Ticketmaster",
        title: "Adele Live!",
        url: "https://ticketmaster.com/b",
        startsAt: "2026-05-30T19:15:00Z",
        lat: 49.8881,
        lng: -119.4961,
      },
    ];
    const out = pipeline(raws);
    expect(out.length).toBe(1);
    expect(out[0]!.source).toBe("Ticketmaster");
  });

  it("handles an empty input cleanly", () => {
    expect(pipeline([])).toEqual([]);
  });

  it("drops events with bad URLs but keeps the rest", () => {
    const raws: RawEvent[] = [
      {
        providerId: "bad",
        source: "Eventbrite",
        title: "Bad",
        url: "javascript:alert(1)",
        startsAt: "2026-05-30T19:00:00Z",
      },
      {
        providerId: "good",
        source: "Eventbrite",
        title: "Good",
        url: "https://example.com/good",
        startsAt: "2026-05-30T19:00:00Z",
        lat: 49.8344,
        lng: -119.6217,
      },
    ];
    const out = pipeline(raws);
    expect(out.length).toBe(1);
    expect(out[0]!.title).toBe("Good");
  });
});
