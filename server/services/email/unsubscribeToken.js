/**
 * unsubscribeToken.js — stateless, tamper-proof unsubscribe links.
 *
 * A link must identify the recipient when clicked from an email — possibly by a
 * guest who has no account and is not logged in. Rather than store a random
 * token per send, we sign the email address:
 *
 *   token = base64url(email) + '.' + base64url(HMAC-SHA256(email, SECRET))
 *
 * verifyToken recomputes the HMAC and constant-time compares it, so a token
 * cannot be forged or pointed at a different address without the server secret.
 * Nothing is persisted; the email is recovered from the token itself.
 */

'use strict';

const crypto = require('crypto');

// SECURITY (audit L1): a dedicated UNSUBSCRIBE_SECRET is preferred. Otherwise we
// derive a PURPOSE-SEPARATED key from a base secret rather than reusing the raw
// SUPER_ADMIN_JWT_SECRET / service-role key directly — so this HMAC can never
// double as the admin session-signing key. Links signed before purpose
// separation (with the raw base secret) are still honoured via LEGACY_SECRET, so
// no outstanding unsubscribe link breaks.
const BASE =
  process.env.SUPER_ADMIN_JWT_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'dev-unsubscribe-secret';
const DERIVED = crypto.createHmac('sha256', BASE).update('unsubscribe-token-v1').digest('hex');
// New tokens are signed with the dedicated secret if set, else the
// purpose-separated derived key (never the raw admin/service key — audit L1).
const SECRET = process.env.UNSUBSCRIBE_SECRET || DERIVED;
// verifyToken accepts ALL historical signing secrets, so setting a dedicated
// UNSUBSCRIBE_SECRET later never invalidates already-sent unsubscribe links:
//   - SECRET   (current: dedicated env, or derived when unset)
//   - DERIVED  (links signed after purpose-separation, before a dedicated secret)
//   - BASE     (oldest links signed with the raw admin/service key)
const ACCEPT_SECRETS = [...new Set([SECRET, DERIVED, BASE])];

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64url = (s) => {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
};

const signWith = (email, secret) =>
  b64url(crypto.createHmac('sha256', secret).update(email).digest());

const sign = (email) => signWith(email, SECRET);

// Constant-time string compare with a length guard (timingSafeEqual throws on
// unequal-length buffers).
const safeEqual = (a, b) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Build an unsubscribe token for an email address. */
function makeToken(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return '';
  return `${b64url(e)}.${sign(e)}`;
}

/**
 * Verify a token and recover the email.
 * @returns {string|null} the email if valid, else null.
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  let email;
  try {
    email = fromB64url(payload).toString('utf8').trim().toLowerCase();
  } catch (_) {
    return null;
  }
  if (!email) return null;
  // Accept a link signed with any historical secret (see ACCEPT_SECRETS).
  for (const secret of ACCEPT_SECRETS) {
    if (safeEqual(sig, signWith(email, secret))) return email;
  }
  return null;
}

module.exports = { makeToken, verifyToken };
