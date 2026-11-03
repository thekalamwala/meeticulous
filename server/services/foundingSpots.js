'use strict';

/**
 * foundingSpots.js — the "first 100 Pro hosts" founding offer.
 *
 * The first FOUNDING_LIMIT paying Pro hosts keep the founding price (₹999/yr
 * ex-GST) for life; after that Pro yearly rises to ₹1,499 (founder decision
 * 2026-11-03, docs/free-vs-pro-audit.md §0). This module only COUNTS — the price
 * itself lives in subscription_plans and changes by an admin edit at cutover.
 *
 * "Paying" = an active Razorpay mandate on a Pro slug. Admin-assigned comps (no
 * razorpay_subscription_id), Supreme and the legacy partner tiers don't count.
 * Fail-soft: a read error returns null so callers hide the counter rather than
 * show a wrong number.
 */

const { supabaseAdmin } = require('../config/supabase');

const FOUNDING_LIMIT = 100;
const FOUNDING_PRICE_ANNUAL = 999;   // ex-GST, display only — the DB row is the authority
const POST_FOUNDING_PRICE_ANNUAL = 1499;
// `premium_founding` is the archived row founding hosts move to at cutover (P1).
const PRO_SLUGS = ['premium', 'premium_founding'];

const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache = { at: 0, value: null };

async function countPayingPro() {
  const { count, error } = await supabaseAdmin
    .from('profiles').select('id', { count: 'exact', head: true })
    .in('plan', PRO_SLUGS).eq('subscription_status', 'active')
    .not('razorpay_subscription_id', 'is', null);
  if (error) throw error;
  return count || 0;
}

/** { limit, taken, left, open } or null on error. Cached 5 min. */
async function getFoundingStatus({ fresh = false } = {}) {
  if (!fresh && _cache.value && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.value;
  try {
    const taken = await countPayingPro();
    const value = { limit: FOUNDING_LIMIT, taken, left: Math.max(0, FOUNDING_LIMIT - taken), open: taken < FOUNDING_LIMIT };
    _cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.error('founding status (non-fatal):', err.message);
    return null;
  }
}

const clearCache = () => { _cache = { at: 0, value: null }; };

module.exports = { FOUNDING_LIMIT, FOUNDING_PRICE_ANNUAL, POST_FOUNDING_PRICE_ANNUAL, PRO_SLUGS, getFoundingStatus, clearCache };
