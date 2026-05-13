/**
 * Typed accessor for the owner-portal tokens.json.
 * Intentionally a small, palette-and-API subset — the dashboard does NOT
 * inherit the public site's full Tokens type because most fields are
 * irrelevant here (host bio, gallery, reviews, etc.).
 */
import raw from '../../tokens.json';

export type PortalTokens = {
  PORTAL_VERSION: string;
  LISTING_NAME: string;
  PORTAL_LABEL: string;
  OWNER_API_URL: string;

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

export const tokens = raw as PortalTokens;

export function hasApi(): boolean {
  return /^https?:\/\//i.test(tokens.OWNER_API_URL);
}
