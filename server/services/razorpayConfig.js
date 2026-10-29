/**
 * razorpayConfig.js — single source of truth for Razorpay credentials.
 *
 * Credentials are admin-editable and stored in platform_settings (key/value),
 * with the secret + webhook secret encrypted at rest (cryptoTokens). Falls back
 * to env vars (RAZORPAY_KEY_ID / _KEY_SECRET / _WEBHOOK_SECRET) when the DB has
 * no value, so existing deployments keep working with zero config.
 *
 * 60s cache; clearCache() after an admin saves. getClient() memoizes the
 * Razorpay SDK instance and rebuilds it only when the key actually changes.
 */
'use strict';

const Razorpay = require('razorpay');
const { supabaseAdmin } = require('../config/supabase');
const { encrypt, decrypt } = require('../utils/cryptoTokens');
const { securityLog } = require('../utils/logger');

const KEYS = {
  keyId: 'razorpay_key_id',
  keySecret: 'razorpay_key_secret',       // stored encrypted
  webhookSecret: 'razorpay_webhook_secret', // stored encrypted
  enabled: 'razorpay_enabled',
  mode: 'razorpay_mode',                   // 'test' | 'live' (informational)
};

const CACHE_TTL_MS = 60 * 1000;
let _cache = { at: 0, value: null };

// Last successfully-read credentials, kept BEYOND the cache TTL. A failed read
// serves these instead of dropping to env vars — see the catch in getConfig.
// Null until the first successful read (cold start).
let _lastGood = null;
let _client = { keyId: null, keySecret: null, instance: null };

// platform_settings values may be raw or JSON-stringified — unwrap one layer.
const unwrap = (v) => {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (s.startsWith('"') && s.endsWith('"')) { try { return JSON.parse(s); } catch { /* keep */ } }
  return v;
};

async function getConfig() {
  const now = Date.now();
  if (_cache.value && now - _cache.at < CACHE_TTL_MS) return _cache.value;

  // env fallback
  let keyId = process.env.RAZORPAY_KEY_ID || '';
  let keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  let webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  let enabled = !!(keyId && keySecret);
  let mode = 'test';

  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings').select('key, value').in('key', Object.values(KEYS));
    // supabase-js RETURNS errors rather than throwing, so destructuring only
    // `data` made a failed read look like "no rows configured" and fall through
    // to the env credentials below — silently, because the catch never ran.
    if (error) throw error;
    const map = {};
    for (const row of data || []) map[row.key] = unwrap(row.value);

    if (map[KEYS.keyId]) keyId = String(map[KEYS.keyId]);
    if (map[KEYS.keySecret]) keySecret = decrypt(String(map[KEYS.keySecret]));
    if (map[KEYS.webhookSecret]) webhookSecret = decrypt(String(map[KEYS.webhookSecret]));
    if (map[KEYS.mode]) mode = String(map[KEYS.mode]);
    // enabled: explicit DB flag wins; otherwise enabled when a usable key pair exists.
    if (map[KEYS.enabled] != null) {
      enabled = map[KEYS.enabled] === true || map[KEYS.enabled] === 'true';
    } else {
      enabled = !!(keyId && keySecret);
    }
  } catch (err) {
    // Serve the LAST GOOD credentials rather than dropping to env vars. Falling
    // back would point live payments at whatever RAZORPAY_* the host happens to
    // have set — a different account, a test key, or nothing at all (which
    // flips `enabled` false and blocks checkout). Env creds are only the right
    // answer on a cold start, where there is nothing better to serve.
    securityLog('razorpay_config_db_fallback', {
      error: err?.message,
      served: _lastGood ? 'last_known_good' : 'env_cold_start',
    });
    if (_lastGood) {
      // Re-arm the TTL so a sustained outage doesn't hammer the DB every call.
      _cache = { at: now, value: _lastGood };
      return _lastGood;
    }
    return { keyId, keySecret, webhookSecret, enabled, mode };
  }

  _cache = { at: now, value: { keyId, keySecret, webhookSecret, enabled, mode } };
  _lastGood = _cache.value;
  return _cache.value;
}

/** Razorpay SDK instance from current credentials. Throws if unconfigured. */
async function getClient() {
  const { keyId, keySecret } = await getConfig();
  if (!keyId || !keySecret) {
    throw new Error('Razorpay is not configured. Add keys in Admin → Settings → Payment.');
  }
  if (_client.instance && _client.keyId === keyId && _client.keySecret === keySecret) {
    return _client.instance;
  }
  const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  _client = { keyId, keySecret, instance };
  return instance;
}

const getKeyId = async () => (await getConfig()).keyId;
const getKeySecret = async () => (await getConfig()).keySecret;
const getWebhookSecret = async () => (await getConfig()).webhookSecret;
const isConfigured = async () => { const c = await getConfig(); return !!(c.keyId && c.keySecret); };

// Drops the TTL cache so the next call re-reads (used after an admin saves).
// Deliberately KEEPS _lastGood: if the re-read then fails, serving the previous
// working credentials beats dropping to env vars. Worst case that is one stale
// key until the DB recovers; the alternative is charging on the wrong account.
const clearCache = () => {
  _cache = { at: 0, value: null };
  _client = { keyId: null, keySecret: null, instance: null };
};

// Helpers for the admin controller to persist credentials (secret encrypted).
const encryptSecret = (plain) => encrypt(plain);

module.exports = {
  KEYS, getConfig, getClient, getKeyId, getKeySecret, getWebhookSecret,
  isConfigured, clearCache, encryptSecret,
};
