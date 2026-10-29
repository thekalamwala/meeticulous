/**
 * routeAutoPayoutService.js — Razorpay Route Phase 2: automatic host payout.
 *
 * On booking capture we create a payment-linked HELD transfer of the host's
 * vendor_amount to their Route linked account, held until the service is over + a
 * buffer. It is later RELEASED (customer marks complete → instant, or Razorpay
 * auto-releases at on_hold_until) or REVERSED (refund / cancel / dispute). This
 * file owns creating the held transfer; release/reversal live in later slices.
 *
 * Guardrails:
 *   • DORMANT while fee_only_mode is true (the safe default). No transfer created.
 *   • Only fires when the host has an ACTIVATED linked account; otherwise the money
 *     stays owed (tracked via bookings.vendor_amount) and the host is nudged to
 *     finish KYC — nothing is lost.
 *   • Idempotent — a booking that already has a transfer id is skipped.
 *   • Never throws to its caller — the capture hook is fire-and-forget; a transfer
 *     failure must never break (or delay) payment finalisation.
 *   • Schema-fallback — the v3.99 columns may not be applied yet; a missing column
 *     degrades to a logged no-op on the bookkeeping write, never a crash.
 */
'use strict';

const razorpayConfig = require('./razorpayConfig');
const { supabaseAdmin } = require('../config/supabase');
const { post } = require('./ledger/postingService');
const { payoutEntry } = require('./ledger/journalTemplates');
const { securityLog } = require('../utils/logger');

const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const HOLD_BUFFER_MS = 24 * 60 * 60 * 1000; // +24h after the service ends
// Razorpay lets you CREATE a transfer under ₹1 but refuses to REVERSE one
// ("amount must be atleast INR 1.00"). A sub-₹1 held transfer would therefore be
// un-reversible on cancel/dispute and auto-release anyway. So we don't create one
// below ₹1 — that payout just stays owed (accrues) instead.
const MIN_TRANSFER_RUPEES = 1;

const isMissingColumn = (err) => {
  const msg = (err?.message || err?.details || '').toLowerCase();
  return err?.code === '42703' || /column .* does not exist|could not find the .* column/.test(msg);
};

// The host's activated Route linked account id (set by routeAccountService onboarding).
async function getLinkedAccountId(hostId) {
  const { data } = await supabaseAdmin
    .from('kyc_submissions').select('razorpay_account_id').eq('user_id', hostId).maybeSingle();
  return data?.razorpay_account_id || null;
}

// Unix seconds at which Razorpay auto-releases the hold: service end + 24h,
// never in the past (Razorpay rejects a non-future on_hold_until).
async function computeHoldUntil(booking) {
  const startMs = new Date(booking.scheduled_at).getTime();
  let durationMin = Number(booking.services?.duration);
  if (!Number.isFinite(durationMin)) {
    const { data: svc } = await supabaseAdmin
      .from('services').select('duration').eq('id', booking.service_id).maybeSingle();
    durationMin = Number(svc?.duration) || 0;
  }
  const endMs = (Number.isFinite(startMs) ? startMs : Date.now()) + durationMin * 60000;
  const holdMs = Math.max(endMs + HOLD_BUFFER_MS, Date.now() + 60 * 60 * 1000); // ≥ +1h
  return Math.floor(holdMs / 1000);
}

// Patch the booking's transfer bookkeeping, swallowing a missing-column error.
async function patchBooking(bookingId, patch) {
  const { error } = await supabaseAdmin
    .from('bookings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', bookingId);
  if (error) {
    if (isMissingColumn(error)) { securityLog('route_auto_payout_schema_fallback', { bookingId }); return; }
    throw error;
  }
}

/**
 * Create a held Route transfer for a freshly-captured booking.
 * @param {object} booking  the captured booking row (needs id, host_id, scheduled_at, service_id).
 * @param {object} opts     { paymentId, vendorAmount }
 * @returns {Promise<{ ok, transferId?, status?, onHoldUntil?, skipped?, error? }>}
 */
async function createHeldTransferForBooking(booking, { paymentId, vendorAmount } = {}) {
  try {
    if (!booking?.id) return { ok: false, skipped: 'no_booking' };
    if (booking.razorpay_transfer_id) return { ok: true, transferId: booking.razorpay_transfer_id, skipped: 'already_transferred' };
    const amount = Number(vendorAmount);
    if (!(amount > 0)) return { ok: false, skipped: 'no_payout_due' };
    // Below Razorpay's ₹1 reversal floor → don't hold a payout we couldn't reverse.
    if (amount < MIN_TRANSFER_RUPEES) return { ok: false, skipped: 'below_min_transfer' };
    if (!paymentId) return { ok: false, skipped: 'no_payment_id' };

    if (await require('./paidMode').feeOnlyForHost(booking.host_id)) return { ok: false, skipped: 'fee_only_mode' };
    if (!(await razorpayConfig.isConfigured())) return { ok: false, skipped: 'razorpay_unconfigured' };

    // No linked account → money stays owed (host nudged to finish KYC). Not an error.
    const account = await getLinkedAccountId(booking.host_id);
    if (!account) return { ok: false, skipped: 'no_linked_account' };

    const onHoldUntil = await computeHoldUntil(booking);
    const razorpay = await razorpayConfig.getClient();
    const result = await razorpay.payments.transfer(paymentId, {
      transfers: [{
        account, amount: toPaise(amount), currency: 'INR',
        on_hold: true, on_hold_until: onHoldUntil,
        notes: { booking_id: String(booking.id), host_id: String(booking.host_id) },
      }],
    });
    const t = result?.items?.[0] || result;
    const transferId = t?.id;
    if (!transferId) throw new Error('Razorpay transfer returned no id');

    await patchBooking(booking.id, {
      razorpay_transfer_id: transferId,
      transfer_status: t?.status || 'pending',
      transfer_error: null,
      transfer_hold_until: new Date(onHoldUntil * 1000).toISOString(),
    });
    return { ok: true, transferId, status: t?.status || 'pending', onHoldUntil };
  } catch (err) {
    const reason = err?.error?.description || err?.message || 'unknown error';
    securityLog('route_auto_payout_error', { bookingId: booking?.id, reason });
    try { await patchBooking(booking.id, { transfer_status: 'failed', transfer_error: reason.slice(0, 500) }); } catch (_) { /* logged */ }
    return { ok: false, error: reason };
  }
}

// Post the SETTLEMENT ledger entry (relieve Vendor Payables → Bank) and mark the
// booking's transfer released. Idempotent on (SETTLEMENT, booking.id) + the
// transfer_status guard, so calling from release AND the webhook settles once.
async function finalizeReleasedTransfer(booking, createdBy = null) {
  const amount = Number(booking.vendor_amount) || 0;
  if (amount > 0) {
    await post({
      sourceType: 'SETTLEMENT', sourceId: booking.id,
      journalDate: new Date().toISOString().slice(0, 10), createdBy,
      template: payoutEntry({ host_id: booking.host_id, amount, reference: booking.razorpay_transfer_id }),
    });
  }
  await patchBooking(booking.id, {
    transfer_status: 'processed', transfer_released_at: new Date().toISOString(), transfer_error: null,
  });
  // Tell the host their money actually moved — the real settlement event was
  // previously silent (the loud "Payout paid" was the unverified manual one), so a
  // paid host had no confirmation. Fire-and-forget; never breaks finalisation.
  if (amount > 0 && booking.host_id) {
    require('../utils/inAppNotify').inAppNotify({
      userId: booking.host_id, role: 'host', type: 'PAYOUT_UPDATE',
      title: `Payout sent: ₹${amount.toFixed(2)}`,
      body: 'Your earnings are on the way to your bank account.',
      link: '/dashboard/payments/payouts',
    });
    // Email the host too (deduped once per booking; fire-and-forget).
    require('./payoutEmails').sendPayoutSent(booking, amount).catch(() => {});
  }
}

/**
 * Release a booking's held transfer NOW (host is paid). Called when the CUSTOMER
 * confirms the booking is complete. No-op if there's no held transfer.
 */
async function releaseHeldTransfer(booking, { createdBy = null } = {}) {
  try {
    if (!booking?.razorpay_transfer_id) return { ok: false, skipped: 'no_transfer' };
    if (booking.transfer_status === 'processed') return { ok: true, skipped: 'already_released' };
    if (booking.transfer_status === 'reversed') return { ok: false, skipped: 'reversed' };

    const razorpay = await razorpayConfig.getClient();
    await razorpay.transfers.edit(booking.razorpay_transfer_id, { on_hold: false });
    await finalizeReleasedTransfer(booking, createdBy);
    return { ok: true, released: true };
  } catch (err) {
    const reason = err?.error?.description || err?.message || 'unknown error';
    securityLog('route_auto_payout_release_error', { bookingId: booking?.id, reason });
    return { ok: false, error: reason };
  }
}

/**
 * Reverse a booking's held transfer so the host is NOT paid — used on refund,
 * cancellation, a customer "report a problem", or a payment dispute. Safe while
 * the transfer is held (the normal case, before the +24h release); a reversal of
 * an already-released transfer is attempted too but may be outside Razorpay's
 * window (recorded as an error for follow-up).
 * @returns {Promise<{ ok, reversed?, skipped?, error? }>}
 */
async function reverseHeldTransfer(booking, { reason = 'reversed' } = {}) {
  try {
    if (!booking?.razorpay_transfer_id) return { ok: false, skipped: 'no_transfer' };
    if (booking.transfer_status === 'reversed') return { ok: true, skipped: 'already_reversed' };

    const razorpay = await razorpayConfig.getClient();
    await razorpay.transfers.reverse(booking.razorpay_transfer_id, {});
    await patchBooking(booking.id, { transfer_status: 'reversed', transfer_error: reason.slice(0, 500) });
    // Tell the host their earning was reversed (deduped once per booking).
    require('./payoutEmails').sendEarningReversed(booking).catch(() => {});
    return { ok: true, reversed: true };
  } catch (err) {
    const msg = err?.error?.description || err?.message || 'unknown error';
    securityLog('route_auto_payout_reverse_error', { bookingId: booking?.id, reason: msg });
    // Record the attempt so an admin can reconcile a transfer we couldn't reverse.
    try { await patchBooking(booking.id, { transfer_error: `reverse failed: ${msg}`.slice(0, 500) }); } catch (_) { /* logged */ }
    return { ok: false, error: msg };
  }
}

// Reverse the held transfer for a booking identified by its razorpay_payment_id
// (used by refund / dispute webhooks that carry a payment, not a booking).
async function reverseByPaymentId(paymentId, reason) {
  const { data: booking } = await supabaseAdmin
    .from('bookings').select('*').eq('razorpay_payment_id', paymentId).maybeSingle();
  if (!booking || !booking.razorpay_transfer_id) return { ok: false, skipped: 'no_held_transfer' };
  return reverseHeldTransfer(booking, { reason });
}

// In-app "money reached your bank" — the settlement leg was previously silent.
// sendPayoutSent (release) said "on its way"; this is the actual arrival.
function notifySettled(booking) {
  const amt = Number(booking.vendor_amount) || 0;
  require('../utils/inAppNotify').inAppNotify({
    userId: booking.host_id, role: 'host', type: 'PAYOUT_UPDATE',
    title: amt > 0 ? `Settled to your bank: ₹${amt.toFixed(2)}` : 'Payout settled to your bank',
    body: 'Your earnings have reached your bank account.',
    link: '/dashboard/payments/payouts',
  });
}

/**
 * Record a Razorpay transfer's SETTLEMENT (linked-account balance -> host's bank) onto
 * its booking. Idempotent; stamps transfer_settled_at exactly once (atomic first-writer)
 * on the 'settled' transition and notifies the host then. Schema-fallback (v3.124).
 * @param {object} t  a Razorpay transfer entity (id, settlement_status, recipient_settlement_id)
 * ponytail: no new "settled" email — the release email already told the host it was
 * on its way; the in-app confirmation + UI badge close the loop without a new template.
 */
async function applyTransferSettlement(t) {
  if (!t?.id) return { skipped: 'no_id' };
  const status = t.settlement_status || null;   // 'pending' | 'on_hold' | 'settled'
  const { error } = await supabaseAdmin.from('bookings').update({
    transfer_settlement_status: status,
    recipient_settlement_id: t.recipient_settlement_id || null,
    updated_at: new Date().toISOString(),
  }).eq('razorpay_transfer_id', t.id);
  if (error) { if (isMissingColumn(error)) return { skipped: 'schema' }; throw error; }

  if (status === 'settled') {
    const { data } = await supabaseAdmin.from('bookings')
      .update({ transfer_settled_at: new Date().toISOString() })
      .eq('razorpay_transfer_id', t.id).is('transfer_settled_at', null)
      .select('id, host_id, vendor_amount').maybeSingle();
    if (data) notifySettled(data);
    return { settled: true, firstSettle: !!data };
  }
  return { settled: false, status };
}

/**
 * Apply a Route settlement.processed webhook. The settlement entity references a
 * recipient settlement (setl_...); every transfer it settled carries that id in
 * recipient_settlement_id. We fetch those transfers (parent-scoped read) and mark
 * their bookings settled-to-bank. Self-filtering: a settlement that isn't a Route
 * linked-account one (e.g. the parent merchant's own) has no matching transfers, so
 * this no-ops — safe to receive every settlement.processed event.
 * @returns {Promise<{ handled: boolean, transfers?: number, settled?: number, reason?: string }>}
 */
async function handleSettlementWebhook(settlement) {
  const settlementId = settlement?.id;
  if (!settlementId) return { handled: false, reason: 'no_settlement_id' };
  let items = [];
  try {
    const razorpay = await razorpayConfig.getClient();
    const resp = await razorpay.transfers.all({ recipient_settlement_id: settlementId, count: 100 });
    items = resp?.items || [];
  } catch (err) {
    securityLog('route_settlement_fetch_error', { settlementId, reason: err?.error?.description || err?.message });
    return { handled: false, reason: 'fetch_failed' };
  }
  if (!items.length) return { handled: true, reason: 'no_route_transfers' };
  let settled = 0;
  for (const t of items) {
    try { const r = await applyTransferSettlement(t); if (r.firstSettle) settled++; }
    catch (err) { securityLog('route_settlement_apply_error', { transferId: t?.id, reason: err?.message }); }
  }
  return { handled: true, transfers: items.length, settled };
}

/**
 * Apply a Route transfer.* webhook that belongs to a BOOKING held transfer.
 * transfer.processed (released — either via releaseHeldTransfer or Razorpay's
 * on_hold_until auto-release) → finalise the payout; failed/reversed → record it.
 * @returns {Promise<{ handled: boolean, reason?: string }>}
 */
async function handleBookingTransferWebhook(transfer) {
  const transferId = transfer?.id;
  if (!transferId) return { handled: false, reason: 'no_transfer_id' };
  const { data: booking } = await supabaseAdmin
    .from('bookings').select('*').eq('razorpay_transfer_id', transferId).maybeSingle();
  if (!booking) return { handled: false, reason: 'not_a_booking_transfer' };

  const status = transfer.status;
  if (status === 'processed') {
    // Seed the settlement leg from the transfer entity (usually 'pending' at processed);
    // settlement.processed later flips it to 'settled'. Best-effort, never blocks finalise.
    await applyTransferSettlement(transfer).catch(() => {});
    if (booking.transfer_status === 'processed') return { handled: true, reason: 'already' };
    await finalizeReleasedTransfer(booking, null);
    return { handled: true };
  }
  if (status === 'failed' || status === 'reversed') {
    await patchBooking(booking.id, {
      transfer_status: status,
      transfer_error: transfer.error?.description || status,
    });
    return { handled: true };
  }
  return { handled: true, reason: `ignored_status_${status || 'none'}` };
}

module.exports = {
  createHeldTransferForBooking, releaseHeldTransfer, reverseHeldTransfer, reverseByPaymentId,
  handleBookingTransferWebhook, finalizeReleasedTransfer, computeHoldUntil, toPaise,
  handleSettlementWebhook, applyTransferSettlement,
};
