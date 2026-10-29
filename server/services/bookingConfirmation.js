'use strict';

/**
 * bookingConfirmation.js — the post-payment "booking confirmed" side-effects,
 * in ONE place so every capture path fires them.
 *
 * Historically these lived only inside the client-facing verifyPayment endpoint:
 * create the Google Calendar event (+ Meet link), send BOOKING_CONFIRMED to guest
 * and host (email + WhatsApp), and fire any catch-up reminder. A booking whose
 * payment was captured by the Razorpay WEBHOOK or the hourly reconciler instead
 * (redirect/UPI flows, or the client tab dying before /verify) got flipped to paid
 * but received NONE of this — no calendar, no Meet link, no confirmation message —
 * only the completion cron notified it later. finalizeBookingCapture centralised
 * the money+ledger logic for exactly this reason; this does the same for
 * confirmation. Every capture caller now calls sendBookingConfirmation after it
 * wins the unpaid→paid transition, so it runs exactly once.
 *
 * Idempotency: the caller only invokes this when IT won the transition (the
 * finalizeBookingCapture winner), so no cross-path double-send. The calendar step
 * additionally self-guards on an already-present meeting_link.
 */

const { supabaseAdmin } = require('../config/supabase');
const NotificationEngine = require('./notificationEngine');
const { createCalendarEvent } = require('../config/google');
const { decrypt: decryptToken } = require('../utils/cryptoTokens');
const profileSecrets = require('../utils/profileSecrets');
const manageBookingToken = require('../utils/manageBookingToken');
const { hostOf } = require('../utils/hostOf');
const { inAppNotify } = require('../utils/inAppNotify');

/**
 * @param {object} a
 * @param {string} a.bookingId
 * @param {{id:string, token:string}} [a.invoiceRef]  tokenised GST invoice link for the
 *        confirmation email; falls back to the dashboard when absent (e.g. reconciler).
 */
async function sendBookingConfirmation({ bookingId, invoiceRef = null }) {
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('*, services(*), profiles!bookings_host_id_fkey(*)')
    .eq('id', bookingId)
    .single();
  if (!booking) return;
  // Idempotency (P1-02): skip if a prior run already completed the confirmation.
  // Tolerates a pre-v3.102 schema (confirmation_sent_at undefined → falsy → runs).
  if (booking.confirmation_sent_at) return;

  const svc  = booking.services || {};
  const host = hostOf(booking);
  const isOnline = svc.meeting_mode !== 'offline';

  const { data: avail } = await supabaseAdmin
    .from('availability').select('timezone').eq('host_id', booking.host_id).maybeSingle();
  const tz = avail?.timezone || 'Asia/Kolkata';

  // 1) Google Calendar event (+ Meet link) for online services — non-fatal, and
  //    skipped if a link already exists (idempotent across a retry).
  let meetingLink = booking.meeting_link || '';
  if (isOnline && !meetingLink) {
    try {
      await profileSecrets.attachGoogleTokens(host);
      if (host?.google_calendar_connected && host?.google_refresh_token) {
        const startTime = new Date(booking.scheduled_at);
        const endTime = new Date(startTime.getTime() + (svc.duration || 30) * 60000);
        const event = await createCalendarEvent(
          decryptToken(host.google_access_token),
          decryptToken(host.google_refresh_token),
          {
            title: `${svc.title || 'Service'} — ${booking.guest_name || 'Guest'}`,
            description: `Booked via Book A Sloth\n${booking.notes || ''}`,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            timezone: tz,
            attendees: [
              // Organiser (host) owns this calendar — mark accepted so the event
              // shows the host as "Yes", not "awaiting". Google no longer auto-accepts
              // the organiser implicitly when they appear in attendees.
              { email: host.email, responseStatus: 'accepted' },
              ...(booking.guest_email ? [{ email: booking.guest_email }] : []),
            ],
          },
        );
        meetingLink = event.meetLink || '';
        if (meetingLink) {
          let relink = await supabaseAdmin
            .from('bookings')
            .update({ meeting_link: meetingLink, google_event_id: event.eventId || null })
            .eq('id', bookingId).select().single();
          if (relink.error && /Could not find the|column.*does not exist/i.test(relink.error.message)) {
            await supabaseAdmin.from('bookings').update({ meeting_link: meetingLink }).eq('id', bookingId);
          }
        }
      }
    } catch (calErr) {
      console.error('Booking confirmation calendar event error (non-fatal):', calErr.message);
    }
  }

  // 2) BOOKING_CONFIRMED to guest + host (email + WhatsApp).
  const d = new Date(booking.scheduled_at);
  const when = d.toLocaleString('en-IN', { timeZone: tz });
  const emailData = {
    service_name: svc.title || 'Service',
    vendor_name: host.name || 'Host',
    vendor_phone: host.phone || '',
    user_name: booking.guest_name || 'Customer',
    booking_id: booking.id,
    manage_url: `${process.env.CLIENT_URL || 'https://bookasloth.com'}/manage-booking/${manageBookingToken.sign(booking.id)}`,
    location: isOnline
      ? (meetingLink ? 'Online (link in your dashboard)' : 'Online')
      : (host.location || 'In person'),
    ...(!isOnline && host.map_link
      ? { action_link: host.map_link, action_label: 'Get directions' }
      : {}),
    booking_date: d.toLocaleDateString('en-IN', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    booking_time: d.toLocaleTimeString('en-IN', { timeZone: tz, hour: '2-digit', minute: '2-digit' }),
    booking_day: d.toLocaleDateString('en-IN', { timeZone: tz, day: '2-digit' }),
    booking_month: d.toLocaleDateString('en-IN', { timeZone: tz, month: 'short' }).toUpperCase(),
    booking_year: d.toLocaleDateString('en-IN', { timeZone: tz, year: 'numeric' }),
    invoice_url: (invoiceRef && process.env.API_URL)
      ? `${process.env.API_URL.replace(/\/$/, '')}/api/invoices/${invoiceRef.id}?token=${encodeURIComponent(invoiceRef.token)}`
      : `${process.env.CLIENT_URL || 'https://bookasloth.com'}/user/my-bookings`,
  };
  // AiSensy "Booking Confirmed" templates take exactly 4 body variables (no link):
  //   Customer: {{1}} guest, {{2}} service, {{3}} host, {{4}} date/time
  //   Vendor:   {{1}} host,  {{2}} guest,   {{3}} service, {{4}} date/time
  // A 5th (meeting-link) param was removed from the AiSensy templates ~Jul 2026;
  // still sending it made every confirmation fail with "Template params does not
  // match the campaign". The Meet link still reaches people via email + the
  // calendar invite. Keep this array length in sync with the AiSensy template.
  const ctx = {
    customer: [booking.guest_name || 'Customer', svc.title || 'Service', host.name || 'Host', when],
    vendor:   [host.name || 'Host', booking.guest_name || 'Customer', svc.title || 'Service', when],
  };
  await NotificationEngine.send({
    event: 'BOOKING_CONFIRMED_CUSTOMER',
    data: {
      email: booking.guest_email, phone: booking.guest_phone, name: booking.guest_name,
      templateParams: ctx.customer,
      emailData, emailUser: { name: booking.guest_name, email: booking.guest_email },
      recipientUserId: booking.guest_id, bookingId: booking.id,
    },
  });
  await NotificationEngine.send({
    event: 'BOOKING_CONFIRMED_VENDOR',
    data: {
      email: host.email, phone: host.phone, name: host.name,
      templateParams: ctx.vendor,
      emailData, emailUser: { name: host.name, email: host.email, username: host.username },
      recipientUserId: booking.host_id, bookingId: booking.id,
    },
  });

  // 2a) Deferred KYC: first time this host actually earns and still has no
  //     payout-ready KYC, nudge them (email + bell) to verify. Self-dedupes to
  //     once per host and skips ₹0 bookings; never throws.
  await require('./kycEarningNudge').maybeSendFirstEarningKycNudge({ host, booking });

  // 2a-ii) Activation funnel: emit host_first_booking (host-keyed) on the host's
  //        first paid booking. Never throws.
  const firstBooking = await require('./hostActivation').maybeTrackFirstBooking({ host, booking });

  // 2a-ii-b) Celebrate that first paid booking — the host's aha moment (email now;
  //          WhatsApp later). Reuses the existing MILESTONE_FIRST_BOOKING template
  //          (Durga). NotificationEngine never throws, so a celebration failure
  //          can't affect the confirmation.
  if (firstBooking && firstBooking.tracked) {
    await NotificationEngine.send({
      event: 'MILESTONE_FIRST_BOOKING',
      data: {
        email: host.email, phone: host.phone, name: host.name,
        emailUser: { name: host.name, email: host.email, username: host.username },
        emailData: { ...emailData, first_name: (host.name || '').split(' ')[0] || 'there' },
        recipientUserId: booking.host_id, bookingId: booking.id,
      },
    });
  }

  // 2a-iv) Free host crossing the commission threshold → email upgrade nudge
  //        (Sujata). Free-plan only, deduped, never throws.
  await require('./upgradeNudge').maybeSendUpgradeNudge({ host, booking });

  // 2a-iii) Real-time CRM: a paid booking is the HOST's Won signal — resolve the
  //         host's lead now (a paid host → Won; an unpaid host stays in Presale per
  //         O-1). Guests are NOT captured as leads (excluded from the host pipeline).
  await require('./crm/leadService').recomputeFromAccount(booking.host_id);

  // 2b) In-app confirmation for signed-in guests — mirrors the free-booking path
  //     so paid guests (the higher-value ones) aren't the only bookings missing an
  //     in-app note. The in-app feed has no provider dependency (P2-10).
  if (booking.guest_id) {
    inAppNotify({
      userId: booking.guest_id, role: 'guest', type: 'BOOKING_CONFIRMED',
      title: 'Booking confirmed',
      body: `${svc.title || 'Your booking'} with ${host.name || 'your host'} is confirmed`,
      link: '/user/my-bookings', data: { bookingId: booking.id },
      dedupeKey: `booking_confirmed:${booking.id}`,
    });
  }

  // 2b-ii) In-app note for the HOST — a new booking is their headline moment, but
  //        the bell only ever got the guest's copy above. Email/WhatsApp already
  //        fire (BOOKING_CONFIRMED_VENDOR); this closes the in-app gap. dedupeKey
  //        stops the confirmation reconciler's re-fire from stacking a second bell.
  inAppNotify({
    userId: booking.host_id, role: 'host', type: 'BOOKING_NEW',
    title: 'New booking',
    body: `${booking.guest_name || 'A guest'} booked ${svc.title || 'your service'} for ${when}`,
    link: '/dashboard/bookings', data: { bookingId: booking.id },
    dedupeKey: `booking_new:${booking.id}`,
  });

  // 3) Last-minute booking (starts sooner than a reminder lead-time): fire the
  //    catch-up reminder the cron band would miss. Lazy require avoids a cycle.
  const { fireDueReminders } = require('../controllers/bookingController');
  await fireDueReminders(booking, host);

  // Mark the confirmation side-effects done so the confirmation reconciler
  // (services/confirmationReconciler.js) won't re-fire them. Schema fallback: a
  // pre-v3.102 DB has no such column — skip the stamp (the reconciler no-ops there
  // too, so nothing loops). A rare stamp failure at worst causes ONE duplicate
  // confirmation on a later reconcile — strictly better than the paid-but-never-
  // confirmed miss this closes.
  try {
    const stamp = await supabaseAdmin
      .from('bookings')
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq('id', bookingId);
    if (stamp.error && !/Could not find the|column.*does not exist/i.test(stamp.error.message || '')) {
      console.error('confirmation stamp error (non-fatal):', stamp.error.message);
    }
  } catch (e) {
    console.error('confirmation stamp threw (non-fatal):', e.message);
  }
}

module.exports = { sendBookingConfirmation };
