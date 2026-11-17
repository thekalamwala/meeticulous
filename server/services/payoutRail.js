/**
 * The one payout rail.
 *
 * Money reaches a host by exactly ONE mechanism: a per-booking Route transfer
 * created against that booking's own payment and held until its release time
 * (routeAutoPayoutService). This module is the second TRIGGER for that same
 * mechanism — an admin releasing an approved payout request — so that a stuck
 * booking has a manual lever without a second way for money to leave.
 *
 * WHY THIS REPLACED A STANDALONE TRANSFER. The old admin path called
 * `transfers.create({ account, amount })`, a transfer from the platform balance
 * unlinked to any payment. Two mechanisms that both move money to the same host
 * is a double-pay hazard, and the codebase already knew it: settlementService
 * deliberately excludes bookings already on the auto rail from the withdrawable
 * balance, with a comment warning that counting both "would let a host withdraw
 * money they have already been paid". That exclusion is a guard around a
 * problem that does not need to exist. With one mechanism, it cannot.
 *
 * It is also the better record. A payment-linked transfer keeps an unbroken
 * chain from the guest's payment to the host's account — which is what any
 * reconciliation, and any withholding report, has to be built on. A
 * balance transfer has no payment to tie back to.
 *
 * NOTHING HERE IS A NEW PAYMENT PATH. Every Razorpay call it makes is made by
 * routeAutoPayoutService; this module only decides which bookings to drive and
 * refuses to exceed what was approved.
 */
const { supabaseAdmin } = require('../config/supabase');
const {
  createHeldTransferForBooking,
  releaseHeldTransfer,
} = require('./routeAutoPayoutService');

// Transfer states that mean the money is already gone or on its way. A booking
// in any of these is NEVER driven again — this is the double-pay guard, and it
// is the only place that judgement is made.
const ALREADY_MOVING = new Set(['processed', 'pending', 'held', 'creating']);

/**
 * Bookings that may still be paid for this host, oldest first.
 *
 * Oldest first is deliberate: it pays down the host's longest-waiting money
 * before their newest, which is both what a host expects and what keeps the
 * settlement ledger readable.
 */
async function payableBookings(hostId) {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('id, host_id, vendor_amount, payment_status, settlement_status, transfer_status, razorpay_transfer_id, razorpay_payment_id, transfer_hold_until, completed_at, created_at')
    .eq('host_id', hostId)
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`payoutRail: bookings query failed: ${error.message}`);

  return (data || []).filter((b) => {
    // Re-checked here and not left to the query alone. This is the filter that
    // decides whether money leaves, so it should not depend on one .eq() staying
    // in place through a future refactor of the select.
    if (b.payment_status !== 'paid') return false;
    if (b.settlement_status === 'cancelled' || b.settlement_status === 'not_eligible') return false;
    if (ALREADY_MOVING.has(b.transfer_status)) return false;
    return Math.max(0, Number(b.vendor_amount) || 0) > 0;
  });
}

/**
 * Drive the rail for one booking: create its held transfer if it has none, then
 * release it.
 *
 * A booking whose transfer failed or reversed earlier has a stale
 * razorpay_transfer_id; `createHeldTransferForBooking` adopts an existing
 * Razorpay transfer when it finds one, so re-driving is safe rather than
 * duplicating.
 */
async function driveBooking(booking, { actorId = null } = {}) {
  if (!booking.razorpay_transfer_id || booking.transfer_status === 'failed') {
    const created = await createHeldTransferForBooking(booking);
    if (!created.ok) return { bookingId: booking.id, ok: false, reason: created.error || created.skipped };
    booking = { ...booking, razorpay_transfer_id: created.transferId, transfer_status: created.status };
  }
  const released = await releaseHeldTransfer(booking, { createdBy: actorId });
  return released.ok
    ? { bookingId: booking.id, ok: true, amount: Math.max(0, Number(booking.vendor_amount) || 0) }
    : { bookingId: booking.id, ok: false, reason: released.error || released.skipped };
}

/**
 * Satisfy an approved payout request by driving the rail, booking by booking,
 * until the approved amount is covered.
 *
 * NEVER PAYS MORE THAN WAS APPROVED. Bookings are taken whole — a transfer
 * cannot be part-released — so it stops before a booking that would overshoot
 * rather than splitting it. The remainder stays owed and is picked up by the
 * next request or by the automatic release, which is the honest outcome: the
 * alternative is paying out more than an admin signed off.
 *
 * @returns {Promise<{ok, paid, requested, bookings, shortfall, results}>}
 */
async function releaseViaRail(payout, { actorId = null } = {}) {
  const requested = Math.max(0, Number(payout?.amount) || 0);
  if (!payout?.host_id || requested <= 0) {
    return { ok: false, paid: 0, requested, bookings: 0, shortfall: requested, results: [], error: 'invalid_payout' };
  }

  const candidates = await payableBookings(payout.host_id);
  const results = [];
  let paid = 0;

  for (const b of candidates) {
    const amount = Math.max(0, Number(b.vendor_amount) || 0);
    // Whole bookings only. Stopping short is correct; overshooting is not.
    if (paid + amount > requested) continue;

    const r = await driveBooking(b, { actorId });
    results.push(r);
    if (r.ok) paid += r.amount;
    if (paid >= requested) break;
  }

  return {
    // Success means money moved. A request that matched no payable booking is
    // not an error — it usually means the auto rail already paid it — but it is
    // not a success either, and the caller must be able to tell them apart.
    ok: paid > 0,
    paid: Math.round(paid * 100) / 100,
    requested,
    bookings: results.filter((r) => r.ok).length,
    shortfall: Math.round(Math.max(0, requested - paid) * 100) / 100,
    results,
  };
}

module.exports = { releaseViaRail, payableBookings, driveBooking, ALREADY_MOVING };
