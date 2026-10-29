'use strict';

/**
 * manageBookingController.js — public, token-authorized "manage this booking".
 *
 * Serves the anonymous-guest self-service gap (MF3 #516): a guest with no session
 * gets a signed manage link (confirmation screen + email) that lets them view and
 * cancel exactly ONE booking. The signed token IS the authorization — scoped to a
 * single booking id, so there is no enumeration / IDOR. Cancellation reuses the
 * shared cancelBookingRecord (one implementation, same notifications/analytics as
 * the session path). Reschedule via link is a deliberate follow-up (see #516).
 */

const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const manageBookingToken = require('../utils/manageBookingToken');
const { cancelBookingRecord } = require('./bookingController');

// Same join shape cancelBookingRecord expects (host profile + service title).
const BOOKING_SELECT =
  '*, services(title, meeting_mode), profiles!bookings_host_id_fkey(name, email, phone, username, location, map_link, google_calendar_connected)';

// The subset a manage-link holder may see — exactly what they already received in
// their confirmation, never extra host PII (no host email/phone).
const publicView = (b) => ({
  id: b.id,
  status: b.status,
  service_title: b.services?.title || null,
  host_name: b.profiles?.name || null,
  scheduled_at: b.scheduled_at,
  end_at: b.end_at || null,
  meeting_mode: b.services?.meeting_mode || null, // P3-11: lives on services, not bookings
  meeting_link: b.meeting_link || null,
  location: b.profiles?.location || null,
  map_link: b.profiles?.map_link || null,
  guest_name: b.guest_name || null,
  payment_status: b.payment_status || null,
  cancellable: b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'no_show',
});

// Resolve the single booking a token authorizes. { booking } or { error }.
const loadFromToken = async (token) => {
  const bid = manageBookingToken.verify(token);
  if (!bid) return { error: 'invalid' };
  const { data: booking } = await supabaseAdmin.from('bookings').select(BOOKING_SELECT).eq('id', bid).single();
  if (!booking) return { error: 'not_found' };
  return { booking };
};

// GET /api/manage-booking/:token — view one booking.
const getByToken = async (req, res) => {
  try {
    const { booking, error } = await loadFromToken(req.params.token);
    if (error === 'invalid') return res.status(401).json({ message: 'This link is invalid or has expired.' });
    if (error === 'not_found') return res.status(404).json({ message: 'Booking not found.' });
    res.json(publicView(booking));
  } catch (e) { safeError(res, e); }
};

// POST /api/manage-booking/:token/cancel — cancel one booking.
const cancelByToken = async (req, res) => {
  try {
    const { booking, error } = await loadFromToken(req.params.token);
    if (error === 'invalid') return res.status(401).json({ message: 'This link is invalid or has expired.' });
    if (error === 'not_found') return res.status(404).json({ message: 'Booking not found.' });
    // Same status guards as the session cancel path.
    if (booking.status === 'cancelled') return res.json(publicView(booking));
    if (booking.status === 'completed' || booking.status === 'no_show')
      return res.status(409).json({ message: "This booking is already closed and can't be cancelled." });
    // Token possession IS the auth; the acting guest has no session (actorUserId null).
    const updated = await cancelBookingRecord(booking, { cancelledBy: 'guest', actorUserId: null });
    res.json(publicView({ ...booking, ...updated }));
  } catch (e) { safeError(res, e); }
};

// POST /api/manage-booking/:token/pay-order — create (or reuse) the Razorpay
// order to finish paying for THIS one booking. Serves the abandoned-checkout
// recovery gap (audit F7): the recovery email links here, and an anonymous guest
// who left mid-payment can now complete it instead of only cancelling. Token
// possession IS the authorization (scoped to one booking id); the money logic is
// the SAME buildBookingOrder the session create-order uses, so the two can't drift.
const payByToken = async (req, res) => {
  try {
    const bid = manageBookingToken.verify(req.params.token);
    if (!bid) return res.status(401).json({ message: 'This link is invalid or has expired.' });
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*, services(price, title, duration, grace_period_minutes)')
      .eq('id', bid).single();
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    const { buildBookingOrder } = require('./paymentController');
    const r = await buildBookingOrder(booking, { billingFromRequest: req.body?.billing_details });
    return res.status(r.status).json(r.body);
  } catch (e) { safeError(res, e); }
};

module.exports = { getByToken, cancelByToken, payByToken };
