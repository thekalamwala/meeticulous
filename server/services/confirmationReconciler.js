/**
 * confirmationReconciler.js — safety net for LOST booking confirmations (P1-02).
 *
 * After a booking's payment is captured, sendBookingConfirmation() fires the
 * calendar event + Meet link + BOOKING_CONFIRMED messages as a best-effort
 * BACKGROUND task. If that task is lost (process restart between the capture and
 * the send, or an early throw), nothing re-drives it: the webhook and the
 * bookingPaymentReconciler both skip the row because it is already `paid`, and the
 * completion cron only nudges it much later. The guest has paid but never receives
 * a calendar invite, Meet link, or confirmation.
 *
 * This scans PAID + CONFIRMED bookings whose confirmation_sent_at is still NULL
 * (and whose capture is old enough that the primary background send should have
 * finished or truly failed) and re-fires the confirmation. sendBookingConfirmation
 * is idempotent (guards on confirmation_sent_at, self-guards the calendar step),
 * and it stamps confirmation_sent_at on success so a healed row is not re-picked.
 *
 * Free (₹0) bookings send their confirmation inline in createBooking and carry a
 * NULL paid_at, so the `paid_at` range filter naturally excludes them — only
 * capture-path bookings (which set paid_at) are candidates.
 *
 * Single-flight: wired under runLocked('confirmation-reconcile') in server.js, so
 * at most one instance runs it, and the in-process re-entrancy guard stops a tick
 * overlapping itself — no double-send. Schema fallback: if confirmation_sent_at
 * doesn't exist yet (pre-v3.102), it no-ops until the migration is applied.
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { sendBookingConfirmation } = require('./bookingConfirmation');

// Wait this long after capture before re-driving — long enough that the inline
// background confirmation has finished or genuinely failed.
const GRACE_MIN = Number(process.env.CONFIRMATION_RECONCILE_GRACE_MIN || 10);
// Don't chase ancient rows; also bounds the blast radius on first run.
const LOOKBACK_HOURS = Number(process.env.CONFIRMATION_RECONCILE_LOOKBACK_HOURS || 48);

let _warnedSchema = false;

async function reconcile() {
  const now = Date.now();
  const upper = new Date(now - GRACE_MIN * 60 * 1000).toISOString();
  const lower = new Date(now - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  const { data: stuck, error } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .eq('payment_status', 'paid')
    .eq('status', 'confirmed')
    .is('confirmation_sent_at', null)
    .lt('paid_at', upper)   // excludes free bookings (paid_at NULL) and in-flight captures
    .gt('paid_at', lower)
    .limit(50);

  if (error) {
    if (/Could not find the|column.*does not exist/i.test(error.message || '')) {
      if (!_warnedSchema) {
        _warnedSchema = true;
        console.warn('[confirmationReconcile] confirmation_sent_at column missing; apply migrations/v3.102_booking_confirmation_sent_at.sql to enable. Skipping.');
      }
      return { checked: 0, healed: 0 };
    }
    console.error('confirmation reconcile query error:', error.message);
    return { checked: 0, healed: 0 };
  }

  let checked = 0;
  let healed = 0;
  for (const b of stuck || []) {
    checked++;
    try {
      await sendBookingConfirmation({ bookingId: b.id, invoiceRef: null });
      healed++;
    } catch (e) {
      console.error('confirmation reconcile error', b.id, e.message);
    }
  }
  return { checked, healed };
}

module.exports = { reconcile };
