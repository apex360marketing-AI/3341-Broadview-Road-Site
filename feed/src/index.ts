/**
 * Worker entry point.
 *
 * Public routes (CORS `*`):
 *   GET  /feed      — events aggregation, browser-cached 15 min
 *   GET  /health    — ops / monitoring
 *
 * Operator route (X-Refresh-Key header auth + per-IP rate-limited):
 *   POST /refresh   — re-aggregate event providers
 *
 * Booking routes (Origin-allowlisted via BOOKING_ALLOWED_ORIGIN):
 *   GET  /availability
 *   POST /book
 *   GET  /booking/:id
 *   POST /booking/:id/secure
 *
 * Plus a cron trigger (00/06/12/18 UTC, see wrangler.toml) that runs refresh().
 */
import { refresh, readCachedFeed, type Env } from "./refresh";
import { checkRefreshKey } from "./auth";
import { checkRateLimit } from "./ratelimit";
import { SCHEMA_VERSION, type FeedPayload } from "./schema";
import { checkOrigin } from "./booking/origin";
import {
  handleAvailability,
  handleBook,
  handleGetBooking,
  handleSecure
} from "./booking/handlers";

const COLD_START_BUDGET_MS = 3_000;

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "X-Refresh-Key, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const BOOKING_PATH_PREFIX = /^\/(availability|book|booking)(\/|$)/;

/** Status header values explained:
 *   ok      — fresh data (refreshed within the last 12h)
 *   stale   — cached data older than 12h; ALL providers failed last refresh
 *   cold    — no cache available and inline refresh didn't produce anything
 */
function pickFeedStatus(payload: FeedPayload | null): "ok" | "stale" | "cold" {
  if (!payload || !payload.updatedAt) return "cold";
  const ageMs = Date.now() - new Date(payload.updatedAt).getTime();
  return ageMs > 12 * 60 * 60 * 1000 ? "stale" : "ok";
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const isBookingPath = BOOKING_PATH_PREFIX.test(url.pathname);

    // CORS preflight — booking endpoints need Origin-tuned headers
    if (req.method === "OPTIONS") {
      if (isBookingPath) {
        const origin = checkOrigin(req, env.BOOKING_ALLOWED_ORIGIN);
        if (!origin.ok) {
          return new Response(null, { status: 403, headers: origin.cors });
        }
        return new Response(null, { status: 204, headers: origin.cors });
      }
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      // ===== Booking routes (Origin-allowlisted) =====
      if (isBookingPath) {
        const origin = checkOrigin(req, env.BOOKING_ALLOWED_ORIGIN);
        if (!origin.ok) {
          return new Response(
            JSON.stringify({ error: "forbidden", reason: origin.reason }),
            { status: 403, headers: { ...origin.cors, "Content-Type": "application/json" } }
          );
        }

        if (url.pathname === "/availability" && req.method === "GET") {
          return await handleAvailability(req, env, origin);
        }
        if (url.pathname === "/book" && req.method === "POST") {
          return await handleBook(req, env, origin);
        }

        const bookingMatch = url.pathname.match(/^\/booking\/([A-Za-z0-9-]{8,64})(\/secure)?$/);
        if (bookingMatch) {
          const bookingId = bookingMatch[1];
          if (bookingMatch[2] === "/secure" && req.method === "POST") {
            return await handleSecure(req, env, origin, bookingId);
          }
          if (!bookingMatch[2] && req.method === "GET") {
            return await handleGetBooking(req, env, origin, bookingId);
          }
        }

        return new Response(
          JSON.stringify({ error: "method_not_allowed" }),
          { status: 405, headers: { ...origin.cors, "Content-Type": "application/json" } }
        );
      }

      // ===== Public + operator routes =====
      if (url.pathname === "/feed" && req.method === "GET") {
        return await handleFeed(env);
      }
      if (url.pathname === "/health" && req.method === "GET") {
        return await handleHealth(env);
      }
      if (url.pathname === "/refresh" && req.method === "POST") {
        return await handleRefresh(req, env);
      }
      return jsonResponse({ error: "not found" }, 404);
    } catch (err) {
      console.error("[worker] unhandled", err);
      return jsonResponse({ error: "internal" }, 500);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      refresh(env)
        .then((r) => console.log("[cron] refresh ok", JSON.stringify(r)))
        .catch((err) => console.error("[cron] refresh failed", err))
    );
  },
};

async function handleFeed(env: Env): Promise<Response> {
  let payload = await readCachedFeed(env.FEED_KV);

  if (!payload) {
    try {
      await refresh(env, { inlineBudgetMs: COLD_START_BUDGET_MS });
    } catch (err) {
      console.warn("[feed] cold-start refresh failed", err);
    }
    payload = await readCachedFeed(env.FEED_KV);
  }

  const status = pickFeedStatus(payload);
  const body: FeedPayload = payload ?? {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: null,
    events: [],
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=900",
      "X-Last-Updated": body.updatedAt ?? "",
      "X-Feed-Status": status,
    },
  });
}

async function handleHealth(env: Env): Promise<Response> {
  const payload = await readCachedFeed(env.FEED_KV);
  const lastStatusRaw = await env.FEED_KV.get("feed:last-status");
  let providers: Record<string, string> = {
    eventbrite: env.EVENTBRITE_TOKEN ? "unknown" : "missing-key",
    predicthq: env.PREDICTHQ_TOKEN ? "unknown" : "missing-key",
    ticketmaster: env.TICKETMASTER_API_KEY ? "unknown" : "missing-key",
    yelp: "stub",
    googlePlaces: "stub",
    tourismKelowna: env.FEED_MANUAL_OVERRIDE ? "manual" : "stub",
  };
  if (lastStatusRaw) {
    try {
      const parsed = JSON.parse(lastStatusRaw) as Record<string, string>;
      providers = { ...providers, ...parsed };
    } catch {
      // ignore — fall back to derived statuses
    }
  }

  return jsonResponse({
    ok: true,
    lastRefresh: payload?.updatedAt ?? null,
    eventCount: payload?.events.length ?? 0,
    providers,
  });
}

async function handleRefresh(req: Request, env: Env): Promise<Response> {
  if (!checkRefreshKey(req.headers.get("X-Refresh-Key"), env.REFRESH_KEY)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const ip =
    req.headers.get("CF-Connecting-IP") ??
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown";

  const rl = await checkRateLimit(env.FEED_KV, ip);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "rate_limited", retryAfterSeconds: rl.retryAfterSeconds }),
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
          "Retry-After": String(rl.retryAfterSeconds),
        },
      }
    );
  }

  const result = await refresh(env);
  await env.FEED_KV.put("feed:last-status", JSON.stringify(result.providers));

  return new Response(
    JSON.stringify({
      refreshed: true,
      eventCount: result.eventCount,
      providers: result.providers,
      cacheKept: result.cacheKept,
      updatedAt: result.updatedAt,
    }),
    {
      status: 202,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
