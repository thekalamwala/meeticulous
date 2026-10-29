'use strict';

/**
 * bookingGrant.js — short-lived signed proof that a guest verified their contact
 * via OTP. `verifyOtp` issues one on success; `createBooking` requires + checks
 * it for anonymous (not-logged-in) bookings, so a booking is bound to the contact
 * that actually received the code.
 *
 * Security audit H-1: the booking OTP was previously enforced ONLY in the browser
 * (verify-otp and POST /bookings were two unlinked calls). The API trusted a bare
 * guest_email/guest_phone, letting anyone create bookings for any address
 * (notification/phishing relay + slot squatting). This grant closes that gap.
 *
 * Reuses OAUTH_STATE_SECRET (already present and validated in production); tokens
 * are namespaced by a `purpose` claim so they can never be confused with OAuth
 * state tokens (which carry `flow`, never `purpose`). No new env var required.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const SECRET =
  process.env.OAUTH_STATE_SECRET ||
  crypto
    .createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-oauth-state')
    .update('oauth-state-v1')
    .digest('hex');

const PURPOSE = 'guest_booking';
// 30m so a guest who verifies then takes their time on the details/payment step
// doesn't get a 401 at submit. Matches the 30-min pending-hold window (UX rec).
const TTL = '30m';

// Mirrors authController's OTP identifier normalisation (phone-first, email
// fallback) so the grant subject lines up with what was actually verified.
const normalizePhone = (p) => {
  const cleaned = String(p || '').replace(/[\s\-().]/g, '');
  return /^\+?\d{8,15}$/.test(cleaned) ? cleaned : null;
};

const identifierOf = ({ email, phone } = {}) =>
  normalizePhone(phone) || String(email || '').toLowerCase().trim();

const normalizeEmail = (e) => String(e || '').toLowerCase().trim() || null;

/**
 * Issue a grant for a freshly-verified contact. Returns null if no identifier.
 *
 * Security audit R-3: the grant now carries the full verified channel tuple
 * (`ph` + `em`), not just the phone-first `sub`. `sub` stays for back-compat, but
 * `verify` additionally pins every channel the booking presents to the channel
 * that was actually verified — closing the "verify my own phone, then book with a
 * victim's email" notification-relay vector.
 */
const issue = ({ email, phone } = {}) => {
  const ph = normalizePhone(phone);
  const em = normalizeEmail(email);
  const sub = ph || em;                      // phone-first primary subject (back-compat)
  if (!sub) return null;
  return jwt.sign({ purpose: PURPOSE, sub, ph: ph || null, em }, SECRET, { expiresIn: TTL });
};

/**
 * True only if `token` is a valid, unexpired guest_booking grant whose verified
 * contact matches the contact being booked. Never throws.
 *
 * Two layers:
 *   1. Primary subject (`sub`) must timing-safe-match the phone-first identifier
 *      of the booking contact (covers legacy tokens with no channel claims).
 *   2. Channel-tuple binding (audit R-3): once a token carries explicit `ph`/`em`
 *      claims, EVERY channel present in the booking must equal the verified one —
 *      and a channel that was never verified (claim is null) may not be supplied
 *      at all. Legacy tokens (no channel claims) pass on layer 1 alone during the
 *      30-min TTL rollout window.
 */
const verify = (token, { email, phone } = {}) => {
  if (!token || typeof token !== 'string') return false;
  const reqPhone = normalizePhone(phone);
  const reqEmail = normalizeEmail(email);
  const expected = reqPhone || reqEmail;     // phone-first primary identifier
  if (!expected) return false;
  let claims;
  try {
    claims = jwt.verify(token, SECRET);
  } catch {
    return false;
  }
  if (!claims || claims.purpose !== PURPOSE || !claims.sub) return false;

  // Layer 1 — primary subject (timing-safe).
  const a = Buffer.from(String(claims.sub));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  // Layer 2 — channel-tuple binding (audit R-3). Only enforced for new-style
  // tokens that carry the channel claims.
  const hasChannelClaims = Object.prototype.hasOwnProperty.call(claims, 'ph')
    || Object.prototype.hasOwnProperty.call(claims, 'em');
  if (hasChannelClaims) {
    if (reqPhone && reqPhone !== (claims.ph || null)) return false; // phone mismatch or not verified
    if (reqEmail && reqEmail !== (claims.em || null)) return false; // email mismatch or not verified
  }
  return true;
};

module.exports = { issue, verify, identifierOf, normalizePhone };
