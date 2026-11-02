/**
 * platformConfig.js — reads admin-editable money settings from platform_settings.
 *
 * platform_settings is a key/value table; values may be stored as raw numbers,
 * numeric strings, or JSON-stringified numbers depending on who wrote them, so
 * we coerce defensively. 60s cache; clearCache() after admin edits.
 *
 * Keys:
 *   platform_fee              default ₹10 (flat fee charged to the customer)
 *   platform_fee_gst_rate     default 0.18 (18% GST on the platform fee)
 *   settlement_clearing_days  default 7 (days after completion before a vendor payout matures)
 *   fee_only_mode             default TRUE — INTERIM (no Razorpay Route yet). Hosts cannot
 *                             list a paid service (prices forced to ₹0) and every booking
 *                             collects only Meeticulous's own booking fee + GST, with a
 *                             guest invoice; NO host money moves, so no payment-aggregator
 *                             exposure. Flip to false on Route go-live to enable host pricing
 *                             + payouts. Defaults true so a DB blip fails SAFE (never
 *                             accidentally enables collecting host money without Route).
 */

const { supabaseAdmin } = require('../config/supabase');
const { securityLog } = require('../utils/logger');

const DEFAULTS = { platformFee: 10, gstRate: 0.18, clearingDays: 7, feeOnlyMode: true, payoutReconcilerMode: 'observe', routeAutopilot: false };

// Reconciler mode tri-state (see payoutReconciler.js). Unwraps JSON-stringified
// values like toBool/toNumber; anything not a known mode resolves to the fallback.
const RECONCILER_MODES = ['off', 'observe', 'live'];
const toMode = (raw, fallback) => {
  if (raw == null) return fallback;
  let v = raw;
  for (let i = 0; i < 8 && typeof v === 'string'; i++) {
    const s = v.trim();
    let parsed;
    try { parsed = JSON.parse(s); } catch { break; }
    if (parsed === v) break;
    v = parsed;
  }
  const s = String(v).trim().toLowerCase();
  return RECONCILER_MODES.includes(s) ? s : fallback;
};

// Coerce a platform_settings value into a boolean. Stored as raw bool, 'true'/'false',
// 1/0, or JSON-stringified. Anything not clearly false resolves to the fallback.
const toBool = (raw, fallback) => {
  if (raw == null) return fallback;
  let v = raw;
  for (let i = 0; i < 8 && typeof v === 'string'; i++) {
    const s = v.trim();
    let parsed;
    try { parsed = JSON.parse(s); } catch { break; }
    if (parsed === v) break;
    v = parsed;
  }
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  return fallback;
};
const CACHE_TTL_MS = 60 * 1000;
let _cache = { at: 0, value: null };

// Last successfully-read config, kept BEYOND the cache TTL. A failed read serves
// this instead of reverting to DEFAULTS — see getConfig. Null until the first
// successful read (cold start), which is the only time DEFAULTS are served.
let _lastGood = null;

// Coerce a platform_settings value into a finite number. Values may be raw
// numbers, numeric strings, or JSON-stringified MULTIPLE times (a buggy admin
// save re-encoded them, e.g. "\"\\\"0.18\\\"\""). Unwrap every JSON layer
// before parsing so corrupted rows resolve instead of silently falling back.
const toNumber = (raw, fallback) => {
  if (raw == null) return fallback;
  let v = raw;
  for (let i = 0; i < 8 && typeof v === 'string'; i++) {
    const s = v.trim();
    let parsed;
    try { parsed = JSON.parse(s); } catch { break; }
    if (parsed === v) break; // converged (e.g. JSON.parse('0.18') === '0.18' never, but guard anyway)
    v = parsed;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};

const getConfig = async () => {
  const now = Date.now();
  if (_cache.value && now - _cache.at < CACHE_TTL_MS) return _cache.value;

  let platformFee = DEFAULTS.platformFee;
  let gstRate = DEFAULTS.gstRate;
  let clearingDays = DEFAULTS.clearingDays;
  let feeOnlyMode = DEFAULTS.feeOnlyMode;
  let payoutReconcilerMode = DEFAULTS.payoutReconcilerMode;
  let routeAutopilot = DEFAULTS.routeAutopilot;
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('key, value')
      .in('key', ['platform_fee', 'platform_fee_gst_rate', 'settlement_clearing_days', 'fee_only_mode', 'payout_reconciler_mode', 'route_autopilot']);
    // supabase-js RETURNS errors, it does not throw. Destructuring only `data`
    // meant a failed read looked identical to an empty table: the loop below ran
    // zero times, every setting silently reverted to DEFAULTS, and the catch
    // that was written to surface exactly this never fired. Raise it so the
    // last-known-good path below actually runs.
    if (error) throw error;
    for (const row of data || []) {
      if (row.key === 'platform_fee') platformFee = toNumber(row.value, DEFAULTS.platformFee);
      if (row.key === 'platform_fee_gst_rate') gstRate = toNumber(row.value, DEFAULTS.gstRate);
      if (row.key === 'settlement_clearing_days') clearingDays = toNumber(row.value, DEFAULTS.clearingDays);
      if (row.key === 'fee_only_mode') feeOnlyMode = toBool(row.value, DEFAULTS.feeOnlyMode);
      if (row.key === 'payout_reconciler_mode') payoutReconcilerMode = toMode(row.value, DEFAULTS.payoutReconcilerMode);
      if (row.key === 'route_autopilot') routeAutopilot = toBool(row.value, DEFAULTS.routeAutopilot);
    }
  } catch (err) {
    // Serve the LAST GOOD config rather than reverting to DEFAULTS. A blip must
    // never change a live money setting: reverting would force fee_only_mode
    // back ON (hosts stop being able to sell), and would quietly reset
    // platform_fee / gstRate to ₹10 / 18% for any admin who had tuned them.
    // DEFAULTS are only correct on a cold start, where there is nothing better.
    securityLog('platform_config_db_fallback', {
      error: err?.message,
      served: _lastGood ? 'last_known_good' : 'defaults_cold_start',
    });
    if (_lastGood) {
      // Re-arm the TTL so a sustained outage doesn't hammer the DB every call.
      _cache = { at: now, value: _lastGood };
      return _lastGood;
    }
    return { ...DEFAULTS };
  }

  // Guard against nonsensical config
  if (platformFee < 0) platformFee = DEFAULTS.platformFee;
  if (gstRate < 0 || gstRate > 1) gstRate = DEFAULTS.gstRate;
  if (!Number.isFinite(clearingDays) || clearingDays < 0) clearingDays = DEFAULTS.clearingDays;
  clearingDays = Math.floor(clearingDays);

  _cache = { at: now, value: { platformFee, gstRate, clearingDays, feeOnlyMode, payoutReconcilerMode, routeAutopilot } };
  _lastGood = _cache.value;
  return _cache.value;
};

// Drops the TTL cache so the next call re-reads (used after an admin edit).
// Deliberately KEEPS _lastGood: clearing it would re-expose the cold-start path,
// so an admin save immediately followed by a DB blip would revert to DEFAULTS —
// the exact failure this module now prevents.
const clearCache = () => { _cache = { at: 0, value: null }; };

module.exports = { getConfig, clearCache, DEFAULTS };
