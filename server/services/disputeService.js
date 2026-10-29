/**
 * disputeService.js — record + resolve booking disputes (admin queue).
 *
 * A dispute is raised when a customer reports a problem, an admin manually holds a
 * payout, or a Razorpay dispute webhook fires. Recording is best-effort and never
 * throws to its caller (the payout reversal + adminAlert must still happen even if
 * the disputes table isn't there yet — schema fallback).
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { securityLog } = require('../utils/logger');

const isMissingTable = (err) => {
  const msg = (err?.message || err?.details || '').toLowerCase();
  return err?.code === '42P01' || /relation .* does not exist|could not find the table/.test(msg);
};

/**
 * Record a dispute on a booking. Deduplicates: if an OPEN dispute already exists
 * for the booking, it is left as-is (returns it) rather than piling up rows.
 * @param {object} a { bookingId, raisedBy: 'guest'|'admin'|'razorpay', reason, payoutAction }
 * @returns {Promise<object|null>} the dispute row, or null on schema-fallback.
 */
async function recordDispute({ bookingId, raisedBy, reason = null, payoutAction = 'none' }) {
  try {
    const { data: existing } = await supabaseAdmin
      .from('booking_disputes').select('*').eq('booking_id', bookingId).eq('status', 'open').maybeSingle();
    if (existing) return existing;

    const { data, error } = await supabaseAdmin
      .from('booking_disputes')
      .insert({ booking_id: bookingId, raised_by: raisedBy, reason, payout_action: payoutAction })
      .select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    if (isMissingTable(err)) { securityLog('dispute_schema_fallback', { bookingId }); return null; }
    securityLog('dispute_record_error', { bookingId, reason: err?.message });
    return null;
  }
}

module.exports = { recordDispute };
