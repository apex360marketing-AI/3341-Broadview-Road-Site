/**
 * Yelp provider — STUB.
 *
 * Yelp shut down their public Events API in 2024 and did not replace it.
 * The Yelp Fusion API can still return business data (restaurants, etc.)
 * which is useful for the "What's Nearby" curated section but not for the
 * live events feed.
 *
 * This file is kept as a structural placeholder so the provider list is
 * complete. To revive: subscribe to a third-party event aggregator
 * (eventgo.io, allevents.in) or curate manually via the Tourism Kelowna
 * override path.
 */
import type { ProviderResult } from "./types";

export async function fetchYelpEvents(): Promise<ProviderResult> {
  return { status: "stub", events: [] };
}
