# CLAUDE.md — STR Booking Site

White-label premium short-term rental listing template. Seeded with **VALORA** (3341 Broadview Rd, West Kelowna BC) but designed to be rebrandable in under 60 minutes via a single token swap.

This file is the working agreement for anyone (human or Claude) editing this codebase.

---

## What this is

A 2-page static site that any STR operator can clone, retoken, and drop into GHL custom domain (or Netlify / Cloudflare Pages):

- **Page 1 — Listing.** Hero, gallery, amenities, booking CTA, Walk Score, reviews, host card, map.
- **Page 2 — The Area + On The Radar.** Nearby spots + live "what's happening this week" feed powered by a small Cloudflare Worker (`feed/`).

Plus a Cloudflare Worker (`feed/`) the operator deploys to their own account to aggregate event data (Eventbrite, PredictHQ, Ticketmaster) for the "On The Radar" section.

---

## Stack & rationale

| Layer | Choice | Why this and not the alternative |
|---|---|---|
| Site framework | **Astro 5** (static) | Component model + automatic image optimization (`sharp`) + zero-JS-by-default with islands only where needed (Leaflet on click, booking modal). Plain HTML+Tailwind was the alternative — loses image opt + content-as-MDX + bundle hygiene. Astro produces a smaller real-world bundle here despite being a framework. |
| Styling | **Tailwind v4** + `src/styles/tokens.css` | Tailwind v4's CSS-first theme reads from CSS custom properties in `tokens.css` — meaning a brand swap is one file, not a config rebuild. `tokens.json` mirrors the same values so non-technical operators can swap via a JSON edit. |
| Map | **Leaflet 1.9 + OSM tiles** | No Google Maps key required. Loaded **only on user click** (static SVG preview is the default state) — zero passive third-party hits, faster LCP, privacy-respecting. |
| Backend (live feed) | **Cloudflare Workers** in `feed/` | Free-tier covers operator usage, edge-cached, native cron, KV for storage. |
| Tests | **Vitest** (feed only) | Site is static; nothing runtime to test. Worker has real logic (haversine, normalize, dedupe, classify). |
| Anti-spam | Honeypot + min-time-to-submit | No CAPTCHA. Cloudflare Turnstile / reCAPTCHA = third-party + cookies — conflicts with the "no third-party scripts by default" rule. |

---

## The token system

Two mirrored surfaces hold every client-specific value:

- `tokens.json` — values that JS reads (`src/lib/tokens.ts` is the typed accessor).
- `src/styles/tokens.css` — `:root` CSS custom properties that the browser reads.

A non-technical operator only ever edits these two files (and the Markdown content files in `src/content/`). After Commit 5, `GHL-IMPORT-GUIDE.md` will map every token to a GHL custom-value step-by-step.

**Rule from Commit 3 onward:** no client-specific value is hard-coded in components. If a value belongs to *this* property, it lives in `tokens.json`. If it's truly universal (template label, ARIA string, system error copy), it lives in code.

---

## Photo curation

The seed has 20 photos. The curated gallery uses 12 — the strongest Hero → Outdoor → Living → Kitchen → Bedrooms arc:

| # | Source | Used as |
|---|---|---|
| 01 | photo_01_modern_updated_exterior | Hero |
| 02 | photo_02_private_backyard_oasis | Outdoor |
| 03 | photo_03_inground_pool | Outdoor |
| 04 | photo_05_vaulted_ceilings | Indoor wide |
| 05 | photo_07_wood_burning_fireplace | Indoor feature |
| 06 | photo_06_oversized_living_room | Living |
| 07 | photo_12_kitchen | Kitchen primary |
| 08 | photo_14_kitchen | Kitchen secondary |
| 09 | photo_09_dining_area | Dining |
| 10 | photo_17_main_floor_primary | Primary BR |
| 11 | photo_19_main_floor_primary_ensuite | Ensuite |
| 12 | photo_20_main_floor_bed_2 | Second BR |

**Skipped (re-include if useful):** `photo_04_front_entry` (redundant with hero), `photo_08`, `photo_10`, `photo_11`, `photo_16` (transitional walking shots), `photo_13`, `photo_15` (extra kitchen angles past the chosen 2), `photo_18` (extra primary angle).

All photos are EXIF-stripped at build time via `scripts/prepare-photos.mjs` so GPS metadata cannot defeat the approximate-location map posture.

---

## Bedroom & guest-count reality

The source listing claims **7 bedrooms / sleeps 14 / 3,984 sqft**. This template ships **4 BR + den / sleeps 10 / ≈2,400 guest sqft** because:

- The basement is split into a **legal 2-bed suite** + a **1-bed in-law suite**, intended as long-term rental income.
- Marketing all 7 bedrooms forces both suites to stay empty for any STR booking, which kills the income.
- The sensible STR model is: STR guests get main + upstairs (4 BR + den, 3 baths); suites stay tenanted.

Operators who want to lock off the entire house and offer all 7 bedrooms can override `BEDROOMS`, `MAX_GUESTS`, and `GUEST_SQFT` in `tokens.json`. Document this clearly to your guests.

---

## Privacy & safety posture (non-negotiable in this template)

- **Map default = approximate** (300m circle, no exact pin). Tokenize `LISTING_LOCATION_DISPLAY` to override.
- **Booking webhook URL must be HTTPS.** Form-side validation refuses to submit to plain HTTP.
- **Marketing opt-in is a SEPARATE, UNCHECKED checkbox** (CASL-compliant).
- **No analytics, cookies, or third-party scripts ship by default.** localStorage is used only to cache the live feed.
- **Sample reviews ship with a visible "Sample data" badge** until `REVIEWS_ARE_REAL` is set to `true`.
- **No AI-generated faces.** `HOST_PHOTO_URL` empty → component renders a typographic monogram avatar.
- **Photos EXIF-stripped at build time** so GPS in metadata can't reveal exact address.
- **Card data is Stripe SAQ-A scope.** Stripe Elements (iframe) on /pay; PAN/CVC never touches Valora origin or logs.
- **Booking PII flow:** browser → Worker → GHL. Worker logs status + booking_id + duration only — never request bodies.

Full audit findings are in the conversation history under "Trust Audit Punch List" (Stage 2). Do not reverse any of them without re-running `safety-consent-trust-auditor`.

---

## Hard rules (do not break)

- **Do not display sale price, MLS#, property taxes, sale history, or listing realtor (Kevin Mueller / REMAX).** This is an STR template, not a for-sale page.
- **Do not hard-code client-specific values past Commit 2.** Use `tokens.json`.
- **Do not add third-party scripts by default** (no GA, no FB pixel, no Tag Manager, no Turnstile).
- **Do not use Google Maps.** Leaflet + OSM only.
- **Do not invent reviews using real-sounding full names.** Initials + first name only, clearly seeded as sample.
- **Do not show the word "GoHighLevel" or "GHL" anywhere a guest can see it.** Operator-side docs only.

---

## Commit plan

| # | Scope | State |
|---|---|---|
| 1 | Scaffold + tokens + photos + CLAUDE.md + scripts | this commit |
| 2 | Page 1 (Listing) complete with seed data | next |
| 3 | Page 2 + `feed/` Worker + schema docs | |
| 4 | `simplify` pass | |
| 5 | `str-template-tokenize` skill written + run; emits `tokens.schema.json` + `GHL-IMPORT-GUIDE.md` | |
| 6 | `security-review` + fixes | |
| 7 | `fewer-permission-prompts` settings | |
| 8 | Top-level README | |

Each commit pushes to `origin/claude/airbnb-rental-template-XewnD`. No PR opened unless explicitly requested.

---

## Local dev

```
npm install
npm run prepare:photos    # only needed once, or after seed changes
npm run dev               # http://localhost:4321
npm run build             # outputs static /dist
npm run preview           # serve /dist locally
```

---

## Out of scope (won't ship in v1.x)

- CMS / admin UI / multi-listing dashboard
- Dynamic / seasonal pricing engine
- i18n / multi-language
- Mobile native app
- Backend database / auth beyond the Worker
- Analytics / cookies / consent banner (default off)

## v1.1 scope additions (lifted from out-of-scope)

- **Real availability calendar** — Worker hits the host's GHL Calendar
  API server-side; site never sees GHL. KV-cached 5 min. Graceful
  degraded mode when GHL is unreachable.
- **Payment processing — auth-hold** — Stripe Elements on /pay
  collects card; Worker creates a manual-capture PaymentIntent. Card
  data NEVER touches Valora's origin (PCI SAQ-A scope preserved).
  Default deposit: one night ($595 CAD), released 7 days after the
  host fails to confirm.

## v1.1 CSP trade-off (intentional)

The strict `default-src 'self'` posture is weakened on **/pay only**
to allow Stripe Elements:
  - `script-src + https://js.stripe.com`
  - `frame-src + https://js.stripe.com https://hooks.stripe.com`
  - `connect-src + https://api.stripe.com https://m.stripe.network +
    BOOKING_API_URL`
  - `img-src + https://*.stripe.com`

Other pages add only the Worker URL to `connect-src` (for /availability
and /book calls). This is the cost of payment processing — accepted.

## Follow-ups after v1.1

Items that were scoped out of v1.1 by mutual agreement; revisit at v1.2:

- **R7** — Enable Stripe Radar (fraud) on the Stripe account.
  Dashboard task, not code.
- **R8** — 6-day host-reminder workflow for expiring auth-holds.
  Lives in the GHL workflow side, not code.
- **R10** — "Powered by Stripe" badge on /pay (trust signal).
- **Mobile menu** — the 5-menu chooser bar in Nav is desktop-only.
  After a winning concept is picked, build the matching mobile menu.
- **Test cleanup** — pre-existing `haversine.test.ts:49` and
  `normalize.test.ts:127` failures predate v1.1 (category enum
  change, rounding-mode change). Triage in a follow-up.
