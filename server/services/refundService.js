'use strict';

/**
 * refundService.js — the single place a booking refund is ISSUED (audit F2/F14).
 *
 * Before this, refunds existed only behind an admin button (financeAdminController
 * .executeRefund) that nobody had ever pressed: a guest who cancelled a PAID
 * booking got status='cancelled' and kept losing their money, with only an
 * adminAlert asking a human to refund in the Razorpay dashboard. In the platform's
 * history that never happened once.
 *
 * issueBookingRefund() now performs the whole refund atomically enough to be safe:
 *   1. guard (paid, has a captured payment, host not already settled)
 *   2. compute the amount from the /refund policy (tiered on service price, or a
 *      full customer_total refund for our/host fault)
 *   3. Razorpay refund (idempotent against an already-refunded payment)
 *   4. ledger REFUND entry + held-transfer reversal (recordBookingRefund)
 *   5. reflect it on the booking row (F14): refunded_amount + refunded_at, and
 *      payment_status='refunded' on a FULL refund, so the guest console + Bolt no
 *      longer tell a refunded guest they were not refunded.
 *
 * Shared by the admin action AND the auto-refund-on-cancel path so the money logic
 * can't drift. NEVER throws for the auto path's sake would be wrong — it returns a
 * structured result; callers decide whether a failure blocks them (admin: surface;
 * auto-cancel: alert + continue).
 */

const { supabaseAdmin } = require('../config/supabase');
const razorpayConfig = require('./razorpayConfig');
const { recordBookingRefund } = require('./bookingCapture');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Guest-initiated cancellation refund tiers (see /refund policy §1), applied to
// the SERVICE PRICE only — the platform fee + GST + PG fee are non-refundable.
// ≥24h before start → 100%, ≥6h → 50%, under 6h → nothing.
const refundTierPct = (hoursToStart) =>
  hoursToStart >= 24 ? 1 : hoursToStart >= 6 ? 0.5 : 0;

const isMissingColumn = (err) => {
  const msg = (err?.message || err?.details || '').toLowerCase();
  return err?.code === '42703' || /could not find the|column .* does not exist/i.test(msg);
};

/**
 * Issue (or determine ineligibility for) a refund on ONE paid booking.
 *
 * @param {object}  a
 * @param {string}  a.bookingId
 * @param {'tiered'|'full'} [a.mode='tiered']  tiered = guest-initiated (time tier on
 *   service price); full = our/host fault (entire customer_total).
 * @param {string} [a.reason]
 * @param {string} [a.actorEmail]  who triggered it (Razorpay notes + audit).
 * @returns {Promise<{ ok:boolean, amount?:number, refundId?:string,
 *   paymentStatus?:string, transferReversed?:boolean, ledgerPosted?:boolean,
 *   reason?:string, blocked?:string }>}
 *   ok:false carries either `reason` (not_paid / no_payment / not_eligible /
 *   already_refunded / error) or `blocked` ('payout_settled' — needs manual
 *   recovery from the host first).
 */
async function issueBookingRefund({ bookingId, mode = 'tiered', reason, actorEmail } = {}) {
  try {
    const { data: bk } = await supabaseAdmin
      .from('bookings')
      .select('id, payment_status, transfer_status, razorpay_payment_id, customer_total, scheduled_at, services(price)')
      .eq('id', bookingId)
      .maybeSingle();
    if (!bk) return { ok: false, reason: 'booking_not_found' };
    if (bk.payment_status !== 'paid') return { ok: false, reason: 'not_paid' };
    if (!bk.razorpay_payment_id) return { ok: false, reason: 'no_payment' };
    // Never absorb: if the host's payout already SETTLED to their bank, a refund
    // would leave the platform out of pocket. Recover from the host first (manual).
    if (bk.transfer_status === 'processed') return { ok: false, blocked: 'payout_settled' };

    const servicePrice = Number(bk.services?.price) || 0;
    const customerTotal = Number(bk.customer_total) || 0;
    let amount;
    if (mode === 'full') {
      amount = round2(customerTotal);
    } else {
      const hoursToStart = bk.scheduled_at ? (new Date(bk.scheduled_at).getTime() - Date.now()) / 3600000 : -1;
      amount = round2(servicePrice * refundTierPct(hoursToStart));
    }
    if (!(amount > 0)) return { ok: false, reason: 'not_eligible' };

    const client = await razorpayConfig.getClient();

    // Idempotency: Razorpay is the source of truth on what's already been returned.
    // Block if this payment was already (partly) refunded so a re-run / double
    // cancel can't stack refunds.
    const pay = await client.payments.fetch(bk.razorpay_payment_id);
    if (Number(pay?.amount_refunded) > 0) {
      return { ok: false, reason: 'already_refunded', amount: round2(Number(pay.amount_refunded) / 100) };
    }

    const paise = Math.round(amount * 100);
    const refund = await client.payments.refund(bk.razorpay_payment_id, {
      amount: paise,
      speed: 'optimum',
      notes: { booking_id: bk.id, mode, by: actorEmail || 'system' },
    });

    // Ledger REFUND + reverse the held payout (idempotent on the Razorpay refund id).
    const rec = await recordBookingRefund({
      bookingId: bk.id,
      refundAmountPaise: paise,
      refundId: refund.id,
      reason: reason || `${mode} refund`,
      reverseTransfer: true,
    });

    // F14: reflect the refund on the booking row so every consumer of the booking
    // (guest console, host dashboard, Bolt "where is my refund?", CRM attribution)
    // can see it. payment_status flips to 'refunded' only on a FULL refund; a
    // partial (tiered) refund keeps 'paid' and is visible via refunded_amount.
    let paymentStatus = bk.payment_status;
    const patch = { refunded_amount: amount, refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (amount >= customerTotal && customerTotal > 0) { patch.payment_status = 'refunded'; paymentStatus = 'refunded'; }
    let { error: upErr } = await supabaseAdmin.from('bookings').update(patch).eq('id', bk.id);
    if (upErr && isMissingColumn(upErr)) {
      // Pre-v3.141 DB: refunded_amount/refunded_at not yet applied — still flip
      // payment_status on a full refund so the row isn't left saying "paid".
      const minimal = patch.payment_status ? { payment_status: patch.payment_status, updated_at: patch.updated_at } : { updated_at: patch.updated_at };
      ({ error: upErr } = await supabaseAdmin.from('bookings').update(minimal).eq('id', bk.id));
    }
    if (upErr) console.error('issueBookingRefund: booking row update failed (refund already issued):', bk.id, upErr.message);

    return { ok: true, amount, refundId: refund.id, paymentStatus, transferReversed: rec.transferReversed, ledgerPosted: rec.posted };
  } catch (e) {
    console.error('issueBookingRefund failed:', bookingId, e.message);
    return { ok: false, reason: 'error', error: e.message };
  }
}

module.exports = { issueBookingRefund, refundTierPct };
