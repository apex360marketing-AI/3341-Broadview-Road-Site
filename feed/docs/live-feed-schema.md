# Live Feed — Frozen Schema Contract

**Version:** `1.0.0`
**Status:** FROZEN. Any breaking change MUST bump `schemaVersion` and ship a coordinated front-end update.

The VALORA static site fetches this payload from the Worker's `GET /feed` endpoint and renders the "On The Radar — This Week" section. Both producer (Worker) and consumer (site) validate against the Zod schema in `src/schema.ts`.

## Top-level payload

```ts
{
  schemaVersion: "1.0.0",
  updatedAt: "2026-05-12T18:00:00.000Z" | null,  // ISO 8601 UTC; null on cold start
  events: Event[]                                 // hard cap: 30, sorted ascending by startsAt
}
```

## `Event`

| Field           | Type                                                                                                  | Notes                                                                                                |
|-----------------|-------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| `id`            | string                                                                                                | Stable hash. Same event across two refreshes returns the same id. Safe for React keys + dedupe.      |
| `title`         | string (1–120 chars)                                                                                  | Public-facing event name. Truncated with ellipsis if upstream is longer.                             |
| `summary`       | string (≤ 280 chars)                                                                                  | Plain text. HTML stripped. May be empty.                                                             |
| `source`        | `"Eventbrite" \| "PredictHQ" \| "Ticketmaster" \| "Tourism Kelowna" \| "Manual" \| string`            | Human-readable. Stable per provider.                                                                 |
| `sourceIcon`    | `"eventbrite" \| "predicthq" \| "ticketmaster" \| "other"`                                            | Front-end maps to an icon asset.                                                                     |
| `url`           | string (https only)                                                                                   | Where to buy tickets / learn more. `https://` enforced. `javascript:`, `data:`, `http://` rejected (http auto-upgraded). |
| `startsAt`      | string (ISO 8601 UTC, e.g. `"2026-05-30T19:00:00.000Z"`)                                              | Always present. Always emitted as `Z`-suffixed UTC.                                                  |
| `endsAt`        | string (ISO 8601 UTC) \| null                                                                         | Equals `startsAt` for instant events when known. May be `null` if upstream didn't supply it.         |
| `imageUrl`      | string (https only) \| null                                                                           | Card image. Null when provider didn't supply one.                                                    |
| `distanceMiles` | number (≥ 0, 2 decimals)                                                                              | Haversine miles from VALORA listing. `0` if provider lacked venue coords.                            |
| `category`      | `"music" \| "food-drink" \| "wine" \| "outdoor" \| "family" \| "arts" \| "market" \| "sport" \| "other"` | Front-end uses for filter chips + iconography.                                                       |

### Category taxonomy

The 9 categories collapse every provider's native taxonomy into a single small set:

| Category    | Covers                                                                    |
|-------------|---------------------------------------------------------------------------|
| `music`     | Concerts, DJ sets, gigs, live bands, music festivals                      |
| `food-drink`| Culinary events, breweries, distilleries, food trucks, paired dinners     |
| `wine`      | Winery tastings, vineyard tours, wine festivals, sommelier events         |
| `outdoor`   | Hikes, trail events, ski/snowboard, cycling, paddle, kayak                |
| `family`    | Kid-focused programming, family events, school holidays                   |
| `arts`      | Theatre, comedy, gallery openings, performing arts, ballet, opera, film   |
| `market`    | Farmers' markets, craft markets, expos, community fairs                   |
| `sport`     | Sporting events, tournaments, races, playoffs                             |
| `other`     | Everything else                                                           |

## Response headers (from `GET /feed`)

| Header                        | Value                                                                |
|-------------------------------|----------------------------------------------------------------------|
| `Cache-Control`               | `public, max-age=900` — browsers cache the JSON for 15 minutes.      |
| `X-Last-Updated`              | ISO timestamp of the last successful refresh, or empty string on cold. |
| `X-Feed-Status`               | `ok` \| `stale` \| `cold` (see below).                               |
| `Access-Control-Allow-Origin` | `*` — public read.                                                   |

### `X-Feed-Status` values

- `ok` — fresh data, refresh within the last 12 hours.
- `stale` — cached data older than 12 hours; ALL real providers failed on last refresh.
- `cold` — no cache available and inline refresh didn't produce anything (typically only seen on a brand-new Worker before the first cron tick).

## URL allowlist

Both `url` and `imageUrl` must start with `https://`. Anything else is rejected at the normalizer (event is dropped with a `console.warn`). The normalizer auto-upgrades bare `http://` URLs to `https://` because most provider image CDNs serve TLS regardless.

## ID stability

`id` is a deterministic hash of `source + providerId + normalized-title + startsAt`. Two refreshes of the same event produce the same `id`. This is intentional so the front-end can:

- Use `id` as a stable React key
- Dedupe across client-side caches
- Correlate analytics events across page loads

`id` is NOT a cryptographic identifier — do not use it for security purposes.

## Filtering rules (Worker-side)

- Geo: events outside `RADIUS_KM` (default 30 km, configured in `wrangler.toml`) are dropped. Events without coords pass through (we can't measure what providers don't give us).
- Time: events whose `startsAt` is in the past (with 10-minute slack) are dropped — this is a "this week" feed, not a history archive.
- Cap: 30 events maximum. Sorted ascending by `startsAt` before the cap is applied.
