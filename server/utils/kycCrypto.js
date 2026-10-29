/**
 * kycCrypto.js — app-level encryption + validation for sensitive KYC PII.
 *
 * PAN, Aadhaar and bank account numbers are encrypted at rest with AES-256-GCM
 * (authenticated encryption — tampering is detected on decrypt). Ciphertext is
 * stored as "iv:tag:data" (all base64). Values are NEVER logged and NEVER
 * returned raw from any API — GET endpoints return masked forms only.
 *
 * KEY: set KYC_ENCRYPTION_KEY in server/.env (any string; 32+ chars recommended).
 * If unset we derive a stable key via scrypt from SUPER_ADMIN_JWT_SECRET so dev
 * works out of the box — but PROD SHOULD SET A DEDICATED KYC_ENCRYPTION_KEY so
 * rotating other secrets never orphans encrypted rows.
 */
const crypto = require('crypto');

const KEY_SOURCE = process.env.KYC_ENCRYPTION_KEY
  || process.env.SUPER_ADMIN_JWT_SECRET
  || 'insecure-dev-only-kyc-key-change-me';

// The fallbacks keep dev working, but on a real deployment they are a trap: rows
// encrypted under one key decrypt to null under another, and every mask/decrypt
// path fails SOFT (returns null). Without this warning that surfaces as "the
// host's KYC data is blank" rather than "this box has the wrong key". Warn once
// at require time — loud enough to find in the boot log, never fatal.
if (!process.env.KYC_ENCRYPTION_KEY && process.env.NODE_ENV !== 'test') {
  console.warn(
    process.env.SUPER_ADMIN_JWT_SECRET
      ? '[kycCrypto] KYC_ENCRYPTION_KEY is not set — falling back to SUPER_ADMIN_JWT_SECRET. '
        + 'Rotating that secret will orphan every encrypted KYC row (PAN/Aadhaar/bank read back blank). '
        + 'Set a dedicated KYC_ENCRYPTION_KEY.'
      : '[kycCrypto] KYC_ENCRYPTION_KEY is not set and there is no SUPER_ADMIN_JWT_SECRET to fall back on — '
        + 'using the insecure built-in dev key. KYC PII written now is NOT meaningfully encrypted.',
  );
}

// 32 bytes for AES-256, deterministically derived so the same secret always
// yields the same key (required to decrypt previously-stored rows).
const KEY = crypto.scryptSync(KEY_SOURCE, 'kyc-pii-v1', 32);

function encrypt(plain) {
  if (plain == null || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decrypt(blob) {
  if (!blob) return null;
  try {
    const [iv, tag, data] = blob.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch (_) {
    return null; // corrupt/tampered/blank
  }
}

// ── Masking (for display) ────────────────────────────────────────────────────
// Decrypt then reveal only the last few chars. Callers pass the stored blob.
const last = (s, n) => (s ? s.slice(-n) : '');
function maskPan(blob)     { const v = decrypt(blob); return v ? `XXXXXX${last(v, 4)}` : null; }        // ABCDE1234F → XXXXXX234F
function maskAadhaar(blob) { const v = decrypt(blob); return v ? `XXXXXXXX${last(v, 4)}` : null; }      // last 4
function maskAccount(blob) { const v = decrypt(blob); return v ? `XXXXXX${last(v, 4)}` : null; }        // last 4
function maskPhone(phone)  { return phone ? `XXXXXX${last(String(phone), 4)}` : null; }

// ── Validation ───────────────────────────────────────────────────────────────
const RE = {
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  aadhaar: /^[0-9]{12}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[0-9]{10,15}$/,
};

module.exports = { encrypt, decrypt, maskPan, maskAadhaar, maskAccount, maskPhone, RE };
