import { describe, it, expect } from "vitest";
import { haversineMiles, roundMiles } from "../src/lib/haversine";

// VALORA listing
const LAT = 49.8344;
const LNG = -119.6217;

describe("haversineMiles", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMiles(LAT, LNG, LAT, LNG)).toBe(0);
  });

  it("West Kelowna → Mission Hill Winery (~1.4mi, ±0.3mi)", () => {
    // Mission Hill Winery: ~49.8242, -119.5839
    const d = haversineMiles(LAT, LNG, 49.8242, -119.5839);
    expect(d).toBeGreaterThan(1.0);
    expect(d).toBeLessThan(2.5);
  });

  it("West Kelowna → downtown Kelowna (~4-6mi)", () => {
    // Downtown Kelowna: ~49.8880, -119.4960
    const d = haversineMiles(LAT, LNG, 49.888, -119.496);
    expect(d).toBeGreaterThan(4);
    expect(d).toBeLessThan(7);
  });

  it("West Kelowna → Vancouver (~155-175mi)", () => {
    // Vancouver: ~49.2827, -123.1207
    const d = haversineMiles(LAT, LNG, 49.2827, -123.1207);
    expect(d).toBeGreaterThan(150);
    expect(d).toBeLessThan(180);
  });

  it("is symmetric: d(A,B) === d(B,A)", () => {
    const a = haversineMiles(LAT, LNG, 49.888, -119.496);
    const b = haversineMiles(49.888, -119.496, LAT, LNG);
    expect(a).toBeCloseTo(b, 6);
  });

  it("handles antipodal-ish points without NaN", () => {
    const d = haversineMiles(LAT, LNG, -LAT, LNG + 180);
    expect(isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(12000);
  });
});

describe("roundMiles", () => {
  it("rounds to 1 decimal", () => {
    expect(roundMiles(1.23456)).toBe(1.2);
    expect(roundMiles(1.25)).toBe(1.3);
    expect(roundMiles(0.04)).toBe(0);
    expect(roundMiles(0.05)).toBe(0.1);
  });
});
