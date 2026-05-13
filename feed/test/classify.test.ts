import { describe, it, expect } from "vitest";
import {
  classify,
  classifyEventbrite,
  classifyPredictHQ,
  classifyTicketmaster,
  classifyByKeywords,
} from "../src/lib/classify";

describe("classifyEventbrite", () => {
  it("maps known Eventbrite category_ids", () => {
    expect(classifyEventbrite("103")).toBe("music");
    expect(classifyEventbrite("110")).toBe("food-drink");
    expect(classifyEventbrite("113")).toBe("family");
    expect(classifyEventbrite("108")).toBe("sport");
    expect(classifyEventbrite("105")).toBe("arts");
    expect(classifyEventbrite("109")).toBe("outdoor");
    expect(classifyEventbrite("199")).toBe("other");
  });
  it("returns null for unknown id", () => {
    expect(classifyEventbrite("9999")).toBeNull();
    expect(classifyEventbrite(null)).toBeNull();
  });
});

describe("classifyPredictHQ", () => {
  it("maps PredictHQ categories", () => {
    expect(classifyPredictHQ("concerts")).toBe("music");
    expect(classifyPredictHQ("festivals")).toBe("other"); // generic — keyword classifier refines
    expect(classifyPredictHQ("performing-arts")).toBe("arts");
    expect(classifyPredictHQ("sports")).toBe("sport");
    expect(classifyPredictHQ("community")).toBe("market");
    expect(classifyPredictHQ("expos")).toBe("market");
  });
  it("is case insensitive", () => {
    expect(classifyPredictHQ("CONCERTS")).toBe("music");
  });
  it("returns null for unknown", () => {
    expect(classifyPredictHQ("aliens")).toBeNull();
  });
});

describe("classifyTicketmaster", () => {
  it("maps TM segments", () => {
    expect(classifyTicketmaster("Music")).toBe("music");
    expect(classifyTicketmaster("Sports")).toBe("sport");
    expect(classifyTicketmaster("Arts & Theatre")).toBe("arts");
    expect(classifyTicketmaster("Film")).toBe("arts");
    expect(classifyTicketmaster("Family")).toBe("family");
  });
  it("returns null for unknown", () => {
    expect(classifyTicketmaster("Aliens")).toBeNull();
  });
});

describe("classifyByKeywords", () => {
  it("detects wine", () => {
    expect(classifyByKeywords("Mission Hill Winery Tasting")).toBe("wine");
    expect(classifyByKeywords("Quails' Gate Vineyard Tour")).toBe("wine");
  });
  it("detects food-drink (brewery, cocktails)", () => {
    expect(classifyByKeywords("Tree Brewery Anniversary")).toBe("food-drink");
    expect(classifyByKeywords("Craft cocktail night")).toBe("food-drink");
  });
  it("detects market (farmers market, expos)", () => {
    expect(classifyByKeywords("Westside Farmers Market")).toBe("market");
    expect(classifyByKeywords("Annual home expo")).toBe("market");
  });
  it("detects arts (theatre, comedy, gallery)", () => {
    expect(classifyByKeywords("Stand-up comedy night")).toBe("arts");
    expect(classifyByKeywords("Theatre Kelowna spring season")).toBe("arts");
  });
  it("detects music", () => {
    expect(classifyByKeywords("Live music at the pub")).toBe("music");
    expect(classifyByKeywords("DJ set on the patio")).toBe("music");
  });
  it("detects sport", () => {
    expect(classifyByKeywords("Local soccer tournament")).toBe("sport");
    expect(classifyByKeywords("Half-marathon race day")).toBe("sport");
  });
  it("detects outdoor", () => {
    expect(classifyByKeywords("Knox Mountain hike")).toBe("outdoor");
    expect(classifyByKeywords("Group cycling event")).toBe("outdoor");
    expect(classifyByKeywords("Lakeside paddle morning")).toBe("outdoor");
  });
  it("detects family", () => {
    expect(classifyByKeywords("Kids day at the park")).toBe("family");
  });
  it("returns null when nothing matches", () => {
    expect(classifyByKeywords("Quarterly board meeting")).toBeNull();
  });
});

describe("classify (top-level)", () => {
  it("prefers a NARROW provider hint over keywords", () => {
    const out = classify({
      provider: "ticketmaster",
      providerHint: "Sports",
      title: "Live music concert",
    });
    expect(out).toBe("sport");
  });

  it("falls back to keywords when provider hint maps to 'other' (e.g. PredictHQ festivals)", () => {
    const out = classify({
      provider: "predicthq",
      providerHint: "festivals",
      title: "Okanagan Wine Festival",
    });
    expect(out).toBe("wine"); // keyword refines the generic 'festivals' → 'other'
  });

  it("falls back to keywords when hint is unknown", () => {
    const out = classify({
      provider: "ticketmaster",
      providerHint: "Unknown",
      title: "Winery tasting",
    });
    expect(out).toBe("wine");
  });

  it("falls back to 'other' as last resort", () => {
    const out = classify({
      provider: "eventbrite",
      providerHint: null,
      title: "Quarterly all-hands",
      description: null,
    });
    expect(out).toBe("other");
  });

  it("uses description for keyword fallback", () => {
    const out = classify({
      provider: "predicthq",
      providerHint: "unknown",
      title: "Tour 2026",
      description: "Live band performing at the local venue",
    });
    expect(out).toBe("music");
  });
});
