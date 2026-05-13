/**
 * Frozen output contract for the live-events feed.
 *
 * Both the Worker (producer) and the VALORA static site (consumer) validate
 * against this schema. Any breaking change MUST bump `schemaVersion` and ship
 * a coordinated update to the front-end.
 *
 * See docs/live-feed-schema.md for the human-readable contract.
 */
import { z } from "zod";

export const SCHEMA_VERSION = "1.0.0";

/**
 * 9-category taxonomy. Frozen — front-end uses these for icons + filter chips.
 * Anything we can't confidently map falls into `other`.
 *
 *   music       — concerts, DJ sets, gigs
 *   food-drink  — culinary events, food festivals, brewery/cidery openings
 *   wine        — winery tastings, wine festivals, paired dinners at wineries
 *   outdoor     — hikes, trail events, ski/board, cycling
 *   family      — kid-focused, family programming, school holidays
 *   arts        — theatre, comedy, gallery openings, performing arts
 *   market      — farmers' markets, craft markets, expos, community fairs
 *   sport       — sporting events, tournaments
 *   other       — everything else
 */
export const CategoryEnum = z.enum([
  "music",
  "food-drink",
  "wine",
  "outdoor",
  "family",
  "arts",
  "market",
  "sport",
  "other",
]);
export type Category = z.infer<typeof CategoryEnum>;

/**
 * Source labels are user-facing. `string` is permitted at the type level so a
 * future provider doesn't require a schema bump, but the three live providers
 * MUST use the exact strings below for the site's icon mapping to work.
 */
export const SourceEnum = z.enum([
  "Eventbrite",
  "PredictHQ",
  "Ticketmaster",
  "Tourism Kelowna",
  "Manual",
]);
export type Source = z.infer<typeof SourceEnum>;

export const SourceIconEnum = z.enum([
  "eventbrite",
  "predicthq",
  "ticketmaster",
  "other",
]);
export type SourceIcon = z.infer<typeof SourceIconEnum>;

/**
 * HTTPS-only URL guard. Rejects `javascript:`, `data:`, `http:`, etc.
 * Used for both `url` and `imageUrl`.
 */
const HttpsUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://"), {
    message: "URL must use https:// scheme",
  });

/**
 * ISO 8601 datetime in UTC (`Z` suffix). normalizeEvent() uses
 * `Date.prototype.toISOString()` which always emits `Z`, so this is the
 * tightest valid form for the schema.
 */
const IsoDateTimeUtc = z.string().datetime();

export const EventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  summary: z.string().max(280),
  source: z.union([SourceEnum, z.string().min(1)]),
  sourceIcon: SourceIconEnum,
  url: HttpsUrl,
  startsAt: IsoDateTimeUtc,
  endsAt: IsoDateTimeUtc.nullable(),
  imageUrl: HttpsUrl.nullable(),
  distanceMiles: z.number().nonnegative(),
  category: CategoryEnum,
});
export type Event = z.infer<typeof EventSchema>;

export const FeedPayloadSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  updatedAt: IsoDateTimeUtc.nullable(),
  events: z.array(EventSchema).max(30),
});
export type FeedPayload = z.infer<typeof FeedPayloadSchema>;

/** Hard cap on events served — enforced both here and in refresh.ts. */
export const MAX_EVENTS = 30;

/**
 * Internal raw shape produced by provider adapters BEFORE normalization +
 * Zod validation. Looser than `Event` on purpose — normalization fills in
 * defaults, coerces dates, and rejects what can't be salvaged.
 */
export interface RawEvent {
  providerId: string;
  source: Source;
  title: string;
  description?: string | null;
  url: string;
  startsAt: string; // ISO string
  endsAt?: string | null;
  imageUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Provider-native category hint — e.g. Eventbrite `category_id`, TM segment name. */
  categoryHint?: string | null;
}
