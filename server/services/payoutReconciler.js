/**
 * payoutReconciler.js — the safety net the host payout rail never had.
 *
 * The automatic Route payout (routeAutoPayoutService) is a single fire-and-forget
 * attempt at booking capture. If it was skipped (host not yet onboarded / not
 * activated), failed, or the transfer got stuck 'pending' after a missed
 * transfer.processed webhook, nothing ever heals it — the host is simply never
 * paid. This cron periodically:
 *
 *   0. REFRESH  — re-reads Razorpay Route product activation for hosts whose
 *                 account is not yet 'activated', so a needs_clarification →
 *                 activated transition is picked up (the code writes activation at
 *                 onboarding and otherwise never re-reads it — so without this a
 *                 host stays payout-ineligible forever even after Razorpay approves).
 *   1. CREATE   — finds paid bookings that owe the host money but have no transfer,
 *                 and (for payout-ELIGIBLE hosts only) creates the held transfer.
 *                 Covers KYC-after-payment, go-live backfill, transient failures.
 *   2. FINALIZE — finds held transfers past their hold whose completion webhook was
 *                 missed, asks Razorpay their real status, and finalizes the ones now
 *                 paid (posts the SETTLEMENT ledger entry + flips to processed). A
 *                 CANCELLED booking is never finalized — if its transfer released
 *                 anyway it's flagged for manual clawback.
 *   3. ALERT    — if money is owed to hosts who CAN'T be paid (activation stuck, no
 *                 account, KYC), attempts are exhausted, or a clawback is needed,
 *                 emails the founder. This is the "pipeline is broken" signal.
 *
 * Mode (platform_settings.payout_reconciler_mode, via platformConfig):
 *   'off'     dormant — does nothing.
 *   'observe' scans + REFRESHES activation + ALERTS, but moves NO money. Default.
 *   'live'    also creates/retries/finalizes transfers.
 *
 * Safety: money movement only in 'live'; per-booking creation is idempotent
 * (routeAutoPayoutService skips a booking that already has a transfer) and gated by
 * isPayoutEligible so we never attempt a doomed transfer to an unactivated account;
 * retries are capped (transfer_attempts) so a permanently-failing booking is alerted,
 * not hammered. Schema-fallback on the v3.116 columns. Never throws to the cron.
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');
const razorpayConfig = require('./razorpayConfig');
const platformConfig = require('./platformConfig');
const { isPayoutEligible } = require('./payoutEligibility');
const { createHeldTransferForBooking, finalizeReleasedTransfer, applyTransferSettlement } = require('./routeAutoPayoutService');
const routeAccountService = require('./routeAccountService');
const { adminAlert } = require('../utils/adminAlert');
const { securityLog } = require('../utils/logger');

const MIN_TRANSFER_RUPEES = 1;                                    // mirrors routeAutoPayoutService
const MAX_ATTEMPTS = Number(process.env.PAYOUT_RECONCILE_MAX_ATTEMPTS || 5);
const SCAN_LIMIT = Number(process.env.PAYOUT_RECONCILE_LIMIT || 300);
const SKIP_SETTLE = new Set(['cancelled', 'not_eligible']);

// The "payouts blocked" condition persists across runs, and the cron fires every
// ~15 min — so throttle the alert to at most once per window. The timestamp is
// PERSISTED (platform_settings) so it survives restarts; an in-memory throttle
// reset on every Render cold-start and inboxed the founder ~hourly.
const BLOCKED_ALERT_EVERY_MS = Number(process.env.PAYOUT_ALERT_EVERY_MS || 6 * 60 * 60 * 1000);
const ALERT_KEY = 'payout_alert_last_at';

// Restart-proof throttle: returns true (and stamps 'now') at most once per window.
// Fail-closed on error — better to skip an alert than risk a spam loop.
async function claimAlertSlot(windowMs) {
  try {
    const { data } = await supabaseAdmin.from('platform_settings').select('value').eq('key', ALERT_KEY).maybeSingle();
    const last = Number(data?.value) || 0;
    if (Date.now() - last < windowMs) return false;
    await supabaseAdmin.from('platform_settings').upsert({ key: ALERT_KEY, value: Date.now() }, { onConflict: 'key' });
    return true;
  } catch (e) {
    securityLog('payout_alert_throttle_error', { reason: e.message });
    return false;
  }
}

const isMissingColumn = (err) => {
  const msg = (err?.message || err?.details || '').toLowerCase();
  return err?.code === '42703' || /column .* does not exist|could not find the .* column/.test(msg);
};

// Record a transfer attempt (retry cap + backoff). Swallows a missing-column error
// (v3.116 not applied yet) so the reconciler still works, just without the cap.
async function bumpAttempt(bookingId, current) {
  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ transfer_attempts: (Number(current) || 0) + 1, transfer_last_attempt_at: new Date().toISOString() })
    .eq('id', bookingId);
  if (error && !isMissingColumn(error)) throw error;
}

/**
 * Step 0 — re-read Route product activation from Razorpay for accounts not yet
 * 'activated' and persist any change. Read-only against our money (only updates a
 * status column), so it runs in 'observe' too. Returns how many newly activated.
 */
async function refreshActivations(rz) {
  if (!rz) return { refreshed: 0, activated: 0 };
  const { data: rows, error } = await supabaseAdmin
    .from('kyc_submissions')
    .select('id, razorpay_account_id, razorpay_product_id, route_activation_status')
    .not('razorpay_account_id', 'is', null)
    .not('razorpay_product_id', 'is', null)
    .limit(100);
  if (error) { if (!isMissingColumn(error)) securityLog('payout_reconcile_activation_query', { reason: error.message }); return { refreshed: 0, activated: 0 }; }

  let refreshed = 0, activated = 0;
  for (const r of (rows || []).filter((x) => x.route_activation_status !== 'activated')) {
    try {
      const prod = await rz.products.fetch(r.razorpay_account_id, r.razorpay_product_id); // read-only
      const status = prod?.activation_status;
      if (status && status !== r.route_activation_status) {
        await supabaseAdmin.from('kyc_submissions')
          .update({ route_activation_status: status, route_synced_at: new Date().toISOString() })
          .eq('id', r.id);
        refreshed++;
        if (status === 'activated') activated++;
      }
    } catch (e) {
      securityLog('payout_reconcile_activation_error', { kycId: r.id, reason: e.message });
    }
  }
  return { refreshed, activated };
}

/**
 * Retry Route linked-account creation for hosts whose KYC is approved but who have no
 * account yet — the safety net for the fire-and-forget onboarding (a create skipped or
 * failed at approval/submit would otherwise strand the host 'approved' with no way to be
 * paid; critical once autopilot removes the human who'd notice). Idempotent
 * (routeAccountService no-ops when already onboarded / in fee-only mode). Creates a
 * Razorpay linked account (KYC config) — it moves NO money, so it runs in observe too.
 */
async function createMissingAccounts() {
  const { data: rows, error } = await supabaseAdmin
    .from('kyc_submissions').select('*')
    .eq('status', 'approved').is('razorpay_account_id', null).limit(50);
  if (error) { if (!isMissingColumn(error)) securityLog('payout_reconcile_account_query', { reason: error.message }); return 0; }
  let created = 0;
  for (const k of rows || []) {
    try { const r = await routeAccountService.createLinkedAccount(k); if (r?.ok && r.accountId) created++; }
    catch (e) { securityLog('payout_reconcile_account_error', { kycId: k.id, reason: e.message }); }
  }
  return created;
}

/**
 * @returns {Promise<object>} run summary
 */
async function reconcile() {
  const { payoutReconcilerMode: mode } = await platformConfig.getConfig();
  if (mode === 'off') return { skipped: 'off', mode };
  const live = mode === 'live';

  const s = {
    mode, refreshed: 0, activated: 0, accountsCreated: 0, created: 0, finalized: 0, released: 0, failedAttempt: 0,
    blocked: 0, owedBlocked: 0, owedBlockedActionable: 0, owedBlockedSum: 0, candidates: 0, stuck: 0, clawbackNeeded: 0,
  };
  const reasonCounts = {};

  // A single Razorpay client for activation refresh + finalize (best-effort).
  let rz = null;
  try { rz = await razorpayConfig.getClient(); } catch (e) { securityLog('payout_reconcile_no_client', { reason: e.message }); }

  // ---- 0. Refresh Route activation so eligibility unblocks itself ----
  const act = await refreshActivations(rz);
  s.refreshed = act.refreshed; s.activated = act.activated;

  // ---- 0b. Create missing linked accounts (approved KYC, no account yet) ----
  s.accountsCreated = await createMissingAccounts();

  // ---- 1. Bookings owed money with no transfer yet (never attempted OR failed) ----
  const { data: owed, error: owedErr } = await supabaseAdmin
    .from('bookings')
    .select('id, host_id, scheduled_at, service_id, razorpay_payment_id, vendor_amount, settlement_status, transfer_status, transfer_attempts, services(duration)')
    .eq('payment_status', 'paid')
    .is('razorpay_transfer_id', null)
    .limit(SCAN_LIMIT);
  if (owedErr) throw new Error(`payoutReconciler: owed query failed: ${owedErr.message}`);

  const eligByHost = new Map();
  for (const b of owed || []) {
    const amt = Number(b.vendor_amount) || 0;
    if (amt < MIN_TRANSFER_RUPEES) continue;                 // below Razorpay's ₹1 reversal floor
    if (SKIP_SETTLE.has(b.settlement_status)) continue;      // cancelled / not eligible
    if ((Number(b.transfer_attempts) || 0) >= MAX_ATTEMPTS) {
      s.blocked++;
      // Payout failed repeatedly → email the host once to check their bank details.
      require('./payoutEmails').sendPayoutFailed(b, amt).catch(() => {});
      continue;
    }
    if (!b.razorpay_payment_id) continue;                    // can't create a payment-linked transfer without it
    s.candidates++;

    let elig = eligByHost.get(b.host_id);
    if (!elig) { elig = await isPayoutEligible(b.host_id); eligByHost.set(b.host_id, elig); }
    if (!elig.eligible) {
      s.owedBlocked++; s.owedBlockedSum += amt;
      for (const r of elig.reasons) reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      // Actionable-by-ops = an ONBOARDED host (has a linked account) stuck at Razorpay
      // activation. A host with no account/KYC simply hasn't onboarded — the KYC-earning
      // nudge prompts THEM, so it must never page ops (that was the hourly-email spam).
      if (elig.accountId && elig.reasons.includes('not_activated')) {
        s.owedBlockedActionable++;
        // Email the host once (deduped) that their verification needs finishing.
        require('./payoutEmails').sendVerificationNeeded(b.host_id).catch(() => {});
      }
      continue;
    }

    if (!live) continue;                                     // observe: count only, move nothing
    try {
      await bumpAttempt(b.id, b.transfer_attempts);
      const r = await createHeldTransferForBooking(b, { paymentId: b.razorpay_payment_id, vendorAmount: amt });
      if (r.ok && r.transferId) s.created++;
      else s.failedAttempt++;                                // service recorded transfer_status='failed'
    } catch (e) {
      s.failedAttempt++;
      securityLog('payout_reconcile_create_error', { bookingId: b.id, reason: e.message });
    }
  }

  // ---- 2. Release matured holds + finalize (and heal transfers we mis-marked
  // 'processed' while Razorpay still held them). Razorpay reports status='processed'
  // at execution even while on_hold, so a held transfer never auto-settles to the
  // host's bank until the hold is LIFTED — a transfer.processed webhook alone marked
  // our DB 'processed' while the money sat held. We therefore scan BOTH 'pending' and
  // 'processed', and for matured non-cancelled transfers still on_hold at Razorpay we
  // lift the hold so it settles. Money-safe: only owed, matured (past on_hold_until),
  // non-cancelled payouts, and only in 'live'.
  // ponytail: re-fetches every matured transfer each run — fine at current volume;
  // add a 'settled' flag / recent-window filter if this list ever grows large.
  const { data: matured, error: mErr } = await supabaseAdmin
    .from('bookings')
    .select('id, host_id, vendor_amount, razorpay_transfer_id, transfer_status, transfer_hold_until, settlement_status')
    .not('razorpay_transfer_id', 'is', null)
    .in('transfer_status', ['pending', 'processed'])
    .lt('transfer_hold_until', new Date().toISOString())
    .limit(SCAN_LIMIT);
  if (mErr && !isMissingColumn(mErr)) throw new Error(`payoutReconciler: matured query failed: ${mErr.message}`);
  s.stuck = (matured || []).filter((b) => b.transfer_status === 'pending').length;

  // The fetch + settlement-status sync runs in OBSERVE too: it reads from Razorpay and
  // writes ONLY the settlement columns (transfer_settlement_status / transfer_settled_at /
  // recipient_settlement_id) — no money moves. This is what backfills the bank-settlement
  // leg for transfers processed before v3.124 with NO shell access (free-tier Render):
  // the cron picks them up on its next tick. Everything below `if (!live) continue` moves
  // money or rewrites transfer_status, so it stays strictly live-only.
  if (rz && matured && matured.length) {
    for (const b of matured) {
      try {
        const cancelled = SKIP_SETTLE.has(b.settlement_status);
        const t = await rz.transfers.fetch(b.razorpay_transfer_id);   // read
        // Catch-up for a missed settlement.processed webhook: record the bank-settlement
        // leg (pending/on_hold/settled) from the fetched transfer. Idempotent, status-only.
        await applyTransferSettlement(t).catch((e) => securityLog('payout_reconcile_settlement_error', { bookingId: b.id, reason: e.message }));
        if (!live) continue;   // observe: settlement synced above; move no money, rewrite no status
        if (t?.status === 'failed' || t?.status === 'reversed') {
          if (b.transfer_status !== t.status) {
            await supabaseAdmin.from('bookings')
              .update({ transfer_status: t.status, transfer_error: t.error?.description || t.status, updated_at: new Date().toISOString() })
              .eq('id', b.id);
          }
          continue;
        }
        if (cancelled) {
          // Released on a CANCELLED booking → host holds money they shouldn't. Never
          // release/finalize; flag for manual clawback (sub-₹1 can't be auto-reversed).
          if (t?.on_hold === false) {
            s.clawbackNeeded++;
            securityLog('payout_reconcile_clawback_needed', { bookingId: b.id, transferId: b.razorpay_transfer_id });
          }
          continue;
        }
        // Non-cancelled, matured, still held at Razorpay → LIFT the hold so it settles.
        if (t?.on_hold === true) {
          await rz.transfers.edit(b.razorpay_transfer_id, { on_hold: false });
          s.released++;
        }
        // Finalize once (idempotent): post SETTLEMENT + mark processed. No-op if already done.
        if (b.transfer_status !== 'processed') {
          await finalizeReleasedTransfer(b, null);
          s.finalized++;
        }
      } catch (e) {
        securityLog('payout_reconcile_release_error', { bookingId: b.id, reason: e.message });
      }
    }
  }

  // ---- 3. Alert ONLY on actionable blocks: an onboarded host stuck at Razorpay
  // activation, retry-capped failures, or a needed clawback. A host who simply
  // hasn't onboarded (no account/KYC) is handled by the KYC-earning nudge, not an
  // ops page — that was the hourly spam. Throttle persisted so restarts can't spam.
  if ((s.owedBlockedActionable > 0 || s.blocked > 0 || s.clawbackNeeded > 0) && await claimAlertSlot(BLOCKED_ALERT_EVERY_MS)) {
    const reasonStr = Object.entries(reasonCounts).map(([k, v]) => `${k}=${v}`).join(', ') || 'n/a';
    adminAlert({
      subject: `Payouts need attention — ${s.owedBlockedActionable} stuck at activation, ${s.blocked} failed, ${s.clawbackNeeded} clawback`,
      lines: [
        `The payout reconciler (${mode}) found host payouts that need attention.`,
        `Onboarded hosts stuck at Razorpay activation: ${s.owedBlockedActionable}`,
        `Retry-capped bookings: ${s.blocked}`,
        `Clawbacks needed (paid on a cancelled booking): ${s.clawbackNeeded}`,
        `(Also owed but not yet onboarded — host action, not ops: ₹${s.owedBlockedSum.toFixed(2)} / ${s.owedBlocked} bookings.)`,
        `Reasons: ${reasonStr}`,
        `Fix: resolve Razorpay Route activation for the affected linked accounts — clears automatically once 'activated'.`,
      ],
      key: 'payout_reconcile_blocked',
      category: 'Payment Receipt',
      link: '/admin/payouts',
    }).catch(() => { /* adminAlert never throws; ignore */ });
  }

  return s;
}

// Test-only: throttle is now persisted (platform_settings), so tests control it via
// the mocked supabase read. Kept as a no-op for backward-compatible test setup.
reconcile._resetAlertThrottle = () => {};

module.exports = { reconcile, refreshActivations };
