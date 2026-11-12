'use strict';

/**
 * reviewNudges.js — ask guests for a review 48h after a completed paid booking.
 *
 * Reads bookings with completed_at between 48h and 7d ago, payment_status='paid',
 * no reschedule/cancellation, and no existing review row from that guest on that
 * booking. Emits GUEST_REVIEW_NUDGE once per booking (deduped on notification_logs).
 *
 * SAFETY — double-gated:
 *   1. feature flag `review_nudges` (default OFF, seeded in v3.194),
 *   2. per-event notification_events.is_active / email_enabled (ON in v3.194).
 * Plus: quiet-hours 09–20 IST, internal/test hosts excluded via guest email
 * sanity check, one-time send per booking (dedupe key = booking id).
 *
 * Reviews land in the `reviews` table (booking_id + reviewer_id + rating).
 * A booking is considered already-reviewed if ANY review row exists for its id.
 */
const { supabaseAdmin } = require('../config/supabase');
const { isFeatureEnabled } = require('./featureFlags');
const notificationEngine = require('./notificationEngine');
const { alreadyNotified } = require('../utils/notificationDedupe');

const WINDOW_MIN_HOURS = 48;
const WINDOW_MAX_DAYS  = 7;
const BASE = () => process.env.CLIENT_URL || 'https://meeticulous.com';

function withinQuietHours(now = new Date()) {
  const istHour = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000).getHours();
  return istHour >= 9 && istHour < 20;
}

// Once per booking. notification_logs has no booking_id column, so the send
// stamps `dedupe_key: review:<id>` into payload and we match on that.
async function alreadyNudged(bookingId) {
  return alreadyNotified({ event: 'GUEST_REVIEW_NUDGE', dedupeKey: `review:${bookingId}` });
}

async function hasReview(bookingId) {
  const { data } = await supabaseAdmin
    .from('reviews')
    .select('id')
    .eq('booking_id', bookingId)
    .limit(1);
  return !!(data && data.length);
}

async function runReviewNudges() {
  if (!(await isFeatureEnabled('review_nudges'))) return { skipped: 'flag_off' };
  if (!withinQuietHours()) return { skipped: 'quiet_hours' };

  const now = Date.now();
  const minIso = new Date(now - WINDOW_MIN_HOURS * 3600 * 1000).toISOString();
  const maxIso = new Date(now - WINDOW_MAX_DAYS * 24 * 3600 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('bookings')
    .select('id, host_id, guest_name, guest_email, completed_at, payment_status, status')
    .eq('payment_status', 'paid')
    .eq('status', 'completed')
    .not('guest_email', 'is', null)
    .lt('completed_at', minIso)
    .gt('completed_at', maxIso);
  if (error || !rows) return { skipped: 'query_failed' };

  let processed = 0, skipped = 0;
  for (const b of rows) {
    if (!b.guest_email) { skipped++; continue; }
    if (await hasReview(b.id)) { skipped++; continue; }
    if (await alreadyNudged(b.id)) { skipped++; continue; }

    // Pull the host name for the subject/body.
    const { data: host } = await supabaseAdmin
      .from('profiles').select('name, username').eq('id', b.host_id).maybeSingle();
    if (!host) { skipped++; continue; }

    const firstName = (b.guest_name || '').trim().split(/\s+/)[0] || 'there';
    const reviewUrl = `${BASE()}/${host.username || ''}?review=${b.id}`;

    await notificationEngine.send({
      event: 'GUEST_REVIEW_NUDGE',
      data: {
        email: b.guest_email,
        // bookings has no guest phone column today; WA will no-op on nulls.
        // When guest phone is wired in (future), the engine picks it up and
        // Review Request - Guest fires with the same param shape below.
        name: firstName,
        audience: 'all',
        // AiSensy "Review Request - Guest": {{1}} = guest first name,
        // {{2}} = host (vendor) name, {{3}} = review deep link.
        templateParams: [firstName, host.name || 'your host', reviewUrl],
        emailData: {
          first_name: firstName,
          vendor_name: host.name || 'your host',
          review_url: reviewUrl,
        },
        recipientBookingId: b.id,
        dedupeKey: `review:${b.id}`,
        metadata: { booking_id: b.id },
      },
    });
    processed++;
  }
  return { processed, skipped };
}

module.exports = { runReviewNudges };
