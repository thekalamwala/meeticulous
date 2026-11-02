/**
 * razorpaySubscriptions.js — thin wrapper around the Razorpay Subscriptions API.
 *
 * Owns: lazy creation of Razorpay Plan objects (one per tier × cadence) and the
 * subscription lifecycle (create / cancel / fetch). All money math comes from
 * lib/subscriptionPricing.js; this file only talks to Razorpay + persists ids.
 */
'use strict';

const planService = require('./planService');
const platformConfig = require('./platformConfig');
const razorpayConfig = require('./razorpayConfig');
const { supabaseAdmin } = require('../config/supabase');
const { cadenceAmountPaise, razorpayInterval, normCadence, subscriptionTotalCount } = require('../lib/subscriptionPricing');

const PLAN_ID_COLUMN = { monthly: 'razorpay_plan_id_monthly', annual: 'razorpay_plan_id_annual' };

// In-process memo of plan ids confirmed to exist under the ACTIVE key, so each id
// is fetch-verified at most once per server lifetime (and re-verified after a key
// change, since the memo is keyed by keyId).
let _verifiedPlans = { keyId: null, ids: new Set() };

// Razorpay's "this id belongs to a different account / doesn't exist" signal.
// Matched conservatively so transient/auth/network errors never wipe a valid id.
const isNotFoundError = (e) => {
  const desc = (e?.error?.description || e?.message || '').toLowerCase();
  return /does not exist|not found|no such|the id provided/.test(desc);
};

/**
 * Confirm a cached Razorpay plan id still exists under the ACTIVE key. A plan id
 * is account- and mode-scoped: after a key/mode switch, ids minted under the old
 * account 404 at checkout (the bug this guards against).
 * @returns {Promise<boolean|null>} true=present, false=definitively gone (wrong
 *   account/mode), null=inconclusive (transient — caller should trust the cache).
 */
async function planStillExists(planId) {
  const keyId = await razorpayConfig.getKeyId();
  if (_verifiedPlans.keyId !== keyId) _verifiedPlans = { keyId, ids: new Set() };
  if (_verifiedPlans.ids.has(planId)) return true;
  try {
    const razorpay = await razorpayConfig.getClient();
    await razorpay.plans.fetch(planId);
    _verifiedPlans.ids.add(planId);
    return true;
  } catch (e) {
    if (isNotFoundError(e)) return false;
    console.warn(`razorpay plan verify inconclusive for ${planId}: ${e?.error?.description || e?.message}`);
    return null;
  }
}

/**
 * Null every cached Razorpay plan id (both cadences) across subscription_plans so
 * plans are re-minted under the current account on next use. Called proactively
 * when an admin changes the Razorpay key/mode, and implicitly by the self-heal in
 * ensureRazorpayPlan. Also resets the in-process verify memo + plan cache.
 */
async function clearCachedPlanIds() {
  const { error } = await supabaseAdmin
    .from('subscription_plans')
    .update({ razorpay_plan_id_monthly: null, razorpay_plan_id_annual: null })
    .not('id', 'is', null);
  if (error) { console.error('clearCachedPlanIds failed:', error.message); return { cleared: false }; }
  _verifiedPlans = { keyId: null, ids: new Set() };
  planService.clearCache();
  return { cleared: true };
}

/**
 * Ensure a Razorpay Plan exists for (planRow, cadence). Creates + persists the
 * plan id the first time; returns the cached id afterwards — but first verifies a
 * cached id still exists under the active key, self-healing a stale id left behind
 * by a key/mode switch.
 * @returns {Promise<string>} razorpay plan id
 */
async function ensureRazorpayPlan(planRow, cadence) {
  const c = normCadence(cadence);
  const col = PLAN_ID_COLUMN[c];
  if (!col) throw new Error(`unknown cadence: ${cadence}`);
  if (planRow[col]) {
    // Trust the cached id unless Razorpay confirms it's gone (wrong account/mode).
    // null (inconclusive) → trust cache so a transient blip can't block upgrades.
    if ((await planStillExists(planRow[col])) !== false) return planRow[col];
    console.warn(`razorpay plan ${planRow[col]} (${planRow.slug}/${c}) gone under active key — re-minting`);
    await supabaseAdmin.from('subscription_plans').update({ [col]: null }).eq('id', planRow.id);
    planService.clearCache();
  }

  const { gstRate } = await platformConfig.getConfig();
  const amount = cadenceAmountPaise(planRow, c, gstRate);
  if (!(amount > 0)) throw new Error(`plan "${planRow.slug}" has no ${c} price set`);

  const { period, interval } = razorpayInterval(c);
  const razorpay = await razorpayConfig.getClient();
  const rzpPlan = await razorpay.plans.create({
    period,
    interval,
    item: {
      name: `${planRow.name} (${c})`,
      amount,
      currency: 'INR',
      description: `Meeticulous ${planRow.name} — ${c} billing (incl. GST)`,
    },
    notes: { plan_slug: planRow.slug, cadence: c },
  });

  await supabaseAdmin
    .from('subscription_plans')
    .update({ [col]: rzpPlan.id })
    .eq('id', planRow.id);
  planService.clearCache();
  return rzpPlan.id;
}

/**
 * Create a Razorpay subscription against an existing plan id.
 * @param {object} p
 * @param {string} p.planId      razorpay plan id
 * @param {string} p.cadence     'monthly' | 'annual'
 * @param {object} [p.notes]     vendor_id, plan slug, etc. (echoed in webhooks)
 * @param {number} [p.startAt]   unix seconds — defer first charge (proration switch)
 */
async function createSubscription({ planId, cadence, notes = {}, startAt }) {
  const c = normCadence(cadence);
  const razorpay = await razorpayConfig.getClient();
  // total_count is capped so the UPI AutoPay mandate spans at most ~10 years —
  // the validity limit banks enforce at checkout. A longer mandate (e.g. annual
  // × 100) is rejected on the payments/create/ajax step before any payment is
  // created. monthly → 120, annual → 10.
  return razorpay.subscriptions.create({
    plan_id: planId,
    total_count: subscriptionTotalCount(c),
    customer_notify: 1,
    ...(startAt ? { start_at: startAt } : {}),
    notes,
  });
}

/** Cancel a subscription (at cycle end by default; immediate when atCycleEnd=false). */
async function cancelSubscription(subscriptionId, atCycleEnd = true) {
  const razorpay = await razorpayConfig.getClient();
  return razorpay.subscriptions.cancel(subscriptionId, atCycleEnd);
}

async function fetchSubscription(subscriptionId) {
  const razorpay = await razorpayConfig.getClient();
  return razorpay.subscriptions.fetch(subscriptionId);
}

/** All invoices for a subscription (each paid invoice carries its payment_id). */
async function fetchSubscriptionInvoices(subscriptionId) {
  const razorpay = await razorpayConfig.getClient();
  const res = await razorpay.invoices.all({ subscription_id: subscriptionId, count: 100 });
  return res?.items || [];
}

/** Full payment entity (fee/tax in paise) — used to record the exact charge. */
async function fetchPayment(paymentId) {
  const razorpay = await razorpayConfig.getClient();
  return razorpay.payments.fetch(paymentId);
}

module.exports = {
  getClient: razorpayConfig.getClient,
  PLAN_ID_COLUMN,
  ensureRazorpayPlan,
  clearCachedPlanIds,
  planStillExists,
  createSubscription,
  cancelSubscription,
  fetchSubscription,
  fetchSubscriptionInvoices,
  fetchPayment,
};
