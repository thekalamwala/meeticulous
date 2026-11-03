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
const planService = require('./planService');

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

const FOUNDING_SLUG = 'premium_founding';

/**
 * Should this host's Pro checkout use the founding row? True when they already
 * hold it (live, not lapsed — cancelling and lapsing forfeits the price), or when
 * spots are still open. Only when the row exists (v3.184) — otherwise Pro checkout
 * stays on `premium`, which carries the founding price until the cutover anyway.
 */
async function routesToFounding(hostId) {
  try {
    const plans = await planService.loadPlans();
    if (!plans.has(FOUNDING_SLUG)) return false;
    const { data: prof } = await supabaseAdmin
      .from('profiles').select('plan, plan_expires_at').eq('id', hostId).maybeSingle();
    if (planService.resolveVendorPlan(prof || {}) === FOUNDING_SLUG) return true;
    const status = await getFoundingStatus({ fresh: true });
    return !!status?.open;
  } catch (err) {
    console.error('founding routing (non-fatal):', err.message);
    return false;
  }
}

const MILESTONES = [90, FOUNDING_LIMIT];
const MILESTONE_KEY = 'founding_milestone_alerted';

/**
 * Daily: alert the founder once each when paying Pro crosses 90 and 100 (time to
 * run docs/founding-cutover-runbook.md). The highest milestone alerted is kept in
 * platform_settings so a redeploy never re-sends.
 */
async function checkFoundingMilestones() {
  const status = await getFoundingStatus({ fresh: true });
  if (!status) return { alerted: null };
  const { data: row } = await supabaseAdmin
    .from('platform_settings').select('value').eq('key', MILESTONE_KEY).maybeSingle();
  const done = Number(row?.value) || 0;
  const hit = MILESTONES.filter((m) => status.taken >= m && m > done).pop();
  if (!hit) return { alerted: null };
  await supabaseAdmin.from('platform_settings').upsert({ key: MILESTONE_KEY, value: String(hit) }, { onConflict: 'key' });
  require('../utils/adminAlert').adminAlert({
    key: `founding_${hit}`,
    subject: hit >= FOUNDING_LIMIT ? 'Founding 100 is full — run the Pro price cutover' : `${hit} founding Pro spots taken`,
    lines: [
      `Paying Pro hosts: ${status.taken} of ${FOUNDING_LIMIT}.`,
      hit >= FOUNDING_LIMIT
        ? 'New Pro checkouts now land on `premium`. Raise its yearly price to ₹1,499 — see docs/founding-cutover-runbook.md.'
        : 'Ten spots to go. Prepare the cutover — docs/founding-cutover-runbook.md.',
    ],
  });
  return { alerted: hit };
}

const clearCache = () => { _cache = { at: 0, value: null }; };

module.exports = { FOUNDING_LIMIT, FOUNDING_PRICE_ANNUAL, POST_FOUNDING_PRICE_ANNUAL, PRO_SLUGS, FOUNDING_SLUG, getFoundingStatus, routesToFounding, checkFoundingMilestones, clearCache };
