import { describe, it, expect } from "vitest";
import { dedupe, normalizeTitle } from "../src/lib/dedupe";
import type { Event } from "../src/schema";

const baseEvent = (overrides: Partial<Event>): Event => ({
  id: "x",
  title: "Sample",
  summary: "",
  source: "Eventbrite",
  sourceIcon: "eventbrite",
  url: "https://example.com",
  startsAt: "2026-05-30T19:00:00.000Z",
  endsAt: "2026-05-30T22:00:00.000Z",
  imageUrl: null,
  distanceMiles: 1.2,
  category: "music",
  ...overrides,
});

describe("normalizeTitle", () => {
  it("lowercases + strips punctuation", () => {
    expect(normalizeTitle("Hello, World!")).toBe("hello world");
  });
  it("drops leading article", () => {
    expect(normalizeTitle("The Beatles Tribute")).toBe("beatles tribute");
    expect(normalizeTitle("A Night with Adele")).toBe("night with adele");
  });
  it("collapses whitespace", () => {
    expect(normalizeTitle("  too    many   spaces  ")).toBe("too many spaces");
  });
});

describe("dedupe", () => {
  it("collapses same title + same time + nearby coords", () => {
    const a = baseEvent({ id: "a", title: "Adele Live", source: "Ticketmaster" });
    const b = baseEvent({ id: "b", title: "Adele Live!", source: "Eventbrite" });
    // Same time, same venue coords ≈ same location
    const out = dedupe([a, b], [
      { lat: 49.888, lng: -119.496 },
      { lat: 49.8881, lng: -119.4961 }, // <0.1mi
    ]);
    expect(out.length).toBe(1);
    // Ticketmaster has higher priority — keeps the ticketed source
    expect(out[0]!.source).toBe("Ticketmaster");
  });

  it("keeps events with different titles", () => {
    const a = baseEvent({ id: "a", title: "Adele Live" });
    const b = baseEvent({ id: "b", title: "Beyonce Live" });
    const out = dedupe([a, b]);
    expect(out.length).toBe(2);
  });

  it("keeps same title but different starts", () => {
    const a = baseEvent({ id: "a", title: "Adele Live", startsAt: "2026-05-30T19:00:00.000Z" });
    const b = baseEvent({ id: "b", title: "Adele Live", startsAt: "2026-06-30T19:00:00.000Z" });
    const out = dedupe([a, b]);
    expect(out.length).toBe(2);
  });

  it("allows ±60min slop on startsAt", () => {
    const a = baseEvent({ id: "a", title: "Show", startsAt: "2026-05-30T19:00:00.000Z" });
    const b = baseEvent({ id: "b", title: "Show", startsAt: "2026-05-30T19:30:00.000Z" });
    const out = dedupe([a, b]);
    expect(out.length).toBe(1);
  });

  it("does NOT collapse beyond ±60min", () => {
    const a = baseEvent({ id: "a", title: "Show", startsAt: "2026-05-30T19:00:00.000Z" });
    const b = baseEvent({ id: "b", title: "Show", startsAt: "2026-05-30T21:30:00.000Z" });
    const out = dedupe([a, b]);
    expect(out.length).toBe(2);
  });

  it("rejects collapse when coords are far apart", () => {
    const a = baseEvent({ id: "a", title: "Same Name", source: "Eventbrite" });
    const b = baseEvent({ id: "b", title: "Same Name", source: "Ticketmaster" });
    const out = dedupe([a, b], [
      { lat: 49.8, lng: -119.6 },
      { lat: 50.5, lng: -119.6 }, // ~48mi apart — too far
    ]);
    expect(out.length).toBe(2);
  });

  it("Manual override beats Ticketmaster on collisions", () => {
    const tm = baseEvent({ id: "tm", title: "Festival", source: "Ticketmaster" });
    const manual = baseEvent({ id: "manual", title: "Festival", source: "Tourism Kelowna" });
    const out = dedupe([tm, manual]);
    expect(out.length).toBe(1);
    expect(out[0]!.source).toBe("Tourism Kelowna");
  });

  it("treats missing coords as 'unknown — could match'", () => {
    const a = baseEvent({ id: "a", title: "Show", source: "PredictHQ" });
    const b = baseEvent({ id: "b", title: "Show", source: "Ticketmaster" });
    // a has no coords, b has coords
    const out = dedupe([a, b], [undefined, { lat: 49.888, lng: -119.496 }]);
    expect(out.length).toBe(1);
    expect(out[0]!.source).toBe("Ticketmaster");
  });

  it("preserves order of unique events", () => {
    const a = baseEvent({ id: "a", title: "A" });
    const b = baseEvent({ id: "b", title: "B" });
    const c = baseEvent({ id: "c", title: "C" });
    const out = dedupe([a, b, c]);
    expect(out.map((e) => e.title)).toEqual(["A", "B", "C"]);
  });
});
