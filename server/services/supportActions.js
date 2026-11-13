'use strict';

/**
 * supportActions — the safe self-service things Bolt can DO (not just answer) in the
 * AUTHENTICATED support chat, where we know who the customer is. All three are
 * email-only, idempotent, and scoped to the caller's OWN booking — no money moves,
 * nothing mutates a booking. Anything account-specific is looked up server-side; the
 * bot never trusts a client-supplied id.
 *
 *   • resend_confirmation → re-send the full booking confirmation email
 *   • resend_invoice      → email the GST invoice link for the booking
 *   • resend_calendar     → email an .ics calendar invite (ours, not the GCal event)
 */

const { supabaseAdmin } = require('../config/supabase');
const sendEmail = require('../utils/sendEmail');
const { buildIcs } = require('../utils/icsInvite');
const { sendBookingConfirmation } = require('./bookingConfirmation');
const manageBookingToken = require('../utils/manageBookingToken');
const { refundTierPct } = require('./refundService'); // ≥24h→1, ≥6h→0.5, else 0 (/refund §1)

const ACTIONS = [
  ['resend_confirmation', /\b(resend|re-?send|send again|didn.?t (get|receive)|missing).*(confirm|booking (details|email))|confirmation.*(resend|again|didn.?t)/i],
  ['resend_invoice', /\b(resend|re-?send|send|need|get|download).*(invoice|receipt|bill|gst)/i],
  ['resend_calendar', /\b(calendar|\.ics|add to (my )?calendar|invite|reminder).*(resend|send|again|add)|(resend|send).*(calendar|invite|\.ics)/i],
];

// Cheap intent match. Returns the action key or null. Order matters: confirmation
// before calendar so "resend my booking" doesn't get grabbed by the calendar regex.
function detectAction(text) {
  const t = String(text || '');
  for (const [key, re] of ACTIONS) if (re.test(t)) return key;
  return null;
}

const fmtDate = (s) => { try { return new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

// The caller's most-recent booking (own data only). Host by host_id, guest by phone.
async function latestBooking({ userId, guestPhone, isHost }) {
  let q = supabaseAdmin
    .from('bookings')
    .select('id, service_id, scheduled_at, end_at, status, payment_status, guest_name, guest_email, host_id')
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .limit(1);
  q = isHost ? q.eq('host_id', userId || '') : q.eq('guest_phone', guestPhone || '');
  const { data, error } = await q;
  if (error || !data || !data[0]) return null;
  const b = data[0];
  const { data: svc } = await supabaseAdmin.from('services').select('title').eq('id', b.service_id).maybeSingle();
  b.service_title = svc?.title || 'your booking';
  return b;
}

// The refund the guest would get if they cancel NOW, as plain words (never an exact
// amount — the manage page shows that). Tiered on the service price per /refund §1.
function refundTierText(scheduledAt) {
  if (!scheduledAt) return 'a refund per our cancellation policy';
  const hrs = (new Date(scheduledAt).getTime() - Date.now()) / 3600000;
  const pct = refundTierPct(hrs);
  return pct === 1 ? 'a full refund of the service price'
    : pct === 0.5 ? 'a 50% refund of the service price'
      : 'no refund (it’s under 6 hours to the session)';
}

// Safe-split cancel: the data for the SECURE self-service cancel link, no side effect.
// The bot never cancels or refunds — it hands the user this link, and they cancel on the
// real page (which shows + performs the exact refund). Own booking only, server-resolved.
async function cancelLinkInfo(identity) {
  if (!identity || !(identity.userId || identity.guestPhone)) return { ok: false, message: "I can only do that on a signed-in account." };
  const b = await latestBooking(identity);
  if (!b) return { ok: false, message: "I don't see a booking on your account to cancel." };
  if (b.status === 'cancelled' || b.status === 'completed' || b.status === 'no_show') {
    return { ok: false, message: `Your most recent booking (${b.service_title}) is already ${b.status}, so there's nothing to cancel there.` };
  }
  const when = fmtDate(b.scheduled_at);
  const base = (process.env.CLIENT_URL || 'https://meeticulous.com').replace(/\/$/, '');
  return {
    ok: true,
    booking: b,
    label: `${b.service_title}${when ? ` on ${when}` : ''}`,
    email: b.guest_email || null,
    tierText: refundTierText(b.scheduled_at),
    link: `${base}/manage-booking/${manageBookingToken.sign(b.id)}`,
  };
}

async function runAction(action, identity) {
  if (action === 'send_cancel_link') {
    const info = await cancelLinkInfo(identity);
    if (!info.ok) return { ok: false, message: info.message };
    if (!info.email) return { ok: false, message: `I found ${info.label}, but there's no email on it to send the secure link to. Want me to bring in a teammate?` };
    await sendEmail({
      to: info.email,
      subject: `Manage your booking — ${info.booking.service_title}`,
      html: `<p>Hi ${info.booking.guest_name || 'there'},</p>
             <p>Here's your secure link to manage <b>${info.label}</b> — you can cancel in one tap, and you'll see the exact refund before you confirm:</p>
             <p><a href="${info.link}" style="color:#960D32;font-weight:600">Manage / cancel your booking →</a></p>
             <p style="color:#888;font-size:12px">Cancelling now would get you ${info.tierText}. Meeticulous</p>`,
    });
    return { ok: true, message: `Done — I've emailed your secure cancel link to ${info.email}. Open it to cancel in one tap; you'll see the exact refund first (cancelling now would get you ${info.tierText}).` };
  }

  const b = await latestBooking(identity);
  if (!b) return { ok: false, message: "I couldn't find a booking on your account to work with. If you booked with a different number or email, let me know and I'll pull in a teammate." };

  const when = fmtDate(b.scheduled_at);
  const label = `${b.service_title}${when ? ` on ${when}` : ''}`;

  if (action === 'resend_confirmation') {
    await sendBookingConfirmation({ bookingId: b.id });
    return { ok: true, message: `Done — I've re-sent the booking confirmation for ${label}. Check your inbox (and spam, just in case).` };
  }

  if (action === 'resend_invoice') {
    if (!b.guest_email) return { ok: false, message: `I found ${label}, but there's no email on it to send the invoice to. A teammate can help — want me to connect you?` };
    const { data: inv } = await supabaseAdmin
      .from('invoices').select('id, access_token, invoice_number')
      .eq('source_type', 'booking').eq('source_id', b.id).maybeSingle();
    if (!inv) return { ok: false, message: `I found ${label}, but its invoice isn't generated yet. If the booking is paid, a teammate can sort this — want a human?` };
    const base = (process.env.API_URL || 'https://meeticulous-api.onrender.com').replace(/\/$/, '');
    const url = `${base}/api/invoices/${inv.id}?token=${encodeURIComponent(inv.access_token)}`;
    await sendEmail({
      to: b.guest_email,
      subject: `Your invoice ${inv.invoice_number || ''} — Meeticulous`.trim(),
      html: `<p>Hi ${b.guest_name || 'there'},</p><p>Here's your invoice for <b>${label}</b>:</p>
             <p><a href="${url}" style="color:#960D32;font-weight:600">View / download your invoice →</a></p>
             <p style="color:#888;font-size:12px">Meeticulous</p>`,
    });
    return { ok: true, message: `Sent — your invoice for ${label} is on its way to ${b.guest_email}.` };
  }

  if (action === 'resend_calendar') {
    if (!b.guest_email) return { ok: false, message: `I found ${label}, but there's no email on it to send the calendar invite to. Want me to bring in a teammate?` };
    const ics = buildIcs({
      id: b.id, title: b.service_title, start: b.scheduled_at, end: b.end_at,
      description: `Your Meeticulous booking: ${b.service_title}.`, location: 'Online',
    });
    if (!ics) return { ok: false, message: `I found ${label}, but its time isn't set yet, so I can't build a calendar invite. A teammate can help — want a human?` };
    await sendEmail({
      to: b.guest_email,
      subject: `Calendar invite — ${b.service_title}`,
      html: `<p>Hi ${b.guest_name || 'there'},</p><p>Add <b>${label}</b> to your calendar — the invite is attached (open it in Apple/Google/Outlook Calendar).</p><p style="color:#888;font-size:12px">Meeticulous</p>`,
      attachments: [{ filename: 'booking.ics', content: Buffer.from(ics, 'utf8').toString('base64') }],
    });
    return { ok: true, message: `Sent — a calendar invite for ${label} is in your inbox (${b.guest_email}). Open the attachment to add it.` };
  }

  return { ok: false, message: null };
}

module.exports = { detectAction, runAction, latestBooking, cancelLinkInfo, refundTierText };
