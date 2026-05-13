/**
 * Provider-raw → schema-conforming Event.
 *
 * Performs:
 *  - HTTPS coercion (`http://` upgraded; `javascript:`/`data:`/etc rejected)
 *  - Date parsing + offset enforcement (instant events get endsAt := startsAt)
 *  - Distance computation (haversine)
 *  - Category classification
 *  - Summary truncation (1000 chars hard cap from schema; we soft-cap to ~280)
 *  - Stable ID hashing for dedupe across refreshes
 *  - Zod validation — invalid events return null (caller logs + drops)
 */
import {
  EventSchema,
  type Event,
  type RawEvent,
  type SourceIcon,
} from "../schema";
import { haversineMiles, roundMiles } from "./haversine";
import { classify } from "./classify";

const SOURCE_ICON_MAP: Record<string, SourceIcon> = {
  Eventbrite: "eventbrite",
  PredictHQ: "predicthq",
  Ticketmaster: "ticketmaster",
};

const SOFT_SUMMARY_CAP = 280;

/**
 * FNV-1a 32-bit hash, hex-encoded. Stable across refreshes given identical
 * inputs. Plenty of entropy for event de-duplication; we are NOT using this
 * for security.
 */
function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Stable, deterministic event id used by dedupe + the public payload. */
export function stableEventId(raw: RawEvent): string {
  const parts = [
    raw.source,
    raw.providerId,
    raw.title.trim().toLowerCase(),
    raw.startsAt,
  ].join("|");
  return `${raw.source.toLowerCase().replace(/\s+/g, "-")}-${fnv1aHex(parts)}`;
}

/**
 * Returns an `https://`-prefixed URL or null. Upgrades bare `http://` because
 * many provider records still serve image CDNs over plain HTTP — the front-end
 * blocks mixed content anyway, so we'd rather attempt the upgrade than drop.
 * Rejects `javascript:`, `data:`, `file:`, etc.
 */
export function safeHttpsUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice(7)}`;
  return null;
}

/**
 * Coerce a date-ish input to an ISO string with offset. Returns null on
 * unparseable. Note: PredictHQ + Eventbrite return UTC (`Z`) which is a valid
 * offset; Ticketmaster sometimes returns local-only dates (`2026-05-30`) —
 * we promote those to UTC midnight in that case.
 */
export function coerceIsoWithOffset(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Date-only input → midnight UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  // toISOString() always produces a `Z` (UTC) offset → schema-valid.
  return d.toISOString();
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Strip HTML tags + collapse whitespace. Some providers (Eventbrite,
 * PredictHQ) return descriptions with markup; the site renders summary as
 * plain text so we sanitize at the source.
 */
export function plainTextSummary(raw: string | null | undefined): string {
  if (!raw) return "";
  const noTags = raw.replace(/<[^>]*>/g, " ");
  const collapsed = noTags.replace(/\s+/g, " ").trim();
  return truncate(collapsed, SOFT_SUMMARY_CAP);
}

export interface NormalizeContext {
  listingLat: number;
  listingLng: number;
}

/**
 * Convert a RawEvent → fully-formed Event or null.
 *
 * Returns null (with a console.warn) when:
 *  - The event URL is not https-coercible
 *  - startsAt is unparseable
 *  - Zod validation fails for any other reason
 */
export function normalizeEvent(
  raw: RawEvent,
  ctx: NormalizeContext
): Event | null {
  const url = safeHttpsUrl(raw.url);
  if (!url) {
    console.warn(`[normalize] dropping ${raw.source}/${raw.providerId}: bad url`);
    return null;
  }

  const startsAt = coerceIsoWithOffset(raw.startsAt);
  if (!startsAt) {
    console.warn(`[normalize] dropping ${raw.source}/${raw.providerId}: bad startsAt`);
    return null;
  }
  // If endsAt missing/unparseable, treat as an instant event.
  const endsAt = coerceIsoWithOffset(raw.endsAt) ?? startsAt;

  const imageUrl = safeHttpsUrl(raw.imageUrl);

  // Distance: only computable if the provider gave us coords. Events without
  // coords pass through with distance = 0 — the caller decides whether to
  // include them (we choose to KEEP them; an event without coords might still
  // be near the listing, and dropping them would lose Eventbrite events whose
  // venues lack precise lat/lng).
  let distanceMiles = 0;
  if (typeof raw.lat === "number" && typeof raw.lng === "number") {
    distanceMiles = roundMiles(
      haversineMiles(ctx.listingLat, ctx.listingLng, raw.lat, raw.lng)
    );
  }

  const providerKey =
    raw.source === "Eventbrite"
      ? "eventbrite"
      : raw.source === "PredictHQ"
      ? "predicthq"
      : raw.source === "Ticketmaster"
      ? "ticketmaster"
      : "other";

  const category = classify({
    provider: providerKey,
    providerHint: raw.categoryHint,
    title: raw.title,
    description: raw.description ?? null,
  });

  const candidate = {
    id: stableEventId(raw),
    title: truncate(raw.title.trim(), 120),
    summary: plainTextSummary(raw.description),
    source: raw.source,
    sourceIcon: SOURCE_ICON_MAP[raw.source] ?? "other",
    url,
    startsAt,
    endsAt,
    imageUrl,
    distanceMiles,
    category,
  };

  const parsed = EventSchema.safeParse(candidate);
  if (!parsed.success) {
    console.warn(
      `[normalize] dropping ${raw.source}/${raw.providerId}: zod`,
      parsed.error.flatten().fieldErrors
    );
    return null;
  }
  return parsed.data;
}

/**
 * Returns true if `event.lat/lng-derived distance` is within the radius.
 * Events with no coords (distanceMiles === 0 AND coords missing) are kept —
 * see comment in normalizeEvent above.
 */
export function withinRadius(
  event: Event,
  radiusMiles: number,
  hasCoords: boolean
): boolean {
  if (!hasCoords) return true;
  return event.distanceMiles <= radiusMiles;
}
