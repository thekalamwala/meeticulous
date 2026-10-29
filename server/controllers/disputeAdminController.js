'use strict';
/**
 * disputeAdminController.js — admin dispute queue + manual payout hold.
 * Gated in adminRoutes: list (payouts.view), resolve / reverse (payouts.release).
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const { audit } = require('../services/auditService');
const { recordDispute } = require('../services/disputeService');

const now = () => new Date().toISOString();

// GET /admin/disputes?status=open|resolved|all
const listDisputes = async (req, res) => {
  try {
    const status = ['open', 'resolved'].includes(req.query.status) ? req.query.status : 'open';
    let q = supabaseAdmin
      .from('booking_disputes')
      .select('*, bookings(id, guest_name, guest_email, host_id, scheduled_at, customer_total, vendor_amount, transfer_status, razorpay_transfer_id, services(title))')
      .order('created_at', { ascending: false });
    if (status !== 'all' && req.query.status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (e) { safeError(res, e); }
};

// POST /admin/disputes/:id/resolve  { resolution }
const resolveDispute = async (req, res) => {
  try {
    const resolution = String(req.body?.resolution || '').trim();
    if (!resolution) return res.status(400).json({ message: 'A resolution note is required.' });
    const { data, error } = await supabaseAdmin
      .from('booking_disputes')
      .update({ status: 'resolved', resolution, resolved_by: req.admin.id, resolved_at: now(), updated_at: now() })
      .eq('id', req.params.id).eq('status', 'open').select().maybeSingle();
    if (error) return safeError(res, error);
    if (!data) return res.status(409).json({ message: 'Dispute not found or already resolved.' });
    await audit(req, { action: 'dispute.resolve', resource_type: 'booking_dispute', resource_id: data.id, after: { resolution } });
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// POST /admin/bookings/:id/reverse-payout  { reason }
// Admin manually holds/claws back a host's held Route payout and opens a dispute.
const reverseBookingPayout = async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim() || 'admin reversed payout';
    const { data: booking } = await supabaseAdmin
      .from('bookings').select('*, services(title)').eq('id', req.params.id).single();
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!booking.razorpay_transfer_id) {
      return res.status(409).json({ message: 'This booking has no Route payout to reverse.' });
    }
    if (booking.transfer_status === 'reversed') {
      return res.status(409).json({ message: 'This payout is already reversed.' });
    }

    const result = await require('../services/routeAutoPayoutService')
      .reverseHeldTransfer(booking, { reason: `admin: ${reason}` });
    const dispute = await recordDispute({
      bookingId: booking.id, raisedBy: 'admin', reason,
      payoutAction: result.ok ? 'reversed' : 'none',
    });
    await audit(req, {
      action: 'payout.reverse', resource_type: 'booking', resource_id: booking.id,
      after: { reversed: !!result.ok, transfer_id: booking.razorpay_transfer_id },
    });
    if (!result.ok && !result.skipped) {
      return res.status(422).json({ message: `Reverse failed: ${result.error}`, dispute });
    }
    res.json({ ok: true, reversed: !!result.ok, dispute });
  } catch (e) { safeError(res, e); }
};

module.exports = { listDisputes, resolveDispute, reverseBookingPayout };
