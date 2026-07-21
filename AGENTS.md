# AGENTS.md

See `CLAUDE.md` for full architecture, conventions, and hard rules. This file holds operating notes for agents working in the cloud environment.

## Cursor Cloud specific instructions

### Services & standard commands
- **Astro listing site (the product)** — root package. Dev: `npm run dev` (http://localhost:4321). Build + typecheck: `npm run build` (runs `astro check` then `astro build`). Preview built output: `npm run preview`. There is no separate lint step; `astro check` (run as part of `build`) is the typecheck/lint.
- **`feed/` Cloudflare Worker (optional)** — live "On The Radar" events aggregator. The site does NOT need it: `OnTheRadar` server-renders bundled `src/data/sample-events.ts` and only fetches live data when `tokens.LIVE_FEED_URL` is non-empty (empty by default). Tests: `cd feed && npm test` (Vitest). Local run: `cd feed && npm run dev` (wrangler). Two tests fail by default (`haversine.test.ts > roundMiles`, `normalize.test.ts` category) — these are pre-existing assertion mismatches in app logic, not environment problems.

### Dependency pinning (do NOT "modernize" these — dev breaks if you do)
- `package.json` pins `@astrojs/react@^4` and `overrides.vite = "^6"`. This is deliberate. Astro 5.18 runs its dev pipeline on Vite 6 (Rollup). `@astrojs/react@5` / `@vitejs/plugin-react@5` and Vite 8 are the rolldown-based Astro-6 line; mixing them in causes `astro dev` to fail with `[vite] Internal server error: Missing field 'moduleType'` (all `.astro` components 500) and the React island to crash hydration with `Cannot read properties of null (reading 'useState')`. `astro build` masks both bugs, so always verify changes with `npm run dev`, not just `build`. If you bump Astro to 6, switch back to `@astrojs/react@5` + `vite ^7` together.

### Environment caveats
- **No outbound internet** in this VM. Google Fonts, OpenStreetMap map tiles, and any external inquiry webhook will not load; the site degrades gracefully (font fallback, static map preview, sample feed). Don't treat these as bugs.
- **Inquiry form**: with `tokens.json` `INQUIRY_WEBHOOK_URL` empty (default) the modal intentionally disables submit and shows "Inquiries are temporarily unavailable online…". That is expected behavior, not a defect.
- **`npm run prepare:photos`**: requires the raw originals in `seed/` (gitignored and absent here). The curated, EXIF-stripped outputs already live in `public/listing/photo-01..20.jpg`, so this step is unnecessary unless you change the seed.
- **Benign `astro dev` startup noise**: on boot, Vite's dependency pre-scan prints an esbuild `✘ [ERROR] Expected ";" but found "index"` pointing at `ChatWidget.astro` (it misreads a `<head>` mention inside the frontmatter comment). This does NOT crash the server — all pages (`/`, `/area`, `/roi`, `/dials`) still serve HTTP 200 and the React island on `/roi` hydrates. Ignore it.
