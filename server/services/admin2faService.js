/**
 * admin2faService.js — pure TOTP + recovery-code helpers for admin 2FA.
 * No DB, no Express — fully unit testable.
 * Uses speakeasy (vetted CJS TOTP library) instead of hand-rolled crypto.
 * Uses bcryptjs for recovery-code hashing.
 */
'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');

const ISSUER = 'Meeticulous Admin';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a fresh TOTP secret and the otpauth:// URI to encode as a QR code.
 * @param {string} label  — email / identifier shown in the authenticator app
 * @returns {{ secret: string, otpauth: string }}
 */
const newSecret = (label) => {
  const s = speakeasy.generateSecret({ name: `${ISSUER} (${label})`, issuer: ISSUER });
  return { secret: s.base32, otpauth: s.otpauth_url };
};

/**
 * Verify a 6-digit TOTP token. Tolerates ±1 time-step (30 s) of clock skew.
 * @param {string|number} token
 * @param {string}        secret  — base32 encoded secret
 * @returns {boolean}
 */
const verifyToken = (token, secret) => verifyTokenStep(token, secret).valid;

/**
 * Verify a 6-digit TOTP token AND report which time step matched, so the caller
 * can persist it and reject a replay of the same code within the ±1-step window.
 *
 * speakeasy's totp.verifyDelta returns { delta } (relative step offset) on a
 * match, or undefined otherwise. The absolute step is
 * floor(now / 30) + delta — monotonically increasing, so callers can store the
 * highest consumed step and refuse anything <= it.
 *
 * @param {string|number} token
 * @param {string}        secret  — base32 encoded secret
 * @returns {{ valid: boolean, step: number|null }}
 */
const verifyTokenStep = (token, secret) => {
  if (!token || !secret) return { valid: false, step: null };
  try {
    const res = speakeasy.totp.verifyDelta({
      secret,
      encoding: 'base32',
      token: String(token).trim(),
      window: 1,
    });
    if (!res) return { valid: false, step: null };
    const step = Math.floor(Date.now() / 1000 / 30) + res.delta;
    return { valid: true, step };
  } catch (_) {
    return { valid: false, step: null };
  }
};

/**
 * Generate n unique recovery codes in XXXX-XXXX format.
 * Uses an unambiguous alphabet (no I, O, 0, 1).
 * @param {number} n
 * @returns {string[]}
 */
const generateRecoveryCodes = (n = 8) => {
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
  const one = () => {
    const bytes = Array.from(crypto.randomBytes(8));
    return bytes.map((b) => ALPH[b % ALPH.length]).join('');
  };
  const codes = new Set();
  while (codes.size < n) {
    const c = one();
    codes.add(`${c.slice(0, 4)}-${c.slice(4, 8)}`);
  }
  return [...codes];
};

/**
 * Hash recovery codes with bcrypt (cost 10).
 * @param {string[]} codes
 * @returns {Promise<string[]>}
 */
const hashRecoveryCodes = (codes) =>
  Promise.all(codes.map((c) => bcrypt.hash(c, 10)));

/**
 * Find which hashed recovery code matches the plaintext input.
 * Returns the index (0-based) of the match, or -1 if none.
 * @param {string}   code    — plaintext code supplied by the admin
 * @param {string[]} hashes  — stored bcrypt hashes
 * @returns {Promise<number>}
 */
const matchRecoveryCode = async (code, hashes) => {
  const list = hashes || [];
  const c = String(code || '').trim();
  for (let i = 0; i < list.length; i++) {
    if (await bcrypt.compare(c, list[i])) return i;
  }
  return -1;
};

module.exports = {
  newSecret,
  verifyToken,
  verifyTokenStep,
  generateRecoveryCodes,
  hashRecoveryCodes,
  matchRecoveryCode,
};
