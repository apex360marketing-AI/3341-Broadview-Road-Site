/**
 * owner-portal worker — entry point (Phase 1, read-only).
 *
 * Routes:
 *   POST   /auth                — verify X-Admin-Key, returns 204 on success
 *   GET    /bookings            — list (slim projection); optional ?status=
 *   GET    /bookings/:id        — full BookingRecord
 *
 * Every route is Origin-allowlisted AND X-Admin-Key-gated AND per-IP
 * rate-limited. KV is shared with the public worker (../../feed/) — this
 * worker reads `booking:*` records the public worker wrote.
 *
 * Phase 2 will add:
 *   POST  /bookings/:id/confirm   capture the Stripe PaymentIntent
 *   POST  /bookings/:id/decline   cancel the Stripe PaymentIntent (release hold)
 */
import type { Env } from "./types";
import { checkOrigin } from "./origin";
import { handleAuth, handleListBookings, handleGetBooking } from "./handlers";

const BOOKING_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Origin gate first — short-circuit before any other work.
    const origin = checkOrigin(req, env.BOOKING_ALLOWED_ORIGIN);

    if (req.method === "OPTIONS") {
      if (!origin.ok) {
        return new Response(null, { status: 403, headers: origin.cors });
      }
      return new Response(null, { status: 204, headers: origin.cors });
    }

    if (!origin.ok) {
      return new Response(
        JSON.stringify({ error: "forbidden", reason: origin.reason }),
        {
          status: 403,
          headers: {
            ...origin.cors,
            "Content-Type": "application/json"
          }
        }
      );
    }

    try {
      if (url.pathname === "/auth" && req.method === "POST") {
        return await handleAuth(req, env, origin);
      }
      if (url.pathname === "/bookings" && req.method === "GET") {
        return await handleListBookings(req, env, origin);
      }
      const m = url.pathname.match(/^\/bookings\/([^/]+)$/);
      if (m && req.method === "GET") {
        const id = m[1]!;
        if (!BOOKING_ID_RE.test(id)) {
          return new Response(JSON.stringify({ error: "bad_id" }), {
            status: 400,
            headers: { ...origin.cors, "Content-Type": "application/json" }
          });
        }
        return await handleGetBooking(req, env, origin, id);
      }

      // 404 for everything else; 405 if path is right but method is wrong
      // is below the noise threshold for a tiny internal API.
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...origin.cors, "Content-Type": "application/json" }
      });
    } catch (err) {
      console.error("[owner-portal] unhandled", err);
      return new Response(JSON.stringify({ error: "internal" }), {
        status: 500,
        headers: { ...origin.cors, "Content-Type": "application/json" }
      });
    }
  }
};
