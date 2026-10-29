'use strict';

/**
 * bookingCapture.js — single place to finalise a captured booking payment
 * (security audit H-3).
 *
 * Before this, ONLY verifyPayment finalised a paid booking correctly: it flipped
 * unpaid→paid/confirmed AND recomputed vendor_amount with the real Razorpay fee
 * subtracted AND posted the ORDER_PAYMENT ledger entry. The webhook and the
 * booking-payment reconciler only flipped the status flags — so a booking
 * confirmed via the webhook/reconciler (the norm for redirect-based UPI flows)
 * kept its provisional vendor_amount (computed at creation with razorpayFee=0),
 * over-crediting the host by the gateway fee, and never posted to the ledger.
 *
 * All three paths now call finalizeBookingCapture so the money + ledger logic
 * can never drift again. Callers pass the fee/tax they already hold (webhook
 * event payload, captured payment, or payments.fetch), so there is no redundant
 * Razorpay round-trip.
 */

const { supabaseAdmin } = require('../config/supabase');
const {
  calculateVendorPayout, calculateTds, calculateTcs, calculateCommissionTaxable,
} = require('../lib/pricingEngine');

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * @param {object}  a
 * @param {string}  a.bookingId
 * @param {string}  a.paymentId       razorpay_payment_id
 * @param {number} [a.feePaise]       Razorpay fee in paise (INCLUDES tax). Omit if unknown.
 * @param {number} [a.taxPaise]       Razorpay tax in paise.
 * @param {object} [a.pricing]        pre-fetched snapshot to avoid a DB read:
 *   { commission_applied, commission_gst, platform_fee_amount, platform_fee_gst,
 *     customer_total, host_id, service_price }
 * @returns {Promise<{updated:object|null, vendorAmount?:number, feeExclTax?:number, tax?:number}>}
 *          updated is the booking row after the transition, or null if no row
 *          transitioned (already paid / cancelled / not found).
 */
async function finalizeBookingCapture({ bookingId, paymentId, feePaise, taxPaise, pricing }) {
  let snap = pricing;
  if (!snap) {
    const { data: bk } = await supabaseAdmin
      .from('bookings')
      .select('commission_applied, commission_gst, commission_taxable, tds_amount, tcs_amount, platform_fee_amount, platform_fee_gst, customer_total, host_id, services(price)')
      .eq('id', bookingId)
      .single();
    if (!bk) return { updated: null };
    snap = {
      commission_applied: bk.commission_applied,
      commission_gst: bk.commission_gst,
      commission_taxable: bk.commission_taxable,
      tds_amount: bk.tds_amount,
      tcs_amount: bk.tcs_amount,
      platform_fee_amount: bk.platform_fee_amount,
      platform_fee_gst: bk.platform_fee_gst,
      customer_total: bk.customer_total,
      host_id: bk.host_id,
      service_price: bk.services?.price || 0,
    };
  }

  const feeTotal = feePaise != null ? Number(feePaise) / 100 : 0;
  let tax = taxPaise != null ? Number(taxPaise) / 100 : 0;
  // Tax is a component of fee; clamp so excl-tax + tax always reconstitutes the total.
  tax = Math.min(tax, feeTotal);
  const feeExclTax = Math.max(0, round2(feeTotal - tax));
  const servicePrice = Number(snap.service_price) || 0;
  const commission = Number(snap.commission_applied) || 0;
  const commissionGst = Number(snap.commission_gst) || 0;
  // v4 statutory withholdings from the host's gross sale. Prefer the booking-time
  // snapshot; recompute at the default rate for legacy rows written before v3.93.
  const tds = snap.tds_amount != null ? Number(snap.tds_amount)
    : (servicePrice > 0 ? calculateTds(servicePrice) : 0);
  const tcs = snap.tcs_amount != null ? Number(snap.tcs_amount)
    : (servicePrice > 0 ? calculateTcs(servicePrice) : 0);
  const commissionTaxable = snap.commission_taxable != null ? Number(snap.commission_taxable)
    : (commission > 0 ? calculateCommissionTaxable(commission) : 0);
  // commission is GST-inclusive (its GST is inside), so it is NOT re-subtracted here.
  const vendorAmount = calculateVendorPayout(servicePrice, commission, feeTotal, tds, tcs);

  const paidAt = new Date().toISOString();
  const full = {
    payment_status: 'paid', status: 'confirmed', razorpay_payment_id: paymentId,
    razorpay_fee_actual: feeExclTax, razorpay_tax_actual: tax,
    vendor_amount: vendorAmount, paid_at: paidAt, updated_at: paidAt,
    tds_amount: tds, tcs_amount: tcs, commission_taxable: commissionTaxable,
  };
  // Idempotent: only an unpaid, non-cancelled row transitions. The .neq('paid')
  // lets a failed→paid retry through; .neq('cancelled') stops a late payment from
  // resurrecting a reaped stale hold (security audit H-2).
  const apply = (patch) =>
    supabaseAdmin.from('bookings').update(patch)
      .eq('id', bookingId).neq('payment_status', 'paid').neq('status', 'cancelled')
      .select('*, services(title)');
  let { data: rows, error } = await apply(full);
  if (error && /Could not find the|column.*does not exist/i.test(error.message)) {
    // Legacy DB without the v2.2/v2.8/v3.93 columns.
    const {
      razorpay_fee_actual: _a, razorpay_tax_actual: _b, paid_at: _c,
      tds_amount: _t, tcs_amount: _tc, commission_taxable: _ct, ...core
    } = full;
    ({ data: rows, error } = await apply(core));
  }
  if (error) throw error;
  const updated = rows && rows[0];
  if (!updated) return { updated: null };

  // Ledger: post ORDER_PAYMENT (non-fatal — payment is already recorded; the
  // ledger reconciler retries misses). Pre-v2.2 rows without a customer_total
  // snapshot can't balance → skip (the reconciler skips them too).
  const ledgerTotal = Number(snap.customer_total) || 0;
  if (ledgerTotal > 0) {
    const { orderPaymentEntry } = require('./ledger/journalTemplates');
    const { postSafe } = require('./ledger/postingService');
    await postSafe({
      sourceType: 'ORDER_PAYMENT',
      sourceId: bookingId,
      journalDate: paidAt.slice(0, 10),
      template: orderPaymentEntry({
        booking_id: bookingId,
        host_id: snap.host_id,
        service_price: servicePrice,
        platform_fee_amount: Number(snap.platform_fee_amount) || 0,
        platform_fee_gst: Number(snap.platform_fee_gst) || 0,
        commission_applied: commission,
        commission_gst: commissionGst,
        commission_taxable: commissionTaxable,
        tds_amount: tds,
        tcs_amount: tcs,
        razorpay_fee_actual: feeExclTax,
        razorpay_tax_actual: tax,
        vendor_amount: vendorAmount,
        customer_total: ledgerTotal,
      }),
    });
  }

  // Phase 2: auto-create a HELD Route transfer of the host's payout to their
  // linked account (released when the customer marks complete, or at +24h).
  // Fire-and-forget + self-gating (no-op in fee-only mode / no linked account) so
  // it never blocks or breaks payment finalisation. Idempotent on the booking.
  if (updated && vendorAmount > 0 && paymentId) {
    const { createHeldTransferForBooking } = require('./routeAutoPayoutService');
    createHeldTransferForBooking(updated, { paymentId, vendorAmount })
      .catch((e) => console.error('auto-payout held transfer failed:', e.message));
  }

  return { updated, vendorAmount, feeExclTax, tax };
}

/**
 * Deterministic uuid for a Razorpay refund id so the REFUND journal entry is
 * idempotent on (source_type, source_id). journal_entries.source_id is a uuid
 * column and Razorpay ids ("rfnd_...") are not uuids, so hash → uuid shape.
 */
function refundSourceId(refundId) {
  const crypto = require('crypto');
  const h = crypto.createHash('sha256').update(`refund:${refundId}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * recordBookingRefund — post the REFUND journal entry for a refund issued in the
 * Razorpay dashboard (the only refund path), and (optionally) reverse the
 * booking's held Route transfer so a refunded booking never also pays the host.
 *
 * LOOPHOLE FIX: without this, dashboard refund cash left the Razorpay balance
 * with no ledger entry and left Vendor Payables orphaned-credited. Called from
 * the `refund.processed` webhook (by payment id, amount in paise) and from the
 * admin "record refund" action (by booking id, amount in rupees). Idempotent on
 * the Razorpay refund id / reference; without one, one entry per booking.
 *
 * @param {object}  a
 * @param {string} [a.bookingId]         look up by booking id (admin path)
 * @param {string} [a.paymentId]         look up by razorpay_payment_id (webhook path)
 * @param {number} [a.refundAmount]      refund in ₹ (admin path)
 * @param {number} [a.refundAmountPaise] refund in paise (webhook path)
 * @param {string} [a.refundId]          Razorpay refund id / admin reference (idempotency)
 * @param {string} [a.reason]
 * @param {boolean}[a.reverseTransfer]   also reverse the held payout (default true)
 * @returns {{ posted:boolean, transferReversed:boolean, reason?:string, bookingId?:string }}
 */
async function recordBookingRefund({
  bookingId, paymentId, refundAmount, refundAmountPaise, refundId, reason, reverseTransfer = true,
}) {
  const cols = 'id, host_id, razorpay_payment_id, vendor_amount, commission_taxable, commission_gst, platform_fee_amount, platform_fee_gst, tds_amount, tcs_amount, customer_total, services(price)';
  const base = supabaseAdmin.from('bookings').select(cols);
  const { data: bk } = await (bookingId
    ? base.eq('id', bookingId).maybeSingle()
    : base.eq('razorpay_payment_id', paymentId).maybeSingle());
  // Not a booking payment (e.g. a subscription/product refund) or unknown id →
  // needs a manual decision; caller alerts. We never guess legs we can't map.
  if (!bk) return { posted: false, transferReversed: false, reason: bookingId ? 'booking_not_found' : 'no_booking_for_payment' };

  // Stop the host being paid for a refunded booking (idempotent; no-op if there
  // is no held transfer). Mirrors the dispute path. Keyed on the booking's
  // payment id (the admin path may not carry one).
  let transferReversed = false;
  const pid = paymentId || bk.razorpay_payment_id;
  if (reverseTransfer && pid) {
    try {
      const rev = await require('./routeAutoPayoutService').reverseByPaymentId(pid, reason || `refund ${refundId || ''}`.trim());
      transferReversed = !!rev.ok;
    } catch (e) {
      console.error('recordBookingRefund: held-transfer reverse failed', bk.id, e.message);
    }
  }

  const amount = refundAmount != null ? round2(refundAmount) : round2(Number(refundAmountPaise || 0) / 100);
  if (!(amount > 0)) return { posted: false, transferReversed, reason: 'zero_refund_amount', bookingId: bk.id };

  const { post } = require('./ledger/postingService');
  const { refundEntry } = require('./ledger/journalTemplates');
  await post({
    sourceType: 'REFUND',
    sourceId: refundId ? refundSourceId(refundId) : `${bk.id}`,
    journalDate: new Date().toISOString().slice(0, 10),
    template: refundEntry({
      booking_id: bk.id,
      host_id: bk.host_id,
      refund_amount: amount,
      refund_id: refundId,
      service_price: Number(bk.services?.price) || 0,
      vendor_amount: Number(bk.vendor_amount) || 0,
      commission_taxable: Number(bk.commission_taxable) || 0,
      commission_gst: Number(bk.commission_gst) || 0,
      platform_fee_amount: Number(bk.platform_fee_amount) || 0,
      platform_fee_gst: Number(bk.platform_fee_gst) || 0,
      tds_amount: Number(bk.tds_amount) || 0,
      tcs_amount: Number(bk.tcs_amount) || 0,
    }),
  });
  return { posted: true, transferReversed, bookingId: bk.id };
}

module.exports = { finalizeBookingCapture, recordBookingRefund, refundSourceId };
