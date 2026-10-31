'use strict';

/**
 * kycEarningNudge.js — deferred KYC. Hosts can list and sell paid services with
 * NO upfront KYC; we only ask for it once they've actually earned. This fires the
 * nudge (host email + in-app bell) the first time a host earns from a booking and
 * still has no payout-ready KYC.
 *
 * Guarantees:
 *   • One-time per host — deduped on the in_app_notifications row it writes, so a
 *     host with 20 bookings gets ONE nudge, not 20.
 *   • Never throws to the caller. It runs inside sendBookingConfirmation, a
 *     fire-and-forget side-effect path; a nudge failure must never affect the
 *     booking confirmation.
 *   • Skips free (₹0) bookings — nothing was earned, nothing to withdraw.
 */

const { supabaseAdmin } = require('../config/supabase');
const { inAppNotify } = require('../utils/inAppNotify');
const NotificationEngine = require('./notificationEngine');

const NUDGE_TYPE = 'KYC_EARN_NUDGE';

// How much the host actually earned on this booking (paise or rupees — we only
// need "> 0"). vendor_amount is the payout snapshot; fall back to amount.
const earnedSomething = (booking) =>
  Number(booking?.vendor_amount ?? booking?.amount ?? 0) > 0;

// Display amount for the "you earned ₹X" reframe (this booking's payout).
const earnedAmount = (booking) =>
  '₹' + Number(booking?.vendor_amount ?? booking?.amount ?? 0).toLocaleString('en-IN');

/**
 * Nudge the host to complete KYC the first time they earn. Safe to call on every
 * paid booking confirmation — it self-dedupes and self-guards.
 * @param {object} a
 * @param {object} a.host     the host profile row (id, email, name).
 * @param {object} a.booking  the confirmed booking row.
 */
async function maybeSendFirstEarningKycNudge({ host, booking }) {
  try {
    if (!host?.id || !host?.email) return { sent: false, reason: 'no_host' };
    if (!earnedSomething(booking)) return { sent: false, reason: 'free_booking' };

    // Already payout-ready? Nothing to nudge.
    const { data: kyc } = await supabaseAdmin
      .from('kyc_submissions')
      .select('status, razorpay_account_id')
      .eq('user_id', host.id)
      .maybeSingle();
    if (kyc?.razorpay_account_id || kyc?.status === 'approved') {
      return { sent: false, reason: 'payout_ready' };
    }

    // Dedup: the in-app row we write below is also the "already nudged" marker.
    const { data: existing } = await supabaseAdmin
      .from('in_app_notifications')
      .select('id')
      .eq('user_id', host.id)
      .eq('type', NUDGE_TYPE)
      .limit(1)
      .maybeSingle();
    if (existing) return { sent: false, reason: 'already_nudged' };

    const base = process.env.CLIENT_URL || 'https://meeticulous.com';

    inAppNotify({
      userId: host.id,
      role: 'host',
      type: NUDGE_TYPE,
      title: 'You earned money — set up payouts',
      body: 'Complete a quick verification (PAN + bank) to receive your earnings.',
      link: '/dashboard/kyc',
    });

    // Reframed as a win ("you've earned ₹X"), routed through the branded template
    // system (Tithi, Payment-Receipt theme) instead of raw inline HTML. Dedup above
    // still guarantees one send per host. NotificationEngine never throws.
    await NotificationEngine.send({
      event: NUDGE_TYPE,
      data: {
        email: host.email,
        name: host.name,
        emailUser: { name: host.name, email: host.email },
        emailData: {
          first_name: (host.name || '').split(' ')[0] || 'there',
          earned_amount: earnedAmount(booking),
          kyc_url: `${base}/dashboard/kyc`,
        },
        recipientUserId: host.id,
      },
    });

    return { sent: true };
  } catch (err) {
    console.error('kyc earn nudge (non-fatal):', err.message);
    return { sent: false, reason: 'error' };
  }
}

module.exports = { maybeSendFirstEarningKycNudge, NUDGE_TYPE };
