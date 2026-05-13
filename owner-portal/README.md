# owner-portal — Valora owner dashboard (Phase 1)

Internal-only operator dashboard for VALORA. Completely isolated from the
public marketing site (`../src/`) and the public booking worker (`../feed/`).

> **Phase 1 (this checkpoint):** read-only — list + view bookings.
> No mutations (confirm / decline / capture / cancel) yet.

## Layout

```
owner-portal/
├── site/        Astro mini-project — the dashboard UI
└── worker/      Cloudflare Worker — admin API
```

Both deploy independently. They share the **same** KV namespace as the public
worker so the dashboard sees the same `booking:*` records the guest flow
creates — but neither this site nor this worker imports from `../src/`
or `../feed/`. The public side is untouched.

## What's shared with the public stack (by design)

| Resource | Why | How |
|---|---|---|
| KV namespace `FEED_KV` | Single source of truth for `booking:*` | Same `id` in this worker's `wrangler.toml` |
| Stripe account | Auth-holds are on the public worker's PaymentIntents | Same `STRIPE_SECRET_KEY` (set independently on this worker) |
| Brand palette | Visual parity | **Copied**, not imported, from `../tokens.json` + atoms. Manual re-sync. |

## What's NOT shared

- No imports across `../src/` ↔ `owner-portal/site/`
- No imports across `../feed/` ↔ `owner-portal/worker/`
- Separate `package.json`, `wrangler.toml`, `astro.config.mjs`, deploys, hostnames

## Dev

```
# site
cd owner-portal/site
npm install
npm run dev          # http://localhost:4322

# worker
cd owner-portal/worker
npm install
npx wrangler dev     # http://localhost:8788
```

The site reads `OWNER_API_URL` from `owner-portal/site/tokens.json` — point
it at `http://localhost:8788` for local dev.

The worker needs:

```
npx wrangler secret put ADMIN_KEY          # the dashboard password
npx wrangler secret put STRIPE_SECRET_KEY  # same Stripe key as feed/ worker (Phase 2)
```

and in `wrangler.toml` the `FEED_KV` `id` must match the production KV
namespace used by `../feed/`.

## Deploy

The public site continues to deploy from the repo root; the public worker
from `../feed/`. This portal deploys from this folder only:

```
cd owner-portal/site && npm run build && (deploy /dist somewhere private)
cd owner-portal/worker && npx wrangler deploy
```

Recommended: a separate hostname (e.g. `owner.valora.example`) and a
`robots.txt` that disallows everything. All pages also carry
`<meta name="robots" content="noindex,nofollow">`.

## Phase plan

| Phase | Scope | State |
|---|---|---|
| 1 | Scaffold + read-only list/detail + password gate | **this** |
| 2 | Confirm (capture) + Decline (cancel) actions | held for review |
| 3 | Polishing, QA, security-review, deploy docs | held for review |
