// Auto-generated usernames for new accounts — READABLE, never random.
//
// The username is the public profile URL (meeticulous.com/<username>), so it is
// derived from the person's NAME when there is one ("Mohini Daf" → mohini-daf),
// else from the email handle (priya.sharma+work@gmail.com → priya-sharma), else
// "user". On a clash the next free of base-2, base-3 … is used — digits only,
// never random characters. Same format rules as every other username write:
// normalizeSlug → [a-z0-9-] → 3–30 chars (utils/slugFormat.js), not reserved,
// not blocked.

const { isReserved } = require('./reservedUsernames');
const { normalizeSlug } = require('./slugNormalize');
const { isBlocked } = require('./adultContentFilter');
const { MIN, MAX } = require('./slugFormat');

const FALLBACK_BASE = 'user';
// Room for a "-NNN" collision suffix inside the 30-char cap.
const MAX_BASE = MAX - 4;
// Placeholder display names that are not a real name (phone signups use "Guest").
const PLACEHOLDER_NAMES = new Set(['guest', 'user', 'host', 'name', 'unknown', 'test']);

// Free text → slug-safe base, or null when unusable. Diacritics are folded to
// ASCII first (José → jose) so a real name survives the [a-z0-9-] gate.
function toBase(raw) {
  const ascii = String(raw || '').normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const base = normalizeSlug(ascii)
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, MAX_BASE)
    .replace(/^-+|-+$/g, '');
  if (base.length < MIN || isReserved(base) || isBlocked(base)) return null;
  return base;
}

function baseFromName(name) {
  const n = String(name || '').trim();
  if (!n || PLACEHOLDER_NAMES.has(n.toLowerCase()) || n.includes('@')) return null;
  return toBase(n);
}

// Email → base. Drops the domain and any "+tag". Too short / reserved / blocked → null.
function baseFromEmail(email) {
  const local = String(email || '').split('@')[0].split('+')[0];
  return toBase(local);
}

// The base a new account's username starts from: name → email handle → "user".
function baseFor({ name, email } = {}) {
  return baseFromName(name) || baseFromEmail(email) || FALLBACK_BASE;
}

// base, base-2, base-3 … — the n-th candidate (n starts at 1).
const candidateAt = (base, n) => (n === 1 ? base : `${base}-${n}`);

// First free, non-reserved candidate. `existsFn(slug) => Promise<boolean>` checks
// username_history (current + retired names, injected for tests). "user" itself
// is never handed out bare; it starts at user-2.
// ponytail: linear probe, one lookup per candidate, capped at 500 — past that a
// digits-only timestamp suffix (still no random letters); a LIKE-prefix query is
// the upgrade if a single base ever gets that crowded.
async function generateUnique(existsFn, { name, email } = {}) {
  const base = baseFor({ name, email });
  for (let n = base === FALLBACK_BASE ? 2 : 1; n <= 500; n += 1) {
    const candidate = candidateAt(base, n);
    if (isReserved(candidate)) continue;
    // eslint-disable-next-line no-await-in-loop
    if (!(await existsFn(candidate))) return candidate;
  }
  const last = `${base}-${Date.now()}`.slice(0, MAX);
  if (!(await existsFn(last))) return last;
  throw new Error('Could not generate a unique username');
}

module.exports = { baseFromEmail, baseFromName, baseFor, candidateAt, generateUnique, FALLBACK_BASE };
