/**
 * Google Places provider — STUB.
 *
 * Google Places API returns places (businesses, points of interest) but has
 * NO events endpoint. Google Events used to surface in Search results but
 * was never exposed as a public API; SerpAPI scrapes it but that's against
 * Google's TOS and a paid service.
 *
 * This file is kept as a structural placeholder so the provider list is
 * complete and the design space is documented. To revive: use a sanctioned
 * scraping partner (SerpAPI Events, BrightData) — operator must accept the
 * legal/cost tradeoff.
 */
import type { ProviderResult } from "./types";

export async function fetchGooglePlacesEvents(): Promise<ProviderResult> {
  return { status: "stub", events: [] };
}
