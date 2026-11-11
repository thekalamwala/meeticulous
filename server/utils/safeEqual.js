'use strict';
const crypto = require('crypto');

/**
 * Constant-time string comparison for secrets / opaque tokens.
 *
 * Hashes BOTH sides with SHA-256 before `timingSafeEqual`, so:
 *   - inputs of differing length don't leak length (no early length return), and
 *   - `timingSafeEqual` (which throws on unequal-length buffers) never throws.
 *
 * Use for any secret/token equality check where the value is attacker-supplied
 * (webhook secrets, metrics/agent tokens, access tokens) instead of `===`/`!==`,
 * which short-circuits and is a timing oracle. Null/undefined compare as ''.
 */
const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a ?? ''), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b ?? ''), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
};

module.exports = { safeEqual };
