// Auto-generated usernames: {email-local-part}-{4 random base36 chars}, lowercase.
// e.g. priya.sharma+work@gmail.com → priya-sharma-x4k9
//
// The random suffix keeps two people with the same email handle (priya@gmail /
// priya@outlook) from colliding. No usable email (phone-only guest, junk/reserved
// handle) falls back to the base "user". generateUnique() retries on collision
// against existing history and widens the suffix if 4 chars keep colliding.

const crypto = require('crypto');
const { isReserved } = require('./reservedUsernames');
const { normalizeSlug } = require('./slugNormalize');
const { isBlocked } = require('./adultContentFilter');

const FALLBACK_BASE = 'user';
// 30-char username cap (onboarding/slug format) minus "-" + 4-char suffix.
const MAX_BASE = 25;

// Short, lowercase base36 suffix from crypto-random bytes.
function randomSuffix(len = 4) {
  let s = '';
  while (s.length < len) {
    s += crypto.randomBytes(4).readUInt32BE(0).toString(36);
  }
  return s.slice(0, len);
}

// Email → slug-safe base. Drops the domain and any "+tag", maps separators to
// hyphens, keeps [a-z0-9-] only. Too short / reserved / blocked → "user".
function baseFromEmail(email) {
  const local = String(email || '').split('@')[0].split('+')[0];
  const base = normalizeSlug(local)
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, MAX_BASE)
    .replace(/^-+|-+$/g, '');
  if (base.length < 3 || isReserved(base) || isBlocked(base)) return FALLBACK_BASE;
  return base;
}

function generateCandidate(email, suffixLen = 4) {
  return `${baseFromEmail(email)}-${randomSuffix(suffixLen)}`;
}

// Produce a candidate guaranteed not-reserved and not-already-used.
// `existsFn(slug) => Promise<boolean>` checks the username_history table (injected
// for testability). Falls back to a longer suffix if 20 tries all collide.
async function generateUnique(existsFn, email) {
  for (let i = 0; i < 20; i++) {
    const candidate = generateCandidate(email);
    if (isReserved(candidate)) continue;
    // eslint-disable-next-line no-await-in-loop
    if (!(await existsFn(candidate))) return candidate;
  }
  // Extremely unlikely fallback: widen the suffix space.
  for (let i = 0; i < 5; i++) {
    const candidate = generateCandidate(email, 8);
    // eslint-disable-next-line no-await-in-loop
    if (!isReserved(candidate) && !(await existsFn(candidate))) return candidate;
  }
  throw new Error('Could not generate a unique username');
}

module.exports = { baseFromEmail, generateCandidate, generateUnique, randomSuffix };
