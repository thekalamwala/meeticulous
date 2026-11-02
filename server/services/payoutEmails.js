/**
 * payoutEmails.js — host-facing payout/settlement lifecycle emails.
 *
 * One place for every "your money" email so voice + dedup stay consistent. Each
 * send CLAIMS a per-recipient flag atomically (UPDATE ... WHERE flag IS NULL
 * RETURNING) so a re-run — the reconciler fires every 15 min — never re-sends. All
 * are fire-and-forget: they never throw into the caller (a payout must not break on
 * an email), and they no-op with a schema fallback until v3.118 is applied.
 *
 * Personas (template sender_key): payout money = 'tithi'; the refund heads-up uses
 * a plainer voice. Templates live in config/emailTemplates.js; seed BOTH DBs.
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');
const NotificationEngine = require('./notificationEngine');

const BASE = process.env.CLIENT_URL || 'https://meeticulous.com';
const firstName = (name) => (String(name || '').trim().split(' ')[0] || 'there');
const rupees = (n) => `₹${(Number(n) || 0).toFixed(2)}`;
const fmtDate = (ymd) => {
  try { return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
  catch { return ymd; }
};

async function hostContact(hostId) {
  if (!hostId) return null;
  const { data } = await supabaseAdmin.from('profiles').select('name, email').eq('id', hostId).maybeSingle();
  return data && data.email ? data : null;
}

// Atomically claim a one-time flag on a row. Returns true only for the first caller.
// A missing column (migration not applied) or any error → false (skip, never spam).
async function claim(table, matchCol, matchVal, flagCol) {
  try {
    const { data, error } = await supabaseAdmin
      .from(table).update({ [flagCol]: new Date().toISOString() })
      .eq(matchCol, matchVal).is(flagCol, null).select(matchCol).maybeSingle();
    return !error && !!data;
  } catch { return false; }
}

const emit = (event, host, hostId, emailData, bookingId) =>
  NotificationEngine.send({
    event,
    data: {
      email: host.email, name: host.name,
      emailUser: { name: host.name, email: host.email },
      emailData: { first_name: firstName(host.name), ...emailData },
      recipientUserId: hostId, bookingId,
    },
  }).catch(() => { /* NotificationEngine never throws; belt-and-suspenders */ });

// "₹X is on its way to your bank" — once per booking, at payout release.
async function sendPayoutSent(booking, amount) {
  if (!booking?.id || !booking.host_id || !(Number(amount) > 0)) return;
  if (!(await claim('bookings', 'id', booking.id, 'payout_email_sent_at'))) return;
  const host = await hostContact(booking.host_id);
  if (!host) return;
  await emit('PAYOUT_SENT', host, booking.host_id,
    { payout_amount: rupees(amount), dashboard_url: `${BASE}/dashboard/payments/payouts` }, booking.id);
}

// "One more step to unlock your payouts" — once per stuck-activation episode.
async function sendVerificationNeeded(hostId) {
  if (!(await claim('kyc_submissions', 'user_id', hostId, 'activation_email_sent_at'))) return;
  const host = await hostContact(hostId);
  if (!host) return;
  await emit('PAYOUT_VERIFICATION_NEEDED', host, hostId, { dashboard_url: `${BASE}/dashboard/kyc` });
}

// "Your payout couldn't complete" — once per booking, on a transfer failure.
async function sendPayoutFailed(booking, amount) {
  if (!booking?.id || !booking.host_id) return;
  if (!(await claim('bookings', 'id', booking.id, 'payout_failed_email_sent_at'))) return;
  const host = await hostContact(booking.host_id);
  if (!host) return;
  await emit('PAYOUT_FAILED', host, booking.host_id,
    { payout_amount: rupees(amount ?? booking.vendor_amount), dashboard_url: `${BASE}/dashboard/kyc` }, booking.id);
}

// "A booking was refunded — earning reversed" — once per booking.
async function sendEarningReversed(booking) {
  if (!booking?.id || !booking.host_id) return;
  if (!(await claim('bookings', 'id', booking.id, 'reversal_email_sent_at'))) return;
  const host = await hostContact(booking.host_id);
  if (!host) return;
  await emit('EARNING_REVERSED', host, booking.host_id,
    { payout_amount: rupees(booking.vendor_amount), dashboard_url: `${BASE}/dashboard/payments/transactions` }, booking.id);
}

// "Heads up — a bank holiday may delay your payout" — once per booking.
async function sendHolidayDelay(booking, holiday, expectedYmd) {
  if (!booking?.id || !booking.host_id) return;
  if (!(await claim('bookings', 'id', booking.id, 'holiday_notice_sent_at'))) return;
  const host = await hostContact(booking.host_id);
  if (!host) return;
  await emit('PAYOUT_DELAY_HOLIDAY', host, booking.host_id, {
    payout_amount: rupees(booking.vendor_amount),
    holiday: (holiday && holiday.name) || 'a bank holiday',
    holiday_date: fmtDate(holiday && holiday.date),
    expected_date: fmtDate(expectedYmd),
    dashboard_url: `${BASE}/dashboard/payments/payouts`,
  }, booking.id);
}

module.exports = { sendPayoutSent, sendVerificationNeeded, sendPayoutFailed, sendEarningReversed, sendHolidayDelay };
