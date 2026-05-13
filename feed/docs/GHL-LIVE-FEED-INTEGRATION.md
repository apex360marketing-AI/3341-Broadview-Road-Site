# Live Feed — Integration Paths

Two ways to wire the Worker into a real listing site. Pick one.

## Path A — Direct fetch (RECOMMENDED)

The site fetches the Worker's `/feed` endpoint directly. The CRM is not involved in the feed at all.

```
Browser ──GET──> https://valora-feed.{subdomain}.workers.dev/feed
                                │
                                └── Worker reads cached payload from KV
                                    Worker cron refreshes at 00/06/12/18 UTC (Cloudflare Cron Trigger)
```

**Why this is the default**
- Zero CRM workflow needed
- Refreshes happen on Cloudflare's clock (Cron Triggers, free)
- No coupling between the marketing CRM and the public site
- One less thing to break

**Setup**
1. Deploy the Worker (see `README.md`).
2. Copy your Worker URL (e.g. `https://valora-feed.yoursubdomain.workers.dev`).
3. In the site repo, paste it into `tokens.json` as the `LIVE_FEED_URL` value, append `/feed`:
   ```json
   { "LIVE_FEED_URL": "https://valora-feed.yoursubdomain.workers.dev/feed" }
   ```
4. The site is now reading live events. The cron will start populating data on its first tick (max 6h); to seed immediately, hit `POST /refresh` once manually — see README step 10.

---

## Path B — CRM workflow trigger (OPTIONAL)

The CRM runs a scheduled workflow that POSTs to the Worker's `/refresh` endpoint. The Worker's own cron is still active too (belt + suspenders), but you can decide to disable the cron if the CRM is your single source of scheduling.

Use this when:
- The operator wants the CRM as the central scheduler (audit log, single dashboard)
- The refresh cadence needs to be operator-tunable from the CRM UI without code changes
- The CRM is already running adjacent automations on the same schedule

### Workflow setup (CRM-side)

1. In the CRM, open **Automation → Workflows → Create New Workflow**.
2. **Trigger:**
   - Type: **Schedule** (a.k.a. "Recurring" / "Cron")
   - Cadence: every 6 hours (or whatever you prefer — be mindful of provider quotas + the Worker's `/refresh` rate-limit of 6 requests / IP / hour)
3. **Action 1:** **Custom Webhook**
   - **URL:** `https://valora-feed.{your-subdomain}.workers.dev/refresh`
   - **Method:** `POST`
   - **Headers:**
     | Key             | Value                          |
     |-----------------|--------------------------------|
     | `X-Refresh-Key` | `YOUR_REFRESH_KEY`             |
     | `Content-Type`  | `application/json`             |
   - **Body:** (leave empty — the Worker ignores the body on /refresh)
4. **Save & publish** the workflow.

### Disabling the Worker's built-in cron (optional)

If you'd rather the CRM be the only scheduler, edit `wrangler.toml`, remove or comment out the `[triggers]` block, and redeploy:

```toml
# [triggers]
# crons = ["0 0,6,12,18 * * *"]
```

```sh
wrangler deploy
```

### Why most operators will NOT use Path B

- Adds a moving part (the CRM workflow) for no functional gain
- If the CRM has an outage, the feed goes stale until next workflow run
- Cloudflare Cron Triggers are free and self-healing

Leave Path B documented for operators who specifically want centralized scheduling, but default new installs to Path A.

---

## Both paths — security note

- `REFRESH_KEY` is a shared secret. If the CRM workflow stores it, anyone with CRM access can trigger a refresh. That's safe — the worst they can do is make the worker re-fetch from public event APIs.
- Rate limit on `/refresh` is **6 requests / IP / hour** (the CRM's outbound IPs count as a small pool, so this is plenty for any reasonable schedule).
- Never put `REFRESH_KEY` into client-side code, page HTML, or anywhere the public can read.
