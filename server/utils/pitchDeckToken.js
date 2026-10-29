'use strict';

/**
 * pitchDeckToken.js — short-lived signed proof that a viewer passed the pitch-deck
 * passcode + WhatsApp-OTP gate. Issued on verify-otp; required by GET /pitch-deck/data,
 * which serves the confidential figures. Cloned from bookingGrant.js.
 *
 * Reuses OAUTH_STATE_SECRET (already CRITICAL + validated at boot). Namespaced by a
 * `purpose: 'pitch_deck'` claim so it can never be confused with OAuth/booking tokens.
 * No new signing secret required.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const SECRET =
  process.env.OAUTH_STATE_SECRET ||
  crypto
    .createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-oauth-state')
    .update('oauth-state-v1')
    .digest('hex');

const PURPOSE = 'pitch_deck';
const TTL = '45m';           // short session — viewer re-verifies after 45 min
const TTL_SEC = 45 * 60;

// Issue a 45-min access token for a viewer who cleared the gate.
const issue = (sub = 'viewer') =>
  jwt.sign({ purpose: PURPOSE, sub: String(sub) }, SECRET, { expiresIn: TTL });

// Return decoded claims for a valid, unexpired pitch_deck token, else null. Never throws.
const verifyToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  let claims;
  try {
    claims = jwt.verify(token, SECRET);
  } catch {
    return null;
  }
  if (!claims || claims.purpose !== PURPOSE) return null;
  return claims;
};

module.exports = { issue, verifyToken, TTL_SEC };
