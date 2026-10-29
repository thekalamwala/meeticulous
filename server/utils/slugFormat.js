// Single source of truth for username/slug FORMAT. Replaces the two divergent
// regexes that existed before: usernameController (3–30, strict hyphen groups)
// and vendorOnboardingController.isValidSlug (3–60, loose [a-z0-9-]). Operates
// on an ALREADY-NORMALIZED slug (see utils/slugNormalize.js) — non-ASCII and
// stray separators have been folded/stripped by the time we get here, so a
// surviving non-ASCII char (homoglyph) correctly fails this gate.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN = 3;
const MAX = 30;

// Returns an error string for a normalized slug, or null when the format is OK.
function formatError(norm) {
  if (!norm || norm.length < MIN || norm.length > MAX) {
    return `Must be ${MIN}–${MAX} characters.`;
  }
  if (!SLUG_RE.test(norm)) {
    return 'Use only lowercase letters, numbers, and single hyphens.';
  }
  return null;
}

module.exports = { SLUG_RE, formatError, MIN, MAX };
