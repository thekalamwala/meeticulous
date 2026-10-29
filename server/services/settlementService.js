/**
 * settlementService.js — vendor settlement balance (Financial Ledger P2).
 *
 * Single source of truth for a vendor's withdrawable balance. Withdrawable
 * money is gated on service COMPLETION plus a clearing window:
 *   pending_completion -> clearing (completed, in window) -> available (matured)
 * Cancelled / not_eligible bookings are excluded. The P1 ledger remains the
 * accounting record (Vendor Payables credited at payment); this derives
 * eligibility from bookings, which is authoritative for what is truly owed
 * (a cancelled paid booking still credits the ledger until P3 refunds reverse it).
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param {string} hostId
 * @param {number} clearingDays  days after completion before money matures
 * @param {number} [nowMs]       injectable clock for tests
 * // lifetimeEarned is GROSS eligible+pending (sum of non-cancelled booking amounts); it is NOT net of payouts.
 * @returns {Promise<{available:number, clearing:number, pendingCompletion:number,
 *                     inflight:number, paidOut:number, lifetimeEarned:number}>}
 */
async function computeSettlementBalance(hostId, clearingDays, nowMs = Date.now()) {
  const cutoff = nowMs - (Number(clearingDays) || 0) * 86400000;

  const { data: bookings, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select('vendor_amount, settlement_status, completed_at, payment_status, transfer_status')
    .eq('host_id', hostId);
  if (bErr) throw new Error(`settlementService: bookings query failed: ${bErr.message}`);

  let matured = 0, clearing = 0, pendingCompletion = 0, autoPaidOut = 0, autoInTransit = 0;
  for (const b of bookings || []) {
    // Clamp to ≥0: vendor_amount is a payout share and must never be negative.
    // A negative value (only reachable via a corrupted booking row) would silently
    // suppress a host's real matured balance, so treat it as 0 defensively.
    const amt = Math.max(0, Number(b.vendor_amount) || 0);
    const ss = b.settlement_status;
    if (ss === 'cancelled' || ss === 'not_eligible') continue;
    // v3.99 auto Route rail: a booking already paid (processed) or in-flight (held,
    // pending) via its own per-booking transfer is NOT withdrawable through the
    // manual rail — counting it here too would let a host withdraw money they have
    // already been paid (double pay). null / 'failed' / 'reversed' = not paid, so it
    // falls through to the normal maturation buckets and stays owed.
    const ts = b.transfer_status;
    if (ts === 'processed') { autoPaidOut += amt; continue; }
    if (ts === 'pending') { autoInTransit += amt; continue; }
    if (ss === 'eligible_for_settlement') {
      const completedMs = b.completed_at ? new Date(b.completed_at).getTime() : NaN;
      if (Number.isFinite(completedMs) && completedMs <= cutoff) matured += amt;
      else clearing += amt;   // in-window OR missing/invalid completed_at -> clearing (visible, not yet withdrawable)
    } else if (b.payment_status === 'paid' && ss === 'pending_completion') {
      pendingCompletion += amt;
    }
  }

  // v3.77: released cash referral rewards are withdrawable immediately — they carry
  // their OWN hold (release_at, enforced before status='rewarded'), so they are NOT
  // subject to the service-completion clearing window. Only cash_inr hits the payout
  // rail; account_credit (not yet spendable) is excluded.
  // Fail-soft: the referrals table ships in v3.77 and is applied manually on both
  // DBs — until then, referral rewards simply read as 0 (never break payout reads).
  const { data: refRewards, error: rErr } = await supabaseAdmin
    .from('referrals')
    .select('reward_value')
    .eq('referrer_id', hostId)
    .eq('status', 'rewarded')
    .eq('reward_type', 'cash_inr');
  if (rErr) console.error('settlementService: referrals read skipped:', rErr.message);
  else for (const r of refRewards || []) matured += Math.max(0, Number(r.reward_value) || 0);

  const { data: payouts, error: pErr } = await supabaseAdmin
    .from('payout_requests')
    .select('amount, status')
    .eq('host_id', hostId);
  if (pErr) throw new Error(`settlementService: payout_requests query failed: ${pErr.message}`);

  let claimed = 0, inflight = 0, paidOut = 0;
  for (const p of payouts || []) {
    const amt = Number(p.amount) || 0;
    if (p.status === 'paid') { claimed += amt; paidOut += amt; }
    else if (p.status === 'approved' || p.status === 'pending') { claimed += amt; inflight += amt; }
  }

  const available = Math.max(0, matured - claimed);
  // Held auto-transfers read as "in transit"; processed ones as "paid out" — on top
  // of the manual-rail figures so the host sees both rails in one truthful total.
  const clearingTotal = clearing + autoInTransit;
  return {
    available: round2(available),
    clearing: round2(clearingTotal),
    pendingCompletion: round2(pendingCompletion),
    inflight: round2(inflight),
    paidOut: round2(paidOut + autoPaidOut),
    lifetimeEarned: round2(matured + clearingTotal + pendingCompletion + autoPaidOut),
  };
}

/**
 * Batch variant of computeSettlementBalance — computes every host's settlement
 * breakdown in two queries (all bookings + all payout_requests) instead of
 * 2 queries per host. Used by the admin Payouts → Clearing view for platform-wide
 * fund visibility. Same maturation rules as computeSettlementBalance.
 *
 * @param {number} clearingDays
 * @param {number} [nowMs]
 * @returns {Promise<Map<string, {available:number, clearing:number,
 *   pendingCompletion:number, inflight:number, paidOut:number, lifetimeEarned:number}>>}
 *   keyed by host_id. Only hosts that appear in bookings or payouts are present.
 */
async function computeAllSettlementBalances(clearingDays, nowMs = Date.now()) {
  const cutoff = nowMs - (Number(clearingDays) || 0) * 86400000;

  const { data: bookings, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select('host_id, vendor_amount, settlement_status, completed_at, payment_status, transfer_status')
    .not('host_id', 'is', null);
  if (bErr) throw new Error(`settlementService: bookings query failed: ${bErr.message}`);

  const { data: payouts, error: pErr } = await supabaseAdmin
    .from('payout_requests')
    .select('host_id, amount, status')
    .not('host_id', 'is', null);
  if (pErr) throw new Error(`settlementService: payout_requests query failed: ${pErr.message}`);

  // v3.77: released cash referral rewards, per referrer (see single-host variant).
  // Fail-soft (see single-host variant): 0 referral rewards until v3.77 is applied.
  const { data: refRewards, error: rErr } = await supabaseAdmin
    .from('referrals')
    .select('referrer_id, reward_value')
    .eq('status', 'rewarded')
    .eq('reward_type', 'cash_inr');
  if (rErr) console.error('settlementService: referrals read skipped:', rErr.message);

  // matured / clearing / pendingCompletion per host (mirrors single-host logic).
  const acc = new Map(); // host_id -> { matured, clearing, pendingCompletion, claimed, inflight, paidOut, autoPaidOut, autoInTransit }
  const bucket = (id) => {
    let b = acc.get(id);
    if (!b) { b = { matured: 0, clearing: 0, pendingCompletion: 0, claimed: 0, inflight: 0, paidOut: 0, autoPaidOut: 0, autoInTransit: 0 }; acc.set(id, b); }
    return b;
  };

  for (const bk of bookings || []) {
    const b = bucket(bk.host_id);
    const amt = Math.max(0, Number(bk.vendor_amount) || 0);
    const ss = bk.settlement_status;
    if (ss === 'cancelled' || ss === 'not_eligible') continue;
    // Auto Route rail (see computeSettlementBalance): already-paid / held bookings are
    // not withdrawable via the manual rail. null / 'failed' / 'reversed' stay owed.
    const ts = bk.transfer_status;
    if (ts === 'processed') { b.autoPaidOut += amt; continue; }
    if (ts === 'pending') { b.autoInTransit += amt; continue; }
    if (ss === 'eligible_for_settlement') {
      const completedMs = bk.completed_at ? new Date(bk.completed_at).getTime() : NaN;
      if (Number.isFinite(completedMs) && completedMs <= cutoff) b.matured += amt;
      else b.clearing += amt;
    } else if (bk.payment_status === 'paid' && ss === 'pending_completion') {
      b.pendingCompletion += amt;
    }
  }

  for (const p of payouts || []) {
    const b = bucket(p.host_id);
    const amt = Number(p.amount) || 0;
    if (p.status === 'paid') { b.claimed += amt; b.paidOut += amt; }
    else if (p.status === 'approved' || p.status === 'pending') { b.claimed += amt; b.inflight += amt; }
  }

  for (const r of refRewards || []) {
    bucket(r.referrer_id).matured += Math.max(0, Number(r.reward_value) || 0);
  }

  const out = new Map();
  for (const [id, b] of acc) {
    const clearingTotal = b.clearing + b.autoInTransit;
    out.set(id, {
      available: round2(Math.max(0, b.matured - b.claimed)),
      clearing: round2(clearingTotal),
      pendingCompletion: round2(b.pendingCompletion),
      inflight: round2(b.inflight),
      paidOut: round2(b.paidOut + b.autoPaidOut),
      lifetimeEarned: round2(b.matured + clearingTotal + b.pendingCompletion + b.autoPaidOut),
    });
  }
  return out;
}

module.exports = { computeSettlementBalance, computeAllSettlementBalances };
