'use strict';

/**
 * hostActivation.js — the tail of the host activation funnel:
 *   user_registered → service_published → profile_link_shared → host_first_booking
 *
 * Booking events (booking_paid) are keyed to the GUEST who paid, so they can't
 * drive a HOST-activation funnel. This emits host_first_booking keyed to the HOST
 * the first time they receive a real (paid, non-free) booking, so all four funnel
 * steps land on the same person in PostHog.
 *
 * Fired from bookingConfirmation (the exactly-once paid-capture point). Never
 * throws — analytics must not affect a booking.
 */

const { supabaseAdmin } = require('../config/supabase');
const { trackServer } = require('../utils/trackServer');

const earned = (booking) => Number(booking?.vendor_amount ?? booking?.amount ?? 0) > 0;

/**
 * Emit host_first_booking the first time this host earns from a booking.
 * @param {object} a
 * @param {object} a.host     host profile row ({ id }).
 * @param {object} a.booking  the just-confirmed paid booking.
 */
async function maybeTrackFirstBooking({ host, booking }) {
  try {
    if (!host?.id || !earned(booking)) return { tracked: false };

    // This runs after the booking is flipped to paid, so it's counted here:
    // count === 1 ⇒ this is the host's first paid booking. (A rare double-first
    // race just over-counts one activation event — acceptable for analytics.)
    const { count } = await supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('host_id', host.id)
      .eq('payment_status', 'paid');

    if (count === 1) {
      const amount = Number(booking.vendor_amount ?? booking.amount ?? 0);
      trackServer(host.id, 'host_first_booking', {
        booking_id: booking.id,
        amount,
      }, { value: amount, currency: 'INR' }); // → GA4 + Meta custom activation event (external_id match)
      return { tracked: true };
    }
    return { tracked: false };
  } catch (err) {
    console.error('host_first_booking track (non-fatal):', err.message);
    return { tracked: false };
  }
}

module.exports = { maybeTrackFirstBooking };
