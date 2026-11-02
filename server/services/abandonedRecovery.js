'use strict';

/**
 * abandonedRecovery.js — recover abandoned paid bookings (Tithi).
 *
 * A paid-service booking is created status:'pending' / payment_status:'unpaid'
 * and holds the slot. If the guest bails at payment, the reaper
 * (expireStalePendingBookings) silently cancels it at PENDING_BOOKING_HOLD_MIN
 * (45m). Before that, this sends ONE "your slot is still held" email so a real
 * intent-to-book isn't lost in silence.
 *
 * Window: aged >= ABANDONED_RECOVERY_AFTER_MIN (25m, give the payment a chance)
 * and still within the hold (< 45m, not yet reaped). Deduped via email_logs by
 * (event, booking_id) — no migration. Never throws.
 */

const { supabaseAdmin } = require('../config/supabase');
const NotificationEngine = require('./notificationEngine');
const manageBookingToken = require('../utils/manageBookingToken');

const EVENT = 'BOOKING_ABANDONED_CUSTOMER';
const AFTER_MIN = Number(process.env.ABANDONED_RECOVERY_AFTER_MIN) || 25;
const HOLD_MIN = Number(process.env.PENDING_BOOKING_HOLD_MIN) || 45;
const BATCH = 100;

/** Already emailed for this booking? (email_logs is the record.) */
async function alreadySent(bookingId) {
  const { data } = await supabaseAdmin
    .from('email_logs').select('id')
    .eq('event_key', EVENT).eq('booking_id', bookingId)
    .limit(1).maybeSingle();
  return !!data;
}

async function processAbandonedRecovery() {
  try {
    const now = Date.now();
    const olderThan = new Date(now - AFTER_MIN * 60000).toISOString(); // created before this = aged enough
    const withinHold = new Date(now - HOLD_MIN * 60000).toISOString(); // created after this = not yet reaped

    const { data: rows, error } = await supabaseAdmin
      .from('bookings')
      .select('id, guest_email, guest_name, scheduled_at, service_id, host_id')
      .eq('status', 'pending').eq('payment_status', 'unpaid')
      .lt('created_at', olderThan).gt('created_at', withinHold)
      .limit(BATCH);
    if (error) { console.error('abandoned recovery scan:', error.message); return { sent: 0 }; }

    let sent = 0;
    for (const b of rows || []) {
      if (!b.guest_email) continue;
      if (await alreadySent(b.id)) continue;

      // Enrich: service title + host name (low volume → per-row is fine).
      const [{ data: svc }, { data: host }] = await Promise.all([
        supabaseAdmin.from('services').select('title').eq('id', b.service_id).maybeSingle(),
        supabaseAdmin.from('profiles').select('name').eq('id', b.host_id).maybeSingle(),
      ]);
      const d = new Date(b.scheduled_at);
      const tz = 'Asia/Kolkata';
      const base = process.env.CLIENT_URL || 'https://meeticulous.com';

      await NotificationEngine.send({
        event: EVENT,
        data: {
          email: b.guest_email, phone: null, name: b.guest_name,
          emailUser: { name: b.guest_name, email: b.guest_email },
          emailData: {
            first_name: (b.guest_name || '').split(' ')[0] || 'there',
            service_name: (svc && svc.title) || 'your service',
            vendor_name: (host && host.name) || 'your host',
            booking_date: d.toLocaleDateString('en-IN', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
            booking_day: d.toLocaleDateString('en-IN', { timeZone: tz, day: '2-digit' }),
            booking_month: d.toLocaleDateString('en-IN', { timeZone: tz, month: 'short' }).toUpperCase(),
            booking_year: d.toLocaleDateString('en-IN', { timeZone: tz, year: 'numeric' }),
            booking_time: d.toLocaleTimeString('en-IN', { timeZone: tz, hour: '2-digit', minute: '2-digit' }),
            resume_url: `${base}/manage-booking/${manageBookingToken.sign(b.id)}`,
          },
          bookingId: b.id,
        },
      });
      sent++;
    }
    if (sent) console.log(`Abandoned recovery: sent ${sent} email(s)`);
    return { sent };
  } catch (err) {
    console.error('abandoned recovery (non-fatal):', err.message);
    return { sent: 0 };
  }
}

module.exports = { processAbandonedRecovery, EVENT, AFTER_MIN };
