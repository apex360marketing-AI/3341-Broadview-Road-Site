# VALORA Live Events Feed — Cloudflare Worker

Self-contained backend that aggregates local events from Eventbrite, PredictHQ, and Ticketmaster, normalizes them into a frozen JSON schema, and serves them over `/feed` for the VALORA short-term-rental site.

- Cron refresh four times daily (00:00, 06:00, 12:00, 18:00 UTC)
- KV-cached payload, served with `Cache-Control: public, max-age=900` (15 min browser cache)
- `X-Refresh-Key` header auth + per-IP rate-limit (6/hour) on manual refresh
- Hard cap: 30 events, sorted ascending by `startsAt`, dropped if past
- Free-tier friendly (Cloudflare Workers free tier = 100K req/day; we use 4 cron refreshes/day from the Worker itself)

---

## What this is, in one paragraph

The site renders an "On The Radar — This Week" section. The cards come from this Worker. Real events from real APIs, cached + normalized into a single contract documented in `docs/live-feed-schema.md`. If providers fail, the cached data is served (marked stale). If everything's brand new, the site sees an empty array and renders the empty-state.

---

## Project layout

```
feed/
├── package.json
├── wrangler.toml
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts              Worker entry — routes + scheduled handler
│   ├── schema.ts             Zod schema (frozen output contract)
│   ├── auth.ts               X-Refresh-Key header check
│   ├── ratelimit.ts          KV-backed per-IP rate limit (6/hour)
│   ├── refresh.ts            Aggregation pipeline
│   ├── providers/
│   │   ├── eventbrite.ts     REAL provider
│   │   ├── predicthq.ts      REAL provider
│   │   ├── ticketmaster.ts   REAL provider
│   │   ├── yelp.ts           STUB — Yelp killed Events API in 2024 (see comment block)
│   │   ├── google-places.ts  STUB — Google has no events API (see comment block)
│   │   └── tourism-kelowna.ts STUB + manual-override path
│   └── lib/                  haversine, normalize, dedupe, classify
├── test/                     Vitest suite
└── docs/
    ├── live-feed-schema.md
    ├── live-feed-sample.json
    └── GHL-LIVE-FEED-INTEGRATION.md
```

---

## Deploy — step by step

### 1. Sign up for free API keys

You need three. All free.

**Eventbrite** — https://www.eventbrite.com/platform/api
1. Sign in (or sign up).
2. Click **Create an App**.
3. Fill in any name + URL (use your STR site URL).
4. After creation, open the app's detail page.
5. Copy the **Private Token**. (Not the OAuth client — the personal-use token.)

**PredictHQ** — https://www.predicthq.com/api
1. Click **Get free API access** on the marketing site.
2. Sign up with a work email.
3. Confirm email → log in to the dashboard.
4. Go to **Settings → API tokens**.
5. Copy the **Access Token**.

**Ticketmaster Discovery API** — https://developer-acct.ticketmaster.com
1. Click **Sign Up**.
2. Verify email → log in.
3. Click **Add a New App**.
4. Fill in any name + description (e.g. "VALORA STR feed").
5. After creation, copy the **Consumer Key** (the API key — not the secret).

### 2. Install Wrangler (Cloudflare's CLI)

```sh
npm install -g wrangler
```

### 3. Authenticate

```sh
wrangler login
```

This opens a browser tab. Sign in to your Cloudflare account (sign up at https://dash.cloudflare.com if you don't have one — free tier is fine).

### 4. Install local deps

```sh
cd feed
npm install
```

### 5. Create the KV namespace

```sh
wrangler kv:namespace create FEED_KV
```

The output looks like:

```
[[kv_namespaces]]
binding = "FEED_KV"
id = "abcd1234..."
```

Copy the `id` value and paste it into `wrangler.toml`, replacing `REPLACE_AFTER_CREATE`.

### 6. Set secrets

```sh
wrangler secret put EVENTBRITE_TOKEN
# (paste the Eventbrite Private Token from step 1, hit Enter)

wrangler secret put PREDICTHQ_TOKEN
# (paste the PredictHQ Access Token)

wrangler secret put TICKETMASTER_API_KEY
# (paste the Ticketmaster Consumer Key)

wrangler secret put REFRESH_KEY
# generate a UUID with PowerShell:
#   powershell -c "[guid]::NewGuid()"
# or any UUID generator. Paste it. Keep a copy — you'll need it for /refresh calls.
```

(Optional) Manual events override — used by the Tourism Kelowna stub:

```sh
wrangler secret put FEED_MANUAL_OVERRIDE
# (paste a JSON array of RawEvent objects — see src/providers/tourism-kelowna.ts)
```

### 7. Run the tests

```sh
npm test
```

All suites should pass. This verifies the schema, normalize, dedupe, haversine, and pipeline logic without hitting any real APIs.

### 8. Deploy

```sh
wrangler deploy
```

You'll get a URL like:

```
https://valora-feed.YOUR-SUBDOMAIN.workers.dev
```

### 9. Wire the site

In the VALORA site repo, open `tokens.json` and set:

```json
{
  "LIVE_FEED_URL": "https://valora-feed.YOUR-SUBDOMAIN.workers.dev/feed"
}
```

### 10. Trigger the first refresh

The Worker's cron runs at 00/06/12/18 UTC, but you don't want to wait for the next slot. Fire it once manually:

```sh
curl -X POST \
  -H "X-Refresh-Key: YOUR_REFRESH_KEY" \
  https://valora-feed.YOUR-SUBDOMAIN.workers.dev/refresh
```

Expected response (202 Accepted):

```json
{
  "refreshed": true,
  "eventCount": 23,
  "providers": {
    "eventbrite": "ok",
    "predicthq": "ok",
    "ticketmaster": "ok",
    "yelp": "stub",
    "googlePlaces": "stub",
    "tourismKelowna": "stub"
  },
  "cacheKept": false,
  "updatedAt": "2026-05-12T18:00:00.000Z"
}
```

### 11. Verify

```sh
curl https://valora-feed.YOUR-SUBDOMAIN.workers.dev/feed | jq .
curl https://valora-feed.YOUR-SUBDOMAIN.workers.dev/health | jq .
```

---

## Endpoints

| Method | Path       | Auth                    | Purpose                                  |
|--------|------------|-------------------------|------------------------------------------|
| GET    | `/feed`    | none (public, CORS *)   | Cached events payload                    |
| GET    | `/health`  | none (public)           | Last refresh + per-provider status       |
| POST   | `/refresh` | `X-Refresh-Key` header  | Manually rerun the aggregation pipeline  |
| —      | cron       | —                       | Automatic refresh at 00/06/12/18 UTC     |

CORS is open on `/feed` (`Access-Control-Allow-Origin: *`).

### Status header on `/feed`

| Header value           | Meaning                                                              |
|------------------------|----------------------------------------------------------------------|
| `X-Feed-Status: ok`    | Fresh data, refreshed within 12h                                     |
| `X-Feed-Status: stale` | Cached data > 12h old; ALL providers failed last refresh             |
| `X-Feed-Status: cold`  | No cache available (brand-new deploy)                                |

### Other response headers

| Header          | Value                                                                |
|-----------------|----------------------------------------------------------------------|
| `Cache-Control` | `public, max-age=900` — browsers cache for 15 minutes                |
| `X-Last-Updated`| ISO timestamp of the last successful refresh, or empty string on cold|

---

## Operating notes

- **Cost:** $0/month for any reasonable STR-site traffic on the Cloudflare free tier (100K requests/day).
- **Provider quotas:** All three providers' free tiers cover the 4 refreshes/day with hundreds of headroom.
- **Hard cap:** 30 events served. Sorted by `startsAt` ascending; events that have already started are dropped.
- **Geo radius:** 30 km from the listing (configurable via `RADIUS_KM` in `wrangler.toml`).
- **What if a provider goes down?** The pipeline marks it `fail`, the other two keep working, and the response is served unchanged. If ALL three fail and there's a cached payload, it's preserved (returned as `stale`).
- **What if Eventbrite kills public Search again?** They've done this before. The Worker logs the 401/403, marks Eventbrite `fail`, and serves Ticketmaster + PredictHQ. The site keeps working.

---

## Local dev

```sh
wrangler dev
```

Hits the Worker locally with hot reload. KV writes go to a local SQLite — not your prod namespace.

---

## Adding a new provider

1. Create `src/providers/your-provider.ts` exporting `async function fetch...(): Promise<ProviderResult>`.
2. Wire it into `src/refresh.ts` — add to `providerPromises`, destructure the result, include in the `statuses` object.
3. Add a classifier branch in `src/lib/classify.ts` if needed.
4. Add a test in `test/`.
5. If it's user-facing, add it to the `Source` enum in `src/schema.ts` (bumps the schema version).

---

## Integration paths

See `docs/GHL-LIVE-FEED-INTEGRATION.md` for the two ways to drive refreshes (direct vs CRM workflow). Default is direct.
