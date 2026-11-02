/**
 * emailThemes.js — per-email visual identity registry.
 *
 * Maps each `email_category` to the (single, crimson) colour family + glyph name. Both the
 * header (emailLayout.js) and the body hero helpers (emailComponents.js) read
 * from this single source so accent/tint/text never drift between header and body.
 *
 * All colors are precomputed SOLID hex (no 8-digit alpha) — Outlook desktop does
 * not render alpha hex. Glyphs are hosted PNGs (Outlook renders neither inline
 * SVG nor icon-fonts); an unmapped category yields an empty glyphUrl so the header
 * pill degrades to text-only instead of showing a broken image.
 */

'use strict';

// One palette for every email (2026-11 redesign): crimson brand + its blush tint.
// Categories no longer get their own colour — the header pill label carries the
// meaning. Precomputed SOLID hex (no 8-digit alpha; Outlook-safe).
const FAMILIES = {
  brand: { accent: '#960D32', tint: '#FBE3E8', text: '#960D32' },
};

const ICON_BASE = 'https://meeticulous.com/images/email/icons';

// email_category → family + glyph (see redesign spec registry table).
const CATEGORY_MAP = {
  'Security Check':       { family: 'brand', glyph: 'shield-lock' },
  'Security Alert':       { family: 'brand', glyph: 'shield-alert' },
  'Booking Confirmed':    { family: 'brand', glyph: 'calendar-check' },
  'New Booking':          { family: 'brand', glyph: 'calendar-plus' },
  'Reminder':             { family: 'brand', glyph: 'bell' },
  'Booking Cancelled':    { family: 'brand', glyph: 'circle-x' },
  'Session Complete':     { family: 'brand', glyph: 'circle-check' },
  'Rescheduled':          { family: 'brand', glyph: 'calendar-clock' },
  'Account Update':       { family: 'brand', glyph: 'user-cog' },
  'Achievement Unlocked': { family: 'brand', glyph: 'trophy' },
  'Payment Receipt':      { family: 'brand', glyph: 'credit-card' },
  'Community Update':     { family: 'brand', glyph: 'gift' },
  'Welcome':              { family: 'brand', glyph: 'sparkles' },
  'Product Feedback':     { family: 'brand', glyph: 'message-dots' },
  'Newsletter':           { family: 'brand', glyph: 'mail' },
};

const DEFAULT = { family: 'brand', glyph: '' };

/** Resolve a theme for an email_category. Never throws; unknown → brand, no glyph. */
function themeForCategory(category) {
  const m = CATEGORY_MAP[category] || DEFAULT;
  const fam = FAMILIES[m.family] || FAMILIES.brand;
  return {
    family: m.family,
    accent: fam.accent,
    tint: fam.tint,
    text: fam.text,
    glyph: m.glyph,
    glyphUrl: m.glyph ? `${ICON_BASE}/${m.glyph}.png` : '',
  };
}

module.exports = { themeForCategory, FAMILIES, CATEGORY_MAP, ICON_BASE };
