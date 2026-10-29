/**
 * subscriptionReconciler.js — safety net + cleanup for pending subscriptions.
 *
 * Scans vendors stuck in 'pending' (mandate authorized but activation webhook
 * never arrived) and reconciles their state against the live Razorpay
 * subscription. Idempotent via subscriptionService — mirrors the ledger
 * reconciler pattern. Wired to a setInterval in server.js.
 *
 * Also RELEASES orphaned pending mandates so they don't poll forever:
 *   • the subscription never authorized within the grace window (abandoned
 *     checkout) → cancel the dangling mandate + free the vendor to retry;
 *   • Razorpay can't find the subscription at all (minted against a plan id
 *     from a since-rotated key/mode) → release without a cancel call.
 * "Pending age" is read from profiles.updated_at — a stuck pending row isn't
 * touched after creation, so updated_at is a reliable proxy and needs no new
 * column (schema-fallback discipline).
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');
const razorpaySubscriptions = require('./razorpaySubscriptions');
const subscriptionService = require('./subscriptionService');

// How long a mandate may sit un-authorized before it's treated as abandoned.
// UPI AutoPay authorization completes within minutes, so an hour is generous.
const PENDING_TTL_MIN = Number(process.env.SUBSCRIPTION_PENDING_TTL_MIN || 60);
const PRE_AUTH_STATES = ['created', 'authenticated', 'pending'];

// platform_settings row holding the last-run summary, surfaced read-only in
// Admin → Settings → Payment so an operator can see orphan cleanup activity.
const STATUS_KEY = 'subscription_reconciler_status';

// Razorpay's "this id doesn't exist under this account" signal. Matched
// conservatively so transient/auth/network errors never release a live mandate.
const isNotFound = (e) => {
  const desc = (e?.error?.description || e?.message || '').toLowerCase();
  return /does not exist|not found|no such|the id provided/.test(desc);
};

/**
 * Move an orphaned pending profile out of 'pending' so the vendor can retry,
 * optionally cancelling the dangling Razorpay mandate first. Any access already
 * granted (e.g. switch credit) is retained via plan_expires_at — this mirrors
 * subscriptionService.markCancelled.
 */
async function releaseOrphan(profileId, subId, { cancel }) {
  if (cancel && subId) {
    try {
      await razorpaySubscriptions.cancelSubscription(subId, false);
    } catch (e) {
      const msg = e?.error?.description || e?.message || '';
      if (!isNotFound(e) && !/already cancelled|already canceled|completed/i.test(msg)) {
        console.error('releaseOrphan: cancel failed', subId, msg);
      }
    }
  }
  await supabaseAdmin.from('profiles').update({
    subscription_status: 'cancelled',
    razorpay_subscription_id: null,
    updated_at: new Date().toISOString(),
  }).eq('id', profileId);
}

async function reconcile() {
  const { data: pending } = await supabaseAdmin
    .from('profiles')
    .select('id, razorpay_subscription_id, updated_at')
    .eq('subscription_status', 'pending')
    .not('razorpay_subscription_id', 'is', null)
    .limit(100);

  const ttlMs = PENDING_TTL_MIN * 60 * 1000;
  const now = Date.now();
  let healed = 0, released = 0;

  for (const p of pending || []) {
    const ageMs = now - new Date(p.updated_at || now).getTime();
    try {
      const rzpSub = await razorpaySubscriptions.fetchSubscription(p.razorpay_subscription_id);
      if (subscriptionService.ACTIVE_STATES.includes(rzpSub.status)) {
        const r = await subscriptionService.activateFromSubscription({ rzpSub });
        if (r.activated) healed++;
      } else if (rzpSub.status === 'halted') {
        await subscriptionService.markHalted(rzpSub);
      } else if (['cancelled', 'expired', 'completed'].includes(rzpSub.status)) {
        await subscriptionService.markCancelled(rzpSub);
      } else if (PRE_AUTH_STATES.includes(rzpSub.status) && ageMs > ttlMs) {
        // Mandate never authorized within the grace window → abandoned. Cancel
        // the dangling mandate and free the vendor to retry.
        await releaseOrphan(p.id, p.razorpay_subscription_id, { cancel: true });
        released++;
      }
      // else: still inside the grace window → leave pending for a later pass.
    } catch (e) {
      // A subscription Razorpay can't find (minted under a since-rotated key /
      // different mode) will never reconcile — release it instead of erroring
      // every pass forever. Other errors are transient: log and retry next pass.
      if (isNotFound(e)) {
        await releaseOrphan(p.id, p.razorpay_subscription_id, { cancel: false });
        released++;
      } else {
        console.error('subscription reconcile error', p.id, e.message);
      }
    }
  }

  // Second pass: heal ACTIVE subscriptions whose charge was never booked —
  // access was granted (subscription.activated) but the payment-carrying
  // subscription.charged webhook was missed, so no subscription_payments row
  // exists. Backfill straight from the Razorpay invoices. This is the gap that
  // silently zeroed Collected revenue for admin/webhook-activated subscriptions.
  const recorded = await reconcileMissingPayments();

  // Third pass: mint GST invoices for paid charges that never got one (the
  // invoice step is best-effort at charge time, so a transient failure would
  // otherwise leave the host permanently without a tax invoice).
  let invoiced = 0;
  try {
    invoiced = (await subscriptionService.backfillMissingInvoices()).minted;
  } catch (e) {
    console.error('backfillMissingInvoices error', e.message);
  }

  await recordStatus({ healed, released, recorded, invoiced, scanned: (pending || []).length });
  return { healed, released, recorded, invoiced };
}

/**
 * Backfill payments for ACTIVE subscriptions that have zero recorded charges.
 * Only touches subs with NO subscription_payments row (renewals are booked by
 * the webhook), so it's cheap: at most one Razorpay call per un-booked sub, and
 * nothing once every active sub has at least its initial charge recorded.
 */
async function reconcileMissingPayments() {
  const { data: active } = await supabaseAdmin
    .from('profiles')
    .select('id, razorpay_subscription_id')
    .eq('subscription_status', 'active')
    .not('razorpay_subscription_id', 'is', null)
    .limit(200);

  let recorded = 0;
  for (const p of active || []) {
    const { count } = await supabaseAdmin
      .from('subscription_payments').select('id', { count: 'exact', head: true })
      .eq('razorpay_subscription_id', p.razorpay_subscription_id);
    if ((count || 0) > 0) continue; // already has at least one charge booked
    try {
      const rzpSub = await razorpaySubscriptions.fetchSubscription(p.razorpay_subscription_id);
      const r = await subscriptionService.backfillSubscriptionPayments(rzpSub);
      recorded += r.recorded || 0;
    } catch (e) {
      if (!isNotFound(e)) console.error('reconcileMissingPayments error', p.id, e.message);
    }
  }
  return recorded;
}

/**
 * Persist a running summary (last run + cumulative totals) to platform_settings.
 * Best-effort: a write failure never fails the reconcile pass.
 */
async function recordStatus({ healed, released, recorded = 0, invoiced = 0, scanned }) {
  try {
    const { data } = await supabaseAdmin
      .from('platform_settings').select('value').eq('key', STATUS_KEY).maybeSingle();
    let prev = {};
    if (data?.value) { try { prev = JSON.parse(data.value); } catch { prev = {}; } }
    const now = new Date().toISOString();
    const next = {
      last_run_at: now,
      last_scanned: scanned,
      last_healed: healed,
      last_released: released,
      last_recorded: recorded,
      last_invoiced: invoiced,
      healed_total: (Number(prev.healed_total) || 0) + healed,
      released_total: (Number(prev.released_total) || 0) + released,
      recorded_total: (Number(prev.recorded_total) || 0) + recorded,
      invoiced_total: (Number(prev.invoiced_total) || 0) + invoiced,
    };
    await supabaseAdmin.from('platform_settings')
      .upsert({ key: STATUS_KEY, value: JSON.stringify(next), updated_at: now }, { onConflict: 'key' });
  } catch (e) {
    console.error('subscription reconciler status write failed:', e.message);
  }
}

/** Read the last-run summary for the admin payment settings panel (null if none). */
async function getStatus() {
  try {
    const { data } = await supabaseAdmin
      .from('platform_settings').select('value').eq('key', STATUS_KEY).maybeSingle();
    if (!data?.value) return null;
    return JSON.parse(data.value);
  } catch {
    return null;
  }
}

module.exports = { reconcile, getStatus };
