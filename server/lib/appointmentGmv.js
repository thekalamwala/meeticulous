/**
 * server/lib/appointmentGmv.js — a host's appointment GMV this month (pricing v2 §2).
 *
 * Feeds planService.appointmentRateFor (Pro's ₹25,000/month band). Called INSIDE
 * the per-host booking-quota lock in bookingController.createBooking — the same
 * lock lib/bookingCaps runs in — so two concurrent bookings can't both read
 * "below band". It runs before this booking's row is inserted, so the figure is
 * MTD-BEFORE this booking, which is what the rate is chosen on.
 *
 * GMV = what guests paid for the service: customer_total less the platform fee
 * and its GST (bookings carry no separate service-price column; this is the price
 * after any coupon, the same base commission is charged on). Every non-cancelled
 * booking created since the 1st of the current month, IST — a pending row counts,
 * so a peer queued behind the lock is seen.
 */
'use strict';

const { round2 } = require('./pricingEngine');
const { IST_OFFSET_MIN, istMidnightUtc } = require('../services/gst/gstPeriod');

/** ISO instant of 00:00 IST on the 1st of the IST month containing `at`. */
function istMonthStartUtc(at = Date.now()) {
  const d = new Date(at + IST_OFFSET_MIN * 60000);
  return istMidnightUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

/** Throws on a read error — the caller decides which rate a failure falls back to. */
async function appointmentGmvMtd({ supabaseAdmin, hostId, at = Date.now() }) {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('customer_total, platform_fee_amount, platform_fee_gst')
    .eq('host_id', hostId)
    .neq('status', 'cancelled')
    .gte('created_at', istMonthStartUtc(at));
  if (error) throw new Error(`appointment GMV read failed: ${error.message}`);
  return round2((data || []).reduce((sum, b) => sum + Math.max(0,
    (Number(b.customer_total) || 0) - (Number(b.platform_fee_amount) || 0) - (Number(b.platform_fee_gst) || 0)), 0));
}

module.exports = { appointmentGmvMtd, istMonthStartUtc };
