import type { RawEvent } from "../schema";

/**
 * Common return shape for every provider adapter.
 *
 *  - `ok`   : the call succeeded (events may be empty if the area is quiet)
 *  - `fail` : 4xx/5xx/network/JSON failure — refresh() logs and excludes us
 *  - `stub` : provider is intentionally a placeholder (Yelp, Google Places,
 *             Tourism Kelowna) — refresh() treats this the same as `ok` but
 *             surfaces it in /health so the operator knows what's wired up
 */
export interface ProviderResult {
  status: "ok" | "fail" | "stub";
  events: RawEvent[];
  error?: string;
}
