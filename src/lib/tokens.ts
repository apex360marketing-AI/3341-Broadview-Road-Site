/**
 * Typed accessor for tokens.json — the single source of truth for client-specific values.
 * tokens.json is the only file most operators ever edit.
 */
import raw from '../../tokens.json';

export type Review = {
  initials: string;
  firstName: string;
  stars: number;
  date: string;
  body: string;
};

export type Tokens = {
  TEMPLATE_VERSION: string;

  LISTING_NAME: string;
  LISTING_TAGLINE: string;
  LISTING_SUBTAGLINE: string;
  LISTING_ID: string;
  META_DESCRIPTION: string;
  OG_IMAGE_PATH: string;

  MLS_NUMBER: string;
  ASKING_PRICE: number;
  ASKING_PRICE_DISPLAY: string;
  CURRENCY: string;
  PROPERTY_TYPE: string;
  LISTING_STATUS: string;

  BEDROOMS: number;
  DEN: boolean;
  BATHROOMS: number;
  BUILDING_TOTAL_SQFT: number;
  LOT_SIZE_SQFT: number;
  PARKING_SPACES: number;
  BUILT_YEAR: number;

  HERO_PHOTO: string;
  GALLERY_PHOTOS: string[];
  GALLERY_ALT: string[];

  AGENT_NAME: string;
  AGENT_FIRST_NAME: string;
  AGENT_BROKERAGE: string;
  AGENT_BLURB: string;
  AGENT_PHOTO_URL: string;
  AGENT_EMAIL: string;
  AGENT_PHONE: string;
  AGENT_OFFICE_PHONE: string;
  AGENT_WEBSITE: string;
  AGENT_RESPONSE_TIME: string;
  AGENT_BADGE: string;

  LISTING_ADDRESS_FULL: string;
  LISTING_ADDRESS_LINE: string;
  LISTING_LAT: number;
  LISTING_LNG: number;
  LISTING_LOCATION_DISPLAY: 'approximate' | 'exact';
  LISTING_LOCATION_RADIUS_M: number;
  WALKSCORE_WSAPIKEY: string;

  INQUIRY_WEBHOOK_URL: string;
  LIVE_FEED_URL: string;
  LIVE_FEED_HOST: string;
  TOS_URL: string;
  CSP_FRAME_ANCESTORS: string;

  PRIVACY_CONTACT_EMAIL: string;
  PRIVACY_LAST_UPDATED: string;
  BOOKING_SYSTEM_NAME: string;
  BOOKING_SYSTEM_REGION: string;

  REVIEWS_ARE_REAL: boolean;
  REVIEWS: Review[];

  LIVE_FEED_BLURB: string;

  PALETTE_BG_BASE: string;
  PALETTE_BG_SURFACE: string;
  PALETTE_BG_ELEVATED: string;
  PALETTE_INK_PRIMARY: string;
  PALETTE_INK_MUTED: string;
  PALETTE_INK_FAINT: string;
  PALETTE_ACCENT: string;
  PALETTE_ACCENT_HOVER: string;
  PALETTE_ACCENT_DEEP: string;
  PALETTE_ACCENT_2: string;
  FONT_SERIF: string;
  FONT_SANS: string;
};

export const tokens = raw as Tokens;

export function isWebhookHttps(url: string): boolean {
  return /^https:\/\//i.test(url);
}
