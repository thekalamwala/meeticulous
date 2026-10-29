/**
 * cryptoTokens.js — symmetric encryption for secrets at rest (Google OAuth
 * tokens). AES-256-GCM (authenticated). Stored format:
 *
 *   enc:v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 * Back-compat: decrypt() returns any value WITHOUT the `enc:v1:` prefix
 * verbatim — so plaintext tokens written before this change keep working,
 * and re-encryption (scripts/encryptGoogleTokens.js) is hygiene, not a
 * correctness requirement.
 *
 * Key resolution (first that exists):
 *   1. GOOGLE_TOKEN_KEY — 32-byte key as base64 or hex (recommended).
 *   2. Derived from SUPABASE_SERVICE_ROLE_KEY via scrypt (zero-config
 *      fallback so the feature works on existing deployments). A fixed,
 *      non-secret salt is fine here — the service-role key is the secret.
 */

const crypto = require('crypto');

const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';

let cachedKey = null;
const resolveKey = () => {
  if (cachedKey) return cachedKey;
  const raw = process.env.GOOGLE_TOKEN_KEY;
  if (raw) {
    // Accept base64 or hex; must decode to 32 bytes.
    let buf = null;
    try { buf = Buffer.from(raw, 'base64'); } catch (_) { /* try hex */ }
    if (!buf || buf.length !== 32) {
      try { buf = Buffer.from(raw, 'hex'); } catch (_) { buf = null; }
    }
    if (buf && buf.length === 32) { cachedKey = buf; return cachedKey; }
    console.warn('GOOGLE_TOKEN_KEY set but not a 32-byte base64/hex value — falling back to derived key.');
  }
  // SECURITY (audit L2): in production never silently derive the at-rest key
  // from the service-role key. validateEnv already requires GOOGLE_TOKEN_KEY in
  // prod; this is a hard backstop so a misconfig fails loud instead of quietly
  // encrypting Google tokens / admin 2FA / Razorpay secrets under a weaker
  // derived key. (Dev/test keep the zero-config derive for convenience.)
  if (process.env.NODE_ENV === 'production' && !raw) {
    throw new Error('cryptoTokens: GOOGLE_TOKEN_KEY (32-byte base64/hex) is required in production.');
  }
  const seed = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!seed) throw new Error('cryptoTokens: no GOOGLE_TOKEN_KEY and no SUPABASE_SERVICE_ROLE_KEY to derive from.');
  cachedKey = crypto.scryptSync(seed, 'bas-google-token-v1', 32);
  return cachedKey;
};

const isEncrypted = (value) => typeof value === 'string' && value.startsWith(PREFIX);

const encrypt = (plain) => {
  if (plain == null || plain === '') return plain;          // keep empty/null as-is
  if (isEncrypted(plain)) return plain;                     // already encrypted — idempotent
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, resolveKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
};

const decrypt = (stored) => {
  if (stored == null || stored === '') return stored;
  if (!isEncrypted(stored)) return stored;                  // legacy plaintext — return verbatim
  try {
    const [, , ivB64, tagB64, ctB64] = stored.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, resolveKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('cryptoTokens.decrypt failed (returning empty):', err.message);
    return '';
  }
};

module.exports = { encrypt, decrypt, isEncrypted };
