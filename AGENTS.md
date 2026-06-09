# AGENTS.md

## Cursor Cloud specific instructions

### Products in this repo

| Product | Path | Dev command | URL |
|---|---|---|---|
| STR booking site (Astro 5) | repo root | `npm run dev` | http://localhost:4321 |
| Live events feed (Cloudflare Worker) | `feed/` | `npm run dev` | http://localhost:8787 |
| Netlify functions (ROI PDF export) | `netlify/functions/` | `netlify dev` (CLI not in package.json) | http://localhost:8888 |

See `README.md` and `CLAUDE.md` for architecture and token conventions.

### Dependency install

- **Node.js ≥ 20** (npm; lockfile at root).
- Install **both** npm projects on fresh VMs:
  - `npm install` (root)
  - `cd feed && npm install`
- No ESLint/Prettier; type-check runs via `astro check` inside `npm run build`.

### Photos (`prepare:photos`)

- Source originals live in `seed/listing_3341_broadview/` (**gitignored**).
- Processed JPEGs are committed under `public/listing/`.
- Run `npm run prepare:photos` only after adding/changing seed photos (EXIF strip + realtor badge patch). A fresh clone without `seed/` can still run the site using the committed `public/listing/` assets.

### Running services

- **Minimum site dev:** `npm run dev` from repo root (tmux recommended for long-running).
- **Production preview:** `npm run build` then `npm run preview`.
- **Live feed (optional):** start `feed/` worker, set `LIVE_FEED_URL` in `tokens.json` to `http://localhost:8787/feed`. Without it, `/area` uses sample events.
- **ROI PDF functions (optional):** requires Netlify CLI (`netlify dev`); not served by plain `astro dev`.

### Tests

- Site: no unit tests; verify with `npm run build`.
- Worker: `cd feed && npm test` (Vitest). As of setup, 2 tests in `haversine.test.ts` / `normalize.test.ts` may fail against current implementation — treat as known drift if failures persist.

### Gotchas

- `LIVE_FEED_URL`, `WALKSCORE_WSAPIKEY`, and `INQUIRY_WEBHOOK_URL` in `tokens.json` are optional for local browsing.
- Wrangler dev may download binaries on first `feed/` run; allow network on cold start.
