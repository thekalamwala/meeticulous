'use strict';
// Paid membership billing (M6). Reuses the existing Razorpay Subscriptions rail
// (razorpaySubscriptions.js) — the only membership-specific pieces are:
//   1. a tier-scoped plan-ensure (ensureRazorpayPlan is hardcoded to subscription_plans),
//   2. activation that writes the community_membership_subscriptions row.
// Idempotency is keyed on razorpay_subscription_id (find-then-write) — no payments table.
//
// GAP (documented, brief §5): host payout + commission for membership revenue is NOT
// wired here. Funds settle to the platform; creator settlement reuses the booking Route
// path in a follow-up. Member-side billing (charge, entitlement, cancel, dunning) is complete.
const { supabaseAdmin } = require('../config/supabase');
const razorpayConfig = require('./razorpayConfig');
const { planStillExists, createSubscription, cancelSubscription } = require('./razorpaySubscriptions');
const membershipNotify = require('./community/membershipNotify');

const unixToIso = (s) => (s ? new Date(s * 1000).toISOString() : null);

// Ensure a monthly Razorpay Plan for a paid tier; cache the id on the tier row.
async function ensureTierPlan(tier) {
  if (tier.razorpay_plan_id_monthly) {
    if ((await planStillExists(tier.razorpay_plan_id_monthly)) !== false) return tier.razorpay_plan_id_monthly;
    await supabaseAdmin.from('community_membership_tiers').update({ razorpay_plan_id_monthly: null }).eq('id', tier.id);
  }
  const amount = Math.round(Number(tier.price_inr) * 100); // paise; host price is the member charge
  if (!(amount > 0)) throw new Error('tier has no price');
  const razorpay = await razorpayConfig.getClient();
  const plan = await razorpay.plans.create({
    period: 'monthly', interval: 1,
    item: { name: `Membership — ${tier.name}`, amount, currency: 'INR' },
    notes: { kind: 'membership', tier_id: tier.id },
  });
  await supabaseAdmin.from('community_membership_tiers').update({ razorpay_plan_id_monthly: plan.id }).eq('id', tier.id);
  return plan.id;
}

// Create the Razorpay subscription for a member joining a paid tier. notes carry
// everything the webhook needs to grant entitlement (no pre-inserted DB row).
async function startPaidSubscription({ tier, memberId, hostId }) {
  const planId = await ensureTierPlan(tier);
  const sub = await createSubscription({
    planId, cadence: 'monthly',
    notes: { kind: 'membership', tier_id: tier.id, host_id: hostId, member_id: memberId },
  });
  return sub;
}

// Webhook: subscription.charged / .activated → grant/extend membership. Idempotent on
// razorpay_subscription_id. notes (signature-verified) carry member/host/tier.
async function activateFromSubscription({ rzpSub }) {
  const notes = rzpSub?.notes || {};
  if (notes.kind !== 'membership' || !notes.member_id || !notes.host_id || !notes.tier_id) {
    return { activated: false, reason: 'missing membership notes' };
  }
  const periodEnd = unixToIso(rzpSub.current_end)
    || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: existing, error: selErr } = await supabaseAdmin
    .from('community_membership_subscriptions').select('id')
    .eq('razorpay_subscription_id', rzpSub.id).maybeSingle();
  if (selErr) throw selErr; // let Razorpay retry rather than half-process

  if (existing) {
    const { error } = await supabaseAdmin.from('community_membership_subscriptions')
      .update({ status: 'active', tier_id: notes.tier_id, current_period_end: periodEnd, updated_at: nowIso })
      .eq('id', existing.id);
    if (error) throw error;
    membershipNotify.renewed({ memberId: notes.member_id }); // existing row re-charged = renewal
  } else {
    const { error } = await supabaseAdmin.from('community_membership_subscriptions').insert({
      member_id: notes.member_id, host_id: notes.host_id, tier_id: notes.tier_id,
      status: 'active', razorpay_subscription_id: rzpSub.id, current_period_end: periodEnd,
    });
    // A free-tier row for the same (member,host) blocks the partial unique index. Upgrade it:
    // flip the existing current row onto this paid subscription.
    if (error) {
      if (error.code === '23505') {
        const { error: upErr } = await supabaseAdmin.from('community_membership_subscriptions')
          .update({ tier_id: notes.tier_id, status: 'active', razorpay_subscription_id: rzpSub.id, current_period_end: periodEnd, updated_at: nowIso })
          .eq('member_id', notes.member_id).eq('host_id', notes.host_id).in('status', ['active', 'past_due']);
        if (upErr) throw upErr;
      } else throw error;
    }
    membershipNotify.newMember({ hostId: notes.host_id }); // first paid activation = new member
  }
  return { activated: true };
}

// subscription.halted → grace (past_due still counts as entitled in the gate).
// A reconciler downgrades past_due -> expired after the grace window (follow-up).
async function markHalted(rzpSub) {
  await supabaseAdmin.from('community_membership_subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('razorpay_subscription_id', rzpSub.id);
  membershipNotify.paymentFailed({ memberId: rzpSub?.notes?.member_id });
}

// subscription.cancelled (fires at cycle end for an at-cycle-end cancel) → expire access.
async function markCancelled(rzpSub) {
  await supabaseAdmin.from('community_membership_subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('razorpay_subscription_id', rzpSub.id);
}

// Member cancels: Razorpay cancels at cycle end; access continues until the
// 'cancelled' webhook fires at period end. Resume = rejoin (cancel+resubscribe model).
async function cancelForMember({ memberId, hostId }) {
  const { data: sub } = await supabaseAdmin
    .from('community_membership_subscriptions')
    .select('id, razorpay_subscription_id')
    .eq('member_id', memberId).eq('host_id', hostId).in('status', ['active', 'past_due']).maybeSingle();
  if (!sub) return { canceled: false, reason: 'no active membership' };
  if (sub.razorpay_subscription_id) await cancelSubscription(sub.razorpay_subscription_id, true);
  else { // free membership: no Razorpay object, drop it directly
    await supabaseAdmin.from('community_membership_subscriptions')
      .update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', sub.id);
  }
  return { canceled: true };
}

module.exports = {
  ensureTierPlan, startPaidSubscription, activateFromSubscription, markHalted, markCancelled, cancelForMember,
};
