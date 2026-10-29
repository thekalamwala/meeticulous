'use strict';

/**
 * manageBookingToken.js — signed, single-booking "manage this booking" link.
 *
 * Anonymous OTP guests have no session, so /user/my-bookings can never reach them
 * (MF3 #516). This token is the auth for a public manage page: it is emailed /
 * shown on the confirmation screen and lets the holder view + cancel exactly ONE
 * booking, without logging in — the same possession-based model as a password
 * reset link.
 *
 * Security:
 *   - HMAC-signed (jsonwebtoken) with the same SECRET as bookingGrant/OAuth state,
 *     namespaced by a `purpose` claim so it can never be confused with those.
 *   - Scoped to a single booking id (`bid`) → no enumeration / IDOR: a token for
 *     booking A can never act on booking B, and it grants nothing else.
 *   - The status guards in the cancel path (already-cancelled / completed) still
 *     apply, so a leaked token can't reopen or double-cancel anything.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const SECRET =
  process.env.OAUTH_STATE_SECRET ||
  crypto
    .createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-oauth-state')
    .update('oauth-state-v1')
    .digest('hex');

const PURPOSE = 'manage_booking';
// Bookings are near-term; 90 days comfortably covers view/cancel after the fact
// without minting effectively-permanent links.
const TTL = '90d';

// Sign a manage-link token for one booking. Returns null on a missing id.
const sign = (bookingId) => {
  if (!bookingId) return null;
  return jwt.sign({ purpose: PURPOSE, bid: String(bookingId) }, SECRET, { expiresIn: TTL });
};

// Return the booking id a valid token authorizes, or null. Never throws.
const verify = (token) => {
  if (!token || typeof token !== 'string') return null;
  let claims;
  try {
    claims = jwt.verify(token, SECRET);
  } catch {
    return null;
  }
  if (!claims || claims.purpose !== PURPOSE || !claims.bid) return null;
  return String(claims.bid);
};

module.exports = { sign, verify };
