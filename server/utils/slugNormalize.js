// Canonicalize a user-supplied slug/username into a single comparison key.
//
// Order is load-bearing: NFKC → strip invisibles → trim/collapse whitespace →
// lowercase → map separators → collapse/trim hyphens. ALWAYS run this BEFORE the
// format gate and the reserved check, so confusable/zero-width variants of a
// reserved word (e.g. "ＡＤＭＩＮ", "ad​min") canonicalize onto the reserved
// word and are rejected as reserved — not as a confusing format error.
//
// ASCII note: the output is intentionally NOT forced to ASCII here. Homoglyphs
// that survive NFKC (Cyrillic "а", dotless "ı") are left intact so the format
// gate (slugFormat.js, [a-z0-9-] only) rejects them. Storage is therefore
// ASCII-locked and homoglyphs can never be persisted, only attempted.

// Invisible / formatting / control characters to delete outright. Explicit list
// of the usual suspects (zero-width, BOM, soft hyphen, Mongolian vowel sep,
// bidi marks/embeds/isolates) PLUS the \p{Cf} (format) and \p{Cc} (control)
// catch-alls, so a novel invisible code point can't slip through.
const INVISIBLE_RE =
  /[­᠎​‌‍‎‏⁠⁦-⁩‪-‮﻿\p{Cf}\p{Cc}]/gu;

// Separators a human might type instead of a hyphen. NFKC does not fold these,
// so we map them explicitly: underscore, dot, space, en/em dash, middle dot,
// bullet. (Plain whitespace is also caught here after the trim/collapse step.)
const SEP_RE = /[\s_.·–—•]+/g;

// Extension point for a future homoglyph/confusable table. Today this is a
// no-op: the format gate already blocks non-ASCII, so confusables cannot be
// stored. Wire a Unicode confusables map here if impersonation via lookalikes
// ever becomes a real abuse vector.
function confusableFold(s) {
  return s;
}

function normalizeSlug(raw) {
  if (raw === null || raw === undefined) return '';
  let s = String(raw);
  if (typeof s.normalize === 'function') s = s.normalize('NFKC');
  s = s.replace(INVISIBLE_RE, '');
  s = s.trim().replace(/\s+/g, ' ');
  s = s.toLowerCase();
  s = confusableFold(s);
  s = s.replace(SEP_RE, '-');
  s = s.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return s;
}

module.exports = { normalizeSlug, confusableFold };
