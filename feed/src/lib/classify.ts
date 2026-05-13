/**
 * Category classification.
 *
 * Each provider hands us a different taxonomy. We collapse all of them into
 * the nine public categories declared in schema.ts. Anything we can't
 * confidently place → `other`.
 *
 * The mappings are intentionally conservative — better to land on `other`
 * than mis-tag a wine festival as "outdoor".
 */
import type { Category } from "../schema";

/**
 * Eventbrite category_id (https://www.eventbrite.com/platform/api#/reference/category).
 * Subcategories not enumerated — Eventbrite returns the parent category_id
 * as a stringified integer on most events.
 */
const EVENTBRITE_CATEGORY_MAP: Record<string, Category> = {
  "103": "music",       // Music
  "105": "arts",        // Performing & Visual Arts
  "104": "arts",        // Film, Media & Entertainment
  "108": "sport",       // Sports & Fitness
  "109": "outdoor",     // Travel & Outdoor
  "110": "food-drink",  // Food & Drink
  "113": "family",      // Family & Education
  "115": "market",      // Hobbies (often markets/expos)
  "118": "market",      // Community
  "199": "other",       // Other
};

/**
 * PredictHQ event.category values (https://docs.predicthq.com/resources/events).
 */
const PREDICTHQ_CATEGORY_MAP: Record<string, Category> = {
  "concerts": "music",
  "festivals": "other",          // generic — let keyword classifier refine
  "performing-arts": "arts",
  "community": "market",
  "expos": "market",
  "conferences": "other",
  "sports": "sport",
  "public-holidays": "other",
  "observances": "other",
  "school-holidays": "family",
  "politics": "other",
  "daylight-savings": "other",
};

/**
 * Ticketmaster classification.segment.name values.
 */
const TICKETMASTER_SEGMENT_MAP: Record<string, Category> = {
  "Music": "music",
  "Sports": "sport",
  "Arts & Theatre": "arts",
  "Film": "arts",
  "Family": "family",
  "Miscellaneous": "other",
};

/**
 * Keyword fallback — runs against title + description when no provider hint
 * resolved. Order matters: the FIRST match wins, so put narrow signals first.
 */
const KEYWORD_RULES: ReadonlyArray<{ re: RegExp; cat: Category }> = [
  { re: /\bwine(ry|ries)?\b|\bvineyard\b|\bcellar\b|\btasting\b|\bsommelier\b/i, cat: "wine" },
  { re: /\bbrew(ery|ing)?\b|\bcider\b|\bdistiller(y|ies)?\b|\bcocktail\b/i, cat: "food-drink" },
  { re: /\bmarket\b|\bfarmer'?s\s+market\b|\bcraft\s+(market|fair)\b|\bexpo\b/i, cat: "market" },
  { re: /\bfood\b|\bdine\b|\bdinner\b|\bculinary\b|\bchef\b|\bbrunch\b|\btruck\b/i, cat: "food-drink" },
  { re: /\btheatre\b|\btheater\b|\bcomedy\b|\bgallery\b|\bart\s+show\b|\bopera\b|\bballet\b/i, cat: "arts" },
  { re: /\bconcert\b|\blive\s+music\b|\bband\b|\bdj\b|\bshow\b|\bgig\b/i, cat: "music" },
  { re: /\bgame\b|\btournament\b|\bmatch\b|\brace\b|\bracing\b|\bplayoff(s)?\b/i, cat: "sport" },
  { re: /\bhike\b|\btrail\b|\boutdoor\b|\bski\b|\bsnowboard\b|\bbike\b|\bcycl(e|ing)\b|\bpaddle\b|\bkayak\b/i, cat: "outdoor" },
  { re: /\bkid(s)?\b|\bfamily\b|\bchildren\b|\btoddler\b|\bteen(s)?\b/i, cat: "family" },
];

export function classifyEventbrite(categoryId?: string | null): Category | null {
  if (!categoryId) return null;
  return EVENTBRITE_CATEGORY_MAP[categoryId] ?? null;
}

export function classifyPredictHQ(category?: string | null): Category | null {
  if (!category) return null;
  return PREDICTHQ_CATEGORY_MAP[category.toLowerCase()] ?? null;
}

export function classifyTicketmaster(segment?: string | null): Category | null {
  if (!segment) return null;
  return TICKETMASTER_SEGMENT_MAP[segment] ?? null;
}

export function classifyByKeywords(text: string): Category | null {
  if (!text) return null;
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(text)) return rule.cat;
  }
  return null;
}

/**
 * Top-level: try the provider's own taxonomy first, then fall back to
 * keyword scanning over title + description, then `other`.
 *
 * Special case for PredictHQ "festivals" — we map it to `other` in the
 * provider table so the keyword scanner gets a chance to refine ("wine
 * festival" → wine, "music festival" → music, etc.).
 */
export function classify(args: {
  provider: "eventbrite" | "predicthq" | "ticketmaster" | "other";
  providerHint?: string | null;
  title?: string | null;
  description?: string | null;
}): Category {
  let mapped: Category | null = null;
  switch (args.provider) {
    case "eventbrite":
      mapped = classifyEventbrite(args.providerHint);
      break;
    case "predicthq":
      mapped = classifyPredictHQ(args.providerHint);
      break;
    case "ticketmaster":
      mapped = classifyTicketmaster(args.providerHint);
      break;
  }

  // If the provider mapped to a NARROW category, trust it. If it mapped to
  // `other` (or didn't map at all), give the keyword scanner a chance to
  // refine using the title + description signals.
  if (mapped && mapped !== "other") return mapped;

  const text = `${args.title ?? ""} ${args.description ?? ""}`.trim();
  return classifyByKeywords(text) ?? mapped ?? "other";
}
