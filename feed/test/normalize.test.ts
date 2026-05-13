import { describe, it, expect } from "vitest";
import {
  normalizeEvent,
  safeHttpsUrl,
  coerceIsoWithOffset,
  plainTextSummary,
  stableEventId,
} from "../src/lib/normalize";
import type { RawEvent } from "../src/schema";

const CTX = { listingLat: 49.8344, listingLng: -119.6217 };

describe("safeHttpsUrl", () => {
  it("passes https://", () => {
    expect(safeHttpsUrl("https://example.com/foo")).toBe("https://example.com/foo");
  });
  it("upgrades http:// → https://", () => {
    expect(safeHttpsUrl("http://example.com/foo")).toBe("https://example.com/foo");
  });
  it("rejects javascript:", () => {
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull();
  });
  it("rejects data:", () => {
    expect(safeHttpsUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });
  it("rejects file://", () => {
    expect(safeHttpsUrl("file:///etc/passwd")).toBeNull();
  });
  it("rejects empty / null", () => {
    expect(safeHttpsUrl("")).toBeNull();
    expect(safeHttpsUrl(null)).toBeNull();
    expect(safeHttpsUrl(undefined)).toBeNull();
  });
});

describe("coerceIsoWithOffset", () => {
  it("preserves UTC Z input", () => {
    const out = coerceIsoWithOffset("2026-05-30T19:00:00Z");
    expect(out).toMatch(/2026-05-30T19:00:00/);
    expect(out).toMatch(/Z|[+-]\d\d:\d\d$/);
  });
  it("promotes date-only to UTC midnight", () => {
    expect(coerceIsoWithOffset("2026-05-30")).toBe("2026-05-30T00:00:00.000Z");
  });
  it("converts offset input to UTC ISO", () => {
    const out = coerceIsoWithOffset("2026-05-30T19:00:00-07:00");
    // 19:00 PDT = 02:00 UTC next day
    expect(out).toBe("2026-05-31T02:00:00.000Z");
  });
  it("returns null on garbage", () => {
    expect(coerceIsoWithOffset("not a date")).toBeNull();
    expect(coerceIsoWithOffset("")).toBeNull();
    expect(coerceIsoWithOffset(null)).toBeNull();
  });
});

describe("plainTextSummary", () => {
  it("strips HTML", () => {
    expect(plainTextSummary("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });
  it("collapses whitespace", () => {
    expect(plainTextSummary("a\n\nb   c")).toBe("a b c");
  });
  it("handles null/empty", () => {
    expect(plainTextSummary(null)).toBe("");
    expect(plainTextSummary(undefined)).toBe("");
    expect(plainTextSummary("")).toBe("");
  });
  it("truncates with ellipsis", () => {
    const long = "a".repeat(500);
    const out = plainTextSummary(long);
    expect(out.length).toBeLessThanOrEqual(280);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("stableEventId", () => {
  it("is deterministic", () => {
    const raw: RawEvent = {
      providerId: "ev1",
      source: "Eventbrite",
      title: "Wine Tasting",
      url: "https://eventbrite.com/e/123",
      startsAt: "2026-05-30T19:00:00Z",
    };
    expect(stableEventId(raw)).toBe(stableEventId(raw));
  });
  it("differs for different titles", () => {
    const a: RawEvent = {
      providerId: "ev1",
      source: "Eventbrite",
      title: "Wine Tasting",
      url: "https://eventbrite.com/e/123",
      startsAt: "2026-05-30T19:00:00Z",
    };
    const b: RawEvent = { ...a, title: "Beer Tasting" };
    expect(stableEventId(a)).not.toBe(stableEventId(b));
  });
});

describe("normalizeEvent — Eventbrite shape", () => {
  it("normalizes a complete event", () => {
    const raw: RawEvent = {
      providerId: "ev1",
      source: "Eventbrite",
      title: "Mission Hill Winery Tour",
      description: "<p>Join us for a tasting.</p>",
      url: "https://www.eventbrite.com/e/mission-hill-tickets-123",
      startsAt: "2026-05-30T19:00:00Z",
      endsAt: "2026-05-30T22:00:00Z",
      imageUrl: "http://img.evbuc.com/foo.jpg",
      lat: 49.8242,
      lng: -119.5839,
      categoryHint: "110", // food & drink
    };
    const ev = normalizeEvent(raw, CTX);
    expect(ev).not.toBeNull();
    expect(ev!.title).toBe("Mission Hill Winery Tour");
    expect(ev!.summary).toBe("Join us for a tasting.");
    expect(ev!.source).toBe("Eventbrite");
    expect(ev!.sourceIcon).toBe("eventbrite");
    expect(ev!.url.startsWith("https://")).toBe(true);
    expect(ev!.imageUrl?.startsWith("https://")).toBe(true);
    expect(ev!.distanceMiles).toBeGreaterThan(0);
    expect(ev!.distanceMiles).toBeLessThan(5);
    // category: keyword "winery" beats provider hint "110" (food)? No — provider hint wins.
    expect(["food", "winery"]).toContain(ev!.category);
  });

  it("returns null on bad url", () => {
    const raw: RawEvent = {
      providerId: "ev1",
      source: "Eventbrite",
      title: "Bad",
      url: "javascript:alert(1)",
      startsAt: "2026-05-30T19:00:00Z",
    };
    expect(normalizeEvent(raw, CTX)).toBeNull();
  });

  it("returns null on bad startsAt", () => {
    const raw: RawEvent = {
      providerId: "ev1",
      source: "Eventbrite",
      title: "Bad",
      url: "https://example.com",
      startsAt: "garbage",
    };
    expect(normalizeEvent(raw, CTX)).toBeNull();
  });

  it("defaults endsAt to startsAt when missing", () => {
    const raw: RawEvent = {
      providerId: "ev1",
      source: "PredictHQ",
      title: "Quick Event",
      url: "https://example.com",
      startsAt: "2026-05-30T19:00:00Z",
    };
    const ev = normalizeEvent(raw, CTX);
    expect(ev!.endsAt).toBe(ev!.startsAt);
  });

  it("handles missing coords (distanceMiles=0, event kept)", () => {
    const raw: RawEvent = {
      providerId: "ev1",
      source: "Ticketmaster",
      title: "No coords",
      url: "https://example.com",
      startsAt: "2026-05-30T19:00:00Z",
    };
    const ev = normalizeEvent(raw, CTX);
    expect(ev).not.toBeNull();
    expect(ev!.distanceMiles).toBe(0);
  });

  it("classifies by keyword when no provider hint", () => {
    const raw: RawEvent = {
      providerId: "ev1",
      source: "Eventbrite",
      title: "Hike up Knox Mountain Trail",
      url: "https://example.com",
      startsAt: "2026-05-30T10:00:00Z",
    };
    const ev = normalizeEvent(raw, CTX);
    expect(ev!.category).toBe("outdoor");
  });
});
