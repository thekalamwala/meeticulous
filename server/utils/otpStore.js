/**
 * otpStore.js — DB-backed secure OTP store (otp_codes table).
 *
 * Security model (v1.9):
 *   - 6-digit OTP, bcrypt-hashed (otp_hash) — plaintext is NEVER stored
 *   - 10 minute expiry
 *   - max 3 verify attempts per OTP
 *   - max 3 sends per rolling hour per email
 *   - 15 minute lockout after limits are hit
 *
 * Backwards compatible with pre-v1.9 rows: if otp_hash columns are missing
 * (migration not applied), falls back to the legacy plaintext column so
 * production never breaks.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { isLoadTestMode } = require('../config/loadTestMode');
const { isOpenAccess } = require('../config/openAccessWindow');

const TTL_MS         = 10 * 60 * 1000;  // 10 min expiry
const MAX_ATTEMPTS   = 3;               // verify attempts per OTP
const MAX_SENDS      = 3;               // sends per rolling hour
const SEND_WINDOW_MS = 60 * 60 * 1000;  // 1 hour
const LOCKOUT_MS     = 15 * 60 * 1000;  // 15 min lockout

const normalizeEmail = (e) => (e || '').toLowerCase().trim();

const _isMissingSchema = (error) =>
  error && /Could not find the|column.*does not exist/i.test(error.message || '');

/** Generate a 6-digit OTP (CSPRNG). Fixed in load mode for deterministic tests. */
const generate = () => (isLoadTestMode() ? '000000' : crypto.randomInt(100000, 1000000).toString());

/**
 * Store (or replace) an OTP for the given email, enforcing send rate limits.
 * Returns { ok: true } or { ok: false, reason }.
 * Throws only on unexpected DB errors.
 */
const _isMissingConflictTarget = (error) =>
  error && /no unique or exclusion constraint matching the ON CONFLICT/i.test(error.message || '');

const set = async (email, otp, type = 'booking') => {
  const key = normalizeEmail(email);
  const now = Date.now();

  // Read existing row for rate-limit state. Scoped by `type` (audit P1-9): the
  // otp_codes PK is (email, type), so booking and password-reset codes live in
  // separate rows and a booking send never clobbers an in-flight reset code.
  const { data: existing } = await supabaseAdmin
    .from('otp_codes')
    .select('*')
    .eq('email', key)
    .eq('type', type)
    .maybeSingle();

  // Open-access window (launch/event): skip the per-contact send cap + lockout so
  // every user gets an OTP instantly. Still stores/replaces the code below; only the
  // throttle is lifted. Auto re-gates when the window closes. Companion to the limiter
  // + ipGuard bypass in security.js/ipGuard.js.
  if (existing && !isOpenAccess()) {
    if (existing.locked_until && new Date(existing.locked_until).getTime() > now) {
      const mins = Math.ceil((new Date(existing.locked_until).getTime() - now) / 60000);
      return { ok: false, reason: `Too many requests. Try again in ${mins} minute(s).` };
    }
    const windowStart = existing.first_send_at ? new Date(existing.first_send_at).getTime() : 0;
    const inWindow = now - windowStart < SEND_WINDOW_MS;
    if (inWindow && (existing.send_count || 0) >= MAX_SENDS) {
      // Hit the hourly send cap → 15 min lockout
      await supabaseAdmin
        .from('otp_codes')
        .update({ locked_until: new Date(now + LOCKOUT_MS).toISOString() })
        .eq('email', key)
        .eq('type', type);
      return { ok: false, reason: 'Too many OTP requests. Try again in 15 minutes.' };
    }
    var sendCount   = inWindow ? (existing.send_count || 0) + 1 : 1;
    var firstSendAt = inWindow && existing.first_send_at ? existing.first_send_at : new Date(now).toISOString();
  } else {
    var sendCount = 1;
    var firstSendAt = new Date(now).toISOString();
  }

  const otpHash = await bcrypt.hash(String(otp).trim(), 10);
  const payload = {
    email: key,
    otp: '',                                   // plaintext never stored (legacy column kept empty)
    otp_hash: otpHash,
    attempts: 0,
    send_count: sendCount,
    first_send_at: firstSendAt,
    locked_until: null,
    expires_at: new Date(now + TTL_MS).toISOString(),
    type,
  };

  // Upsert on the composite key (email, type) (audit P1-9). If the v3.44
  // migration isn't applied yet (composite PK absent), fall back to the legacy
  // (email) conflict target so a brief deploy-before-migrate gap still works.
  const upsert = async (row) => {
    let r = await supabaseAdmin.from('otp_codes').upsert(row, { onConflict: 'email,type' });
    if (_isMissingConflictTarget(r.error)) {
      r = await supabaseAdmin.from('otp_codes').upsert(row, { onConflict: 'email' });
    }
    return r;
  };

  let { error } = await upsert(payload);

  if (_isMissingSchema(error)) {
    // Pre-v1.9 DB: fall back to legacy plaintext storage
    const { otp_hash, attempts, send_count, first_send_at, locked_until, ...legacy } = payload;
    legacy.otp = String(otp).trim();
    ({ error } = await upsert(legacy));
  }

  if (error) throw new Error(`OTP store error: ${error.message}`);
  return { ok: true };
};

/**
 * Verify an OTP. Returns { valid: true } or { valid: false, reason }.
 * Deletes the row on success (single-use). Locks out after MAX_ATTEMPTS.
 *
 * `expectedType` (security audit M-2): a code is bound to the purpose it was
 * issued for. There is one otp_codes row per email (onConflict:'email'), shared
 * between booking/login codes (type 'booking') and password-reset codes (type
 * 'password_reset'). Without this gate a password-reset code could be redeemed
 * on the booking/login path (account-takeover-adjacent). All booking/login/
 * product/whatsapp callers use the 'booking' default; the reset path verifies
 * its own type separately.
 */
const verify = async (email, otp, expectedType = 'booking') => {
  const key = normalizeEmail(email);
  const now = Date.now();

  // Scope the read to this purpose's row (audit P1-9): a booking code and a
  // password-reset code for the same email are now separate rows.
  const { data: record, error } = await supabaseAdmin
    .from('otp_codes')
    .select('*')
    .eq('email', key)
    .eq('type', expectedType)
    .maybeSingle();

  if (error || !record) {
    return { valid: false, reason: 'No OTP found. Request a new one.' };
  }

  // Reject a code issued for a different purpose (e.g. a password_reset code
  // presented to the booking/login verifier). Legacy rows without `type` pass.
  if (record.type && record.type !== expectedType) {
    return { valid: false, reason: 'No OTP found. Request a new one.' };
  }

  if (record.locked_until && new Date(record.locked_until).getTime() > now) {
    const mins = Math.ceil((new Date(record.locked_until).getTime() - now) / 60000);
    return { valid: false, reason: `Too many attempts. Try again in ${mins} minute(s).` };
  }

  if (new Date(record.expires_at).getTime() < now) {
    await supabaseAdmin.from('otp_codes').delete().eq('email', key).eq('type', expectedType);
    return { valid: false, reason: 'OTP expired. Request a new one.' };
  }

  // Compare: hashed (v1.9) or legacy plaintext
  const supplied = String(otp).trim();
  let matches;
  if (record.otp_hash) {
    matches = await bcrypt.compare(supplied, record.otp_hash);
  } else {
    matches = record.otp === supplied;
  }

  if (!matches) {
    const attempts = (record.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await supabaseAdmin
        .from('otp_codes')
        .update({ attempts, locked_until: new Date(now + LOCKOUT_MS).toISOString() })
        .eq('email', key)
        .eq('type', expectedType);
      return { valid: false, reason: 'Too many incorrect attempts. Try again in 15 minutes.' };
    }
    await supabaseAdmin.from('otp_codes').update({ attempts }).eq('email', key).eq('type', expectedType);
    return { valid: false, reason: `Invalid OTP. ${MAX_ATTEMPTS - attempts} attempt(s) left.` };
  }

  // Single-use: delete after successful verification
  await supabaseAdmin.from('otp_codes').delete().eq('email', key).eq('type', expectedType);
  return { valid: true };
};

/** Prune expired, unlocked OTPs — called periodically from server.js. */
const cleanup = async () => {
  await supabaseAdmin
    .from('otp_codes')
    .delete()
    .lt('expires_at', new Date(Date.now()).toISOString())
    .or(`locked_until.is.null,locked_until.lt.${new Date(Date.now()).toISOString()}`);
};

module.exports = { set, verify, cleanup, generate, MAX_ATTEMPTS, MAX_SENDS, TTL_MS, LOCKOUT_MS };
