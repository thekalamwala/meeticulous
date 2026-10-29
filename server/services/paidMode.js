/**
 * paidMode.js — per-host paid-mode override on top of the global fee_only_mode.
 *
 * fee_only_mode is global (interim: no paid listings / no payouts anywhere). To
 * pilot paid bookings with specific hosts without flipping the whole platform,
 * a host may be allow-listed via profiles.paid_enabled = true.
 *
 * The single rule every host-money gate uses:
 *   feeOnlyForHost(hostId) = global fee_only_mode  AND  NOT host.paid_enabled
 *
 * i.e. a paid-enabled host behaves as if fee-only mode were off (paid listings +
 * automatic Route payouts); everyone else stays fee-only. Fail-safe: on any error
 * or a missing column, the host is treated as NOT paid-enabled (stays fee-only).
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');
const platformConfig = require('./platformConfig');

const CACHE_TTL_MS = 60 * 1000;
const _cache = new Map(); // hostId -> { at, val }

async function isHostPaidEnabled(hostId) {
  if (!hostId) return false;
  const hit = _cache.get(hostId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.val;
  let val = false;
  try {
    const { data } = await supabaseAdmin
      .from('profiles').select('paid_enabled').eq('id', hostId).maybeSingle();
    val = data?.paid_enabled === true;
  } catch (_) { /* missing column / error → fail-safe not-paid */ }
  _cache.set(hostId, { at: Date.now(), val });
  return val;
}

/** Effective fee-only mode for a single host (see file header). */
async function feeOnlyForHost(hostId) {
  const { feeOnlyMode } = await platformConfig.getConfig();
  if (!feeOnlyMode) return false;          // global paid mode → nobody is fee-only
  return !(await isHostPaidEnabled(hostId)); // else fee-only unless allow-listed
}

const clearCache = () => _cache.clear();

module.exports = { isHostPaidEnabled, feeOnlyForHost, clearCache };
