// Adult / sexual-content slug filter — a CONTENT layer, distinct from the exact-
// match reserved-name layers (L1 config/reservedNamespaces, L2 reserved_slugs).
// Those answer "is this a platform/route name?"; this answers "is this an adult-
// site domain, adult brand, adult-performer handle, or explicit sexual keyword?"
// so hosts cannot register slugs like `bestpornhub`, `xnxxfan`, `miakhalifa99`,
// `sex-coach`, or leetspeak evasions (`pr0nhub`, `0nlyfans`, `s3x`).
//
// Data lives in config/blockedTerms.json (VERSIONED — edit data, not code).
//
// Matching is TIERED to trade evasion-resistance against the Scunthorpe problem
// (false-blocking innocent slugs like `sussex`, `analysis`, `cumberland`):
//   substring/performers/hard — matched ANYWHERE in the leet-folded, hyphen-
//       stripped "compact" form. Catches `bestpornhub`, `miakhalifa99`, `p0rn`.
//   token — keywords that also live inside innocent words (sex→su-sex, anal→
//       anal-ysis, cum→cu-cumber). Matched as a WHOLE hyphen token only (with
//       leading/trailing digits stripped so `sex1`/`69sex` still hit), NEVER as
//       a substring. So `sussex-yoga` and `analysis-pro` pass untouched.
//   allowlist — explicit compact slugs that SURVIVE a substring/hard hit; the
//       escape hatch (and the safety net if a token term is later promoted to
//       the substring tier). Does not affect the token tier, which is already
//       collision-free by construction.
//
// Leet folding maps 0→o 3→e 4→a 5→s 7→t @→a $→s before matching. Because `1` is
// ambiguous (l vs i — `s1ut`→slut but `d1ck`→dick) BOTH foldings are tested.
//
// LIMITATION (by design): performer-handle substring matching can also catch a
// real person who happens to share a stage name (e.g. a genuine "Aria Lee").
// The versioned blocklist + the L2 admin allowlist are the remediation path.

const { normalizeSlug } = require('./slugNormalize');
const data = require('../config/blockedTerms.json');

// Fixed leetspeak substitutions (excluding the ambiguous `1`, handled below).
const LEET = { '0': 'o', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

// Fold a string's leet chars. `oneAs` chooses how to resolve the ambiguous `1`.
function foldLeet(s, oneAs) {
  let out = '';
  for (const ch of s) {
    if (ch === '1') out += oneAs;
    else out += LEET[ch] || ch;
  }
  return out;
}

// Reduce a term/slug to comparison form: lowercase alphanumerics only.
function compact(s) {
  return s.replace(/[^a-z0-9]/g, '');
}

// Load-time term preparation: everything is lowercased + compacted so the JSON
// can carry hyphens/spaces for readability without affecting matching.
const SUBSTRING = [...data.substring, ...data.performers, ...data.hard]
  .map((t) => compact(String(t).toLowerCase()))
  .filter(Boolean);
const TOKEN = new Set(
  (data.token || []).map((t) => compact(String(t).toLowerCase())).filter(Boolean),
);
const ALLOW = new Set(
  (data.allowlist || []).map((t) => compact(String(t).toLowerCase())).filter(Boolean),
);

// Compact forms of the whole slug under both `1`-foldings (deduped).
function compactVariants(norm) {
  const l = compact(foldLeet(norm, 'l'));
  const i = compact(foldLeet(norm, 'i'));
  return l === i ? [l] : [l, i];
}

// Per-hyphen-token forms under both foldings, with leading/trailing digits
// stripped (so `sex1`, `1sex`, `69sex` all reduce to `sex`).
function tokenVariants(norm) {
  const out = new Set();
  for (const raw of norm.split('-')) {
    if (!raw) continue;
    // Consider both the raw token and an edge-digit-stripped copy BEFORE folding,
    // so a numeric suffix (`sex1`, `69sex`) reduces to the keyword even though
    // `1` is otherwise leet-folded to a letter (`sex1`→`sexl`).
    const bases = new Set([raw, raw.replace(/^\d+|\d+$/g, '')]);
    for (const base of bases) {
      for (const oneAs of ['l', 'i']) {
        const t = compact(foldLeet(base, oneAs)).replace(/^\d+|\d+$/g, '');
        if (t) out.add(t);
      }
    }
  }
  return out;
}

// Returns the offending term (for logging/admin) or null. Prefer isBlocked() at
// call sites; the term is intentionally NOT surfaced to end users.
function blockedTerm(raw) {
  const norm = normalizeSlug(raw);
  if (!norm) return null;

  const compacts = compactVariants(norm);
  const allowed = compacts.some((c) => ALLOW.has(c));
  if (!allowed) {
    for (const c of compacts) {
      for (const term of SUBSTRING) {
        if (c.includes(term)) return term;
      }
    }
  }

  const tokens = tokenVariants(norm);
  for (const term of TOKEN) {
    if (tokens.has(term)) return term;
  }
  return null;
}

// Public guard: true if the slug hits any adult-content tier. Normalizes
// internally, so callers may pass a raw or already-normalized slug.
function isBlocked(raw) {
  return blockedTerm(raw) !== null;
}

module.exports = {
  isBlocked,
  blockedTerm,
  VERSION: data.version,
  // exported for tests / an admin "why" view
  _internal: { foldLeet, compact, compactVariants, tokenVariants },
};
