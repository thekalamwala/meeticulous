/**
 * emailThemes.js — per-email visual identity registry.
 *
 * Maps each `email_category` to a semantic color family + header glyph. Both the
 * header (emailLayout.js) and the body hero helpers (emailComponents.js) read
 * from this single source so accent/tint/text never drift between header and body.
 *
 * All colors are precomputed SOLID hex (no 8-digit alpha) — Outlook desktop does
 * not render alpha hex. Glyphs are hosted PNGs (Outlook renders neither inline
 * SVG nor icon-fonts); an unmapped category yields an empty glyphUrl so the header
 * pill degrades to text-only instead of showing a broken image.
 */

'use strict';

// Semantic families — precomputed SOLID hex (no 8-digit alpha; Outlook-safe).
const FAMILIES = {
  slate:  { accent: '#41506a', tint: '#eef1f5', text: '#41506a' },
  green:  { accent: '#1aa463', tint: '#e8fff1', text: '#056800' },
  brand:  { accent: '#960D32', tint: '#fde9ee', text: '#7A0A28' },
  violet: { accent: '#6b4bb3', tint: '#f1ecfb', text: '#534ab7' },
  red:    { accent: '#d8453f', tint: '#fdeceb', text: '#a32d2d' },
  teal:   { accent: '#0f8a74', tint: '#e2f5f1', text: '#0f6e56' },
  blue:   { accent: '#2f7bd6', tint: '#e9f1fb', text: '#185fa5' },
  amber:  { accent: '#e89b1f', tint: '#fdf2dd', text: '#854f0b' },
  pink:   { accent: '#d4537e', tint: '#fbeaf0', text: '#993556' },
};

const ICON_BASE = 'https://company-assets.bookasloth.in/images/email/icons';

// email_category → family + glyph (see redesign spec registry table).
const CATEGORY_MAP = {
  'Security Check':       { family: 'slate',  glyph: 'shield-lock' },
  'Security Alert':       { family: 'slate',  glyph: 'shield-alert' },
  'Booking Confirmed':    { family: 'green',  glyph: 'calendar-check' },
  'New Booking':          { family: 'brand',  glyph: 'calendar-plus' },
  'Reminder':             { family: 'violet', glyph: 'bell' },
  'Booking Cancelled':    { family: 'red',    glyph: 'circle-x' },
  'Session Complete':     { family: 'teal',   glyph: 'circle-check' },
  'Rescheduled':          { family: 'blue',   glyph: 'calendar-clock' },
  'Account Update':       { family: 'blue',   glyph: 'user-cog' },
  'Achievement Unlocked': { family: 'amber',  glyph: 'trophy' },
  'Payment Receipt':      { family: 'green',  glyph: 'credit-card' },
  'Community Update':     { family: 'pink',   glyph: 'gift' },
  'Welcome':              { family: 'brand',  glyph: 'sparkles' },
  'Product Feedback':     { family: 'blue',   glyph: 'message-dots' },
  'Newsletter':           { family: 'brand',  glyph: 'mail' },
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
