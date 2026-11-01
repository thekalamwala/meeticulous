'use strict';
/**
 * coldCallTemplates.js — the 15 follow-up templates the Cold Calling tab sends
 * after a call (6 message sets × email + WhatsApp: 4 outcomes + missed call + setup help, plus the
 * automatic WhatsApp callback reminder and the tracked-link WhatsApp). Seeded into crm_templates by
 * scripts/seedColdCallTemplates.js; editable afterwards on /admin/sales/templates.
 *
 * Email: founder voice, sent as persona `shubham` (plain layout). Lead tokens
 * ({{business_name}}) are rendered by messageService; {{callback_time}} is filled
 * by coldCallService. WhatsApp: `name` is the AiSensy API CAMPAIGN name ("Purpose - Audience", the
 * Communication-page convention), not the template name; the founder
 * must create + get Meta approval for each, then mark it approved in the tab
 * (is_active=true). Until then sends are skipped with reason "pending_aisensy".
 */
// Founder's Refer & Earn link: ?ref is stashed on landing and credited at host signup.
const SIGNUP = 'https://meeticulous.com/?ref=sndatarkar';
// WhatsApp previews must match the texts submitted to Meta/AiSensy (no ?ref there).
const WA_SIGNUP = 'https://meeticulous.com/login-as-vendor';
const PRICING = 'https://meeticulous.com/pricing';
// Founder's own Meeticulous demo page — booking it IS the product experience.
const DEMO = 'https://meeticulous.com/sndatarkar/book-a-sloth-app-online-demo-30-min-advisory-session';
// class="sig" keeps a link inline (emailService.plainBody) so each email has ONE orange button.
const CALL = (text) => `<a class="sig" href="${DEMO}">${text}</a>`;
const SIGN = '<p>Shubham<br>Founder, Meeticulous</p>';
const BIZ = [{ key: 'business_name', label: 'Business name', example: 'Smile Dental' }];
// Tracked-link param, filled per lead by coldCallService: the lead's category landing page
// (or homepage) + ?i=<4-char invite code>, e.g. https://meeticulous.com/for/dentists?i=CX12 —
// the visit logs a tap on the lead and the code rides Google signup. ({ ref: 'code' } = bare code.)
const INVITE_LINK = { key: 'invite_link', label: 'Invite link', example: 'https://meeticulous.com/for/dentists?i=CX12', ref: 'link' };

const COLD_CALL_TEMPLATES = [
  {
    channel: 'email', name: 'cold_call_link_email', label: 'Cold call · Interested → signup link (tracked set)', category: 'cold_call_link', variables: [], is_active: true,
    subject: 'Your booking page — as discussed',
    body: `<p>Hi {{business_name}} team,</p>
<p>Thanks for your time on the call just now. As promised, here's the link to set up your online booking page:</p>
<p><a href="${SIGNUP}">Create your free booking page</a></p>
<p>It takes about 3 minutes: add your services and timings, and clients can book and pay online. They get automatic reminders, so fewer no-shows.</p>
<p>Prefer to set it up together? ${CALL('Book a 30-minute call with me')} and you'll see exactly how your clients will book you.</p>
<p>If you get stuck anywhere, just reply to this email.</p>
${SIGN}`,
  },
  {
    channel: 'email', name: 'cold_call_interested_email', label: 'Cold call · Interested → signup link', category: 'cold_call_interested', variables: [], is_active: true,
    subject: 'Your booking page — as discussed',
    body: `<p>Hi {{business_name}} team,</p>
<p>Thanks for your time on the call just now. As promised, here's the link to set up your online booking page:</p>
<p><a href="${SIGNUP}">Create your free booking page</a></p>
<p>It takes about 3 minutes: add your services and timings, and clients can book and pay online. They get automatic reminders, so fewer no-shows.</p>
<p>Prefer to set it up together? ${CALL('Book a 30-minute call with me')} and you'll see exactly how your clients will book you.</p>
<p>If you get stuck anywhere, just reply to this email.</p>
${SIGN}`,
  },
  {
    channel: 'email', name: 'cold_call_details_email', label: 'Cold call · Wants details → info pack', category: 'cold_call_details', variables: [], is_active: true,
    subject: 'Meeticulous — the details you asked for',
    body: `<p>Hi {{business_name}} team,</p>
<p>Thanks for speaking with me. Here are the details you asked for:</p>
<ul>
<li><b>What it is:</b> your own online booking page. Clients pick a service and a time slot, pay online, and get automatic reminders.</li>
<li><b>Pricing:</b> free to start. Plans are here: <a class="sig" href="${PRICING}">meeticulous.com/pricing</a></li>
<li><b>Setup:</b> about 3 minutes, and I can do it with you on a call.</li>
</ul>
<p>When you're ready, you can create your page here: <a href="${SIGNUP}">meeticulous.com</a></p>
<p>Easier to see it live? ${CALL('Book a 30-minute demo with me')}. You'll book it through Meeticulous itself, so you'll see exactly what your clients experience.</p>
<p>I'll call you in a few days in case you have questions.</p>
${SIGN}`,
  },
  {
    channel: 'email', name: 'cold_call_callback_email', label: 'Cold call · Busy → callback reminder', category: 'cold_call_callback', variables: [], is_active: true,
    subject: "I'll call you on {{callback_time}}",
    body: `<p>Hi {{business_name}} team,</p>
<p>Thanks for picking up, I know it was a busy moment. As discussed, I'll call you on <b>{{callback_time}}</b>.</p>
<p>In the meantime, have a quick look: <a class="inline" href="${SIGNUP}">meeticulous.com</a>. Your clients pick a slot and pay online on their own, and get reminded automatically, so you're not answering booking calls in the middle of work.</p>
${SIGN}`,
  },
  {
    channel: 'email', name: 'cold_call_nurture_email', label: 'Cold call · Not now → soft nurture', category: 'cold_call_nurture', variables: [], is_active: true,
    subject: "Whenever you're ready",
    body: `<p>Hi {{business_name}} team,</p>
<p>Thanks for your time today. No rush at all. Whenever you want to stop managing bookings over phone and WhatsApp, your free booking page is a 3-minute setup:</p>
<p><a href="${SIGNUP}">Create your free booking page</a></p>
<p>If it's easier, ${CALL('book a call with me')} and we'll set it up together.</p>
${SIGN}`,
  },
  {
    channel: 'email', name: 'cold_call_missed_email', label: 'Cold call · No answer → missed call', category: 'cold_call_missed', variables: [], is_active: true,
    subject: 'Tried calling you today',
    body: `<p>Hi {{business_name}} team,</p>
<p>I tried calling you today but couldn't get through. I'm Shubham, founder of Meeticulous.</p>
<p>We help businesses like yours take bookings and payments online, with automatic reminders so fewer clients miss their appointments. It's free to start and setup takes about 3 minutes:</p>
<p><a href="${SIGNUP}">Create your free booking page</a></p>
<p>Rather talk first? ${CALL('Pick a time that suits you')} and I'll call you then.</p>
${SIGN}`,
  },
  {
    channel: 'email', name: 'cold_call_setup_help_email', label: 'Cold call · Setup help (interested, not signed up)', category: 'cold_call_setup_help', variables: [], is_active: true,
    subject: 'Need a hand setting up your booking page?',
    body: `<p>Hi {{business_name}} team,</p>
<p>Just checking in: were you able to set up your booking page?</p>
<p>If you got stuck anywhere, reply to this email and I'll help you finish it in a few minutes. You can pick up where you left off here:</p>
<p><a href="${SIGNUP}">Continue setting up</a></p>
<p>Prefer to do it together? ${CALL('Book a 30-minute call with me')}.</p>
${SIGN}`,
  },
  {
    channel: 'whatsapp', name: 'Cold Call Interested - Vendor', label: 'Cold call · Interested → signup link (WA)', category: 'cold_call_interested', variables: BIZ, is_active: false, subject: null,
    body: `Hi {{1}} team, Shubham from Meeticulous here. Thanks for your time today!
You can create your free booking page here:
${WA_SIGNUP}
Clients can book, pay, and get reminders automatically. Setup takes about 3 minutes.
Reply here if you want me to help you set it up.`,
  },
  {
    channel: 'whatsapp', name: 'Cold Call Details - Vendor', label: 'Cold call · Wants details → info pack (WA)', category: 'cold_call_details', variables: BIZ, is_active: false, subject: null,
    body: `Hi {{1}} team, Shubham from Meeticulous here. As discussed, here’s the quick overview:
• Online booking page
• Online payments
• Automatic reminders
• Less admin work
Free to start.
Pricing: ${PRICING}
I’ll check in with you in a few days. Feel free to message me anytime.`,
  },
  {
    channel: 'whatsapp', name: 'Cold Call Callback - Vendor', label: 'Cold call · Busy → callback reminder (WA)', category: 'cold_call_callback',
    variables: [...BIZ, { key: 'callback_time', label: 'Callback time', example: 'Tue, 7 Oct, 5:00 pm' }], is_active: false, subject: null,
    body: `Hi {{1}} team, Shubham from Meeticulous here. Thanks for taking my call!
As discussed, I’ll call you on {{2}}.
Talk soon!`,
  },
  {
    channel: 'whatsapp', name: 'Cold Call Nurture - Vendor', label: 'Cold call · Not now → soft nurture (WA)', category: 'cold_call_nurture', variables: BIZ, is_active: false, subject: null,
    body: `Hi {{1}} team, Shubham from Meeticulous here. Thanks for your time today.
Whenever you're ready, you can create your free booking page here:
${WA_SIGNUP}
It takes about 3 minutes, and I’m happy to help you set it up.
Just reply here whenever you’re ready.`,
  },
  {
    channel: 'whatsapp', name: 'Cold Call Missed - Vendor', label: 'Cold call · No answer → missed call (WA)', category: 'cold_call_missed', variables: BIZ, is_active: false, subject: null,
    body: `Hi {{1}} team, Shubham from Meeticulous here. I tried calling you today but couldn't reach you.
We help businesses like yours take bookings and payments online, with automatic reminders. It's free to start and setup takes about 3 minutes.
Have a look: ${WA_SIGNUP}
Reply here with a good time and I'll call you back.`,
  },
  {
    channel: 'whatsapp', name: 'Cold Call Setup Help - Vendor', label: 'Cold call · Setup help (WA)', category: 'cold_call_setup_help', variables: BIZ, is_active: false, subject: null,
    body: `Hi {{1}} team, Shubham from Meeticulous here. Just checking in: were you able to set up your booking page?
If you got stuck anywhere, reply here and I'll help you finish it in a few minutes.
You can continue here: ${WA_SIGNUP}`,
  },
  {
    // The one tracked message: its link opens the lead's category page with ?i=<code>, so a tap
    // shows up on that lead (🔥). WhatsApp only — email clicks are tracked by Resend.
    channel: 'whatsapp', name: 'Cold Call Link - Vendor', label: 'Cold call · Booking link, tracked (WA)', category: 'cold_call_link',
    // Text exactly as submitted to Meta.
    variables: [...BIZ, INVITE_LINK], is_active: false, subject: null,
    body: `Hi {{1}} team,

Shubham from Meeticulous here. Here's your link to create your free booking page, as we discussed:
{{2}}


Clients can book, pay, and get reminders automatically.

*Setup takes about 3 minutes.*

If you'd like help setting it up, just reply here and I'll help you get started.`,
  },
  {
    // Sent by the reminder cron ~15 min before a promised callback — no call-outcome button.
    channel: 'whatsapp', name: 'Cold Call Callback Reminder - Vendor', label: 'Cold call · Callback in 15 min (WA, automatic)', category: 'cold_call_callback_reminder',
    variables: [...BIZ, { key: 'callback_time', label: 'Callback time', example: 'Tue, 7 Oct, 5:00 pm' }], is_active: false, subject: null,
    body: `Hi {{1}} team, Shubham from Meeticulous here. A quick heads-up: I'll be calling you at {{2}}, as we discussed.
Talk soon!`,
  },
];

module.exports = { COLD_CALL_TEMPLATES };
