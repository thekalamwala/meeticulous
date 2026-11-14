/**
 * emailTemplates.js — seed definitions for every Communication Engine template.
 *
 * html_content is the BODY ONLY. Header (constant logo + accent category pill)
 * and footer (company info, links, address) are added by emailLayout.js. No
 * template carries its own layout chrome.
 *
 * Bodies compose hero blocks from emailComponents (otpBox, bookingCard, infoCard,
 * countdown, banner, celebration, amountRow). Since the 2026-11 redesign every
 * category resolves to the same crimson theme and the header pill is the one
 * status label. The crimson CTA is added by the layout.
 *
 * Placeholders use {{snake_case}} and are resolved at send time.
 * See placeholderResolver.js for globals always available.
 *
 * email_category: short label rendered in the header pill (right side) + the key
 *                 the theme/glyph is resolved from.
 * email_reason:   legal copy rendered at the bottom of the footer.
 */

const { themeForCategory } = require('../services/email/emailThemes');
const C = require('../services/email/emailComponents');

// Prose helpers — keep seed readable and markup consistent. One crimson palette
// (2026-11 redesign); the header pill is the only status label, so bodies carry
// no eyebrow/chip repeating it.
const lead    = (t) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#4A3A3E;font-family:'Poppins','Plus Jakarta Sans',Arial,sans-serif;">${t}</p>`;
const h       = (t) => `<h1 style="margin:0 0 12px;font-size:26px;font-weight:700;line-height:1.25;color:#2B1218;font-family:'Poppins','Plus Jakarta Sans',Arial,sans-serif;">${t}</h1>`;
const note    = (t) => `<p style="margin:16px 0 0;font-size:13px;color:#7D6B70;font-family:'Poppins','Plus Jakarta Sans',Arial,sans-serif;">${t}</p>`;
const ref     = (t) => `<p style="margin:0 0 4px;font-size:12px;letter-spacing:.02em;color:#7D6B70;font-family:'Poppins','Plus Jakarta Sans',Arial,sans-serif;">${t}</p>`;
// Numbered setup step (host welcome checklist).
const step    = (n, title, sub) => `<tr><td style="width:34px;vertical-align:top;padding:10px 0;"><div style="width:26px;height:26px;line-height:26px;border-radius:999px;background:#FBE3E8;color:#960D32;font-weight:700;font-size:13px;text-align:center;font-family:'Poppins','Plus Jakarta Sans',Arial,sans-serif;">${n}</div></td><td style="padding:10px 0;border-bottom:1px solid #F1DCE1;font-family:'Poppins','Plus Jakarta Sans',Arial,sans-serif;"><div style="font-size:14px;font-weight:600;color:#2B1218;">${title}</div><div style="font-size:13px;color:#7D6B70;">${sub}</div></td></tr>`;
const steps   = (...rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">${rows.join('')}</table>`;
// Outlined pill link — a secondary action (e.g. add-to-calendar) that sits below
// the one maroon CTA the layout owns. ponytail: inline, both booking-confirmed
// bodies use it; promote to emailComponents if a third caller appears.
const pillLink = (url, label) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 4px;"><tr><td style="border:1px solid #F1DCE1;border-radius:999px;background:#FBF4F5;"><a href="${url}" style="display:inline-block;padding:10px 18px;font-size:14px;font-weight:600;color:#960D32;text-decoration:none;font-family:'Poppins','Plus Jakarta Sans',Arial,sans-serif;">${label}</a></td></tr></table>`;

const TEMPLATES = [

  // ── Authentication ──────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Security Check'); return {
    event_key: 'BOOKING_OTP', sender_key: 'verify', audience: 'all', category: 'Authentication',
    name: 'OTP Verification', subject: 'Your verification code is {{otp}}',
    preview_text: 'Use {{otp}} to verify — expires in 10 minutes.',
    email_category: 'Security Check',
    email_reason: 'You are receiving this email because a sign-in verification was requested for your account.',
    html_content:
      h('Your verification code') +
      lead('Enter this code to verify your identity. It expires in <strong>10 minutes</strong>.') +
      C.otpBox(t, '{{otp}}') +
      note("If you didn't request this, you can safely ignore this email."),
    cta_label: '', cta_url: '',
  }; })(),

  (() => { const t = themeForCategory('Security Check'); return {
    event_key: 'AUTH_EMAIL_VERIFICATION', sender_key: 'verify', audience: 'all', category: 'Authentication',
    name: 'Email Verification', subject: 'Verify your email address',
    preview_text: 'Confirm your email to finish setting up your account.',
    email_category: 'Security Check',
    email_reason: 'You are receiving this email because a verification request was made for your account.',
    html_content:
      h('Confirm your email, {{first_name}}') +
      lead('Tap the button below to verify your email address and activate your Meeticulous account.') +
      note('This link expires in 24 hours.'),
    cta_label: 'Verify email', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Security Check'); return {
    event_key: 'PASSWORD_RESET', sender_key: 'verify', audience: 'all', category: 'Authentication',
    name: 'Password Reset', subject: 'Your Meeticulous password reset code',
    preview_text: 'Use {{otp}} to reset your password — expires in 10 minutes.',
    email_category: 'Security Check',
    email_reason: 'You are receiving this email because a password reset was requested for your account.',
    html_content:
      h('Reset your password') +
      lead('Use this code to reset your password. It expires in <strong>10 minutes</strong>.') +
      C.otpBox(t, '{{otp}}') +
      note("If you didn't request this, your password stays unchanged — no action needed."),
    cta_label: '', cta_url: '',
  }; })(),

  // ── Security ────────────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Security Alert'); return {
    event_key: 'SECURITY_PASSWORD_CHANGED', sender_key: 'verify', audience: 'all', category: 'Security',
    name: 'Password Changed', subject: 'Your password was changed',
    preview_text: 'Your Meeticulous password was just updated.',
    email_category: 'Security Alert',
    email_reason: 'You are receiving this email because your account password was recently changed.',
    html_content:
      h('Your password was changed') +
      lead('This is a confirmation that the password for your account was just changed.') +
      C.banner(t, { title: 'Password updated', sub: '{{email}}' }) +
      note("If this wasn't you, reset your password immediately and contact {{support_email}}."),
    cta_label: 'Secure my account', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Security Alert'); return {
    event_key: 'SECURITY_LOGIN_ALERT', sender_key: 'verify', audience: 'all', category: 'Security',
    name: 'Login Alert', subject: 'New sign-in to your account',
    preview_text: 'A new sign-in was detected on your account.',
    email_category: 'Security Alert',
    email_reason: 'You are receiving this email because a new sign-in was detected on your account.',
    html_content:
      h('New sign-in detected') +
      lead('We noticed a new sign-in to your Meeticulous account.') +
      C.infoCard(t, [['Time', '{{login_time}}'], ['IP address', '{{ip_address}}'], ['Device', '{{device_name}}']]) +
      note("If this was you, no action is needed. Otherwise reset your password and contact {{support_email}}."),
    cta_label: '', cta_url: '',
  }; })(),

  // ── Booking — Confirmed ─────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Booking Confirmed'); return {
    event_key: 'BOOKING_CONFIRMED_CUSTOMER', sender_key: 'bookings', audience: 'all', category: 'Booking',
    name: 'Booking Confirmed — Customer', subject: 'Your booking with {{vendor_name}} is confirmed',
    preview_text: 'Your appointment with {{vendor_name}} is confirmed.',
    email_category: 'Booking Confirmed',
    email_reason: 'You are receiving this email because you made a booking on Meeticulous.',
    html_content:
      ref('Booking #{{booking_ref}}') + h("You're all set, {{first_name}}") +
      lead('{{vendor_name}} is expecting you for {{service_name}}. Add it to your calendar so the time doesn\'t slip, and please join a couple of minutes early.') +
      C.bookingCard({ title: '{{service_name}}', sub: 'with {{vendor_name}}', rows: [['Date', '{{booking_date}}'], ['Time', '{{booking_time}} {{booking_tz}}'], ['Where', '{{location}}']] }) +
      // Secondary action; add-to-calendar deep link threaded by both send sites.
      pillLink('{{calendar_url}}', 'Add to Google Calendar') +
      note('<strong>Plans change?</strong> Reschedule or cancel from the button below. Cancel at least 24 hours ahead for a full refund; within 24 hours a partial refund applies, and within 6 hours the slot is non-refundable.') +
      // Invoice line is caller-built (raw-HTML {{invoice_block}} token): the full
      // "GST tax invoice is ready — <a>…</a>" <p> for a paid booking, '' for a
      // free one. A free booking has no invoice, so the old hard-coded line left a
      // dead link AND fired an admin "unresolved placeholder: invoice_url" alert on
      // every free booking. Paid path builds the <p>; free path passes ''.
      '{{invoice_block}}',
    // CTA → the public manage/cancel page (works without a login, unlike the
    // dashboard) so anonymous OTP guests can self-serve (#516).
    cta_label: 'View or manage booking', cta_url: '{{manage_url}}',
  }; })(),

  (() => { const t = themeForCategory('New Booking'); return {
    event_key: 'BOOKING_CONFIRMED_VENDOR', sender_key: 'bookings', audience: 'all', category: 'Booking',
    name: 'Booking Confirmed — Vendor', subject: 'New booking: {{service_name}}',
    preview_text: 'You have a new booking from {{user_name}}.',
    email_category: 'New Booking',
    email_reason: 'You are receiving this email because you received a new booking on Meeticulous.',
    html_content:
      h('A new client booked you') +
      lead("You've received a new booking. Add it to your calendar and review your schedule below.") +
      C.bookingCard({ title: '{{service_name}}', sub: 'with {{user_name}}', rows: [['Date', '{{booking_date}}'], ['Time', '{{booking_time}} {{booking_tz}}'], ['Where', '{{location}}']] }) +
      pillLink('{{calendar_url}}', 'Add to Google Calendar'),
    cta_label: 'Open dashboard', cta_url: '{{dashboard_url}}',
  }; })(),

  // ── Booking — Reminder ──────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Reminder'); return {
    event_key: 'BOOKING_REMINDER_CUSTOMER', sender_key: 'bookings', audience: 'all', category: 'Booking',
    name: 'Booking Reminder — Customer', subject: 'Reminder: {{service_name}} is coming up',
    preview_text: 'Your session with {{vendor_name}} is almost here.',
    email_category: 'Reminder',
    email_reason: 'You are receiving this email as a reminder about your upcoming appointment.',
    html_content:
      h('See you soon, {{first_name}}') +
      C.countdown(t, { lead: 'Your appointment is coming up at', big: '{{booking_time}}' }) +
      C.infoCard(t, [['Service', '{{service_name}}'], ['Host', '{{vendor_name}}'], ['When', '{{booking_date}}']]),
    cta_label: '{{action_label}}', cta_url: '{{action_link}}',
  }; })(),

  (() => { const t = themeForCategory('Reminder'); return {
    event_key: 'BOOKING_REMINDER_VENDOR', sender_key: 'bookings', audience: 'all', category: 'Booking',
    name: 'Booking Reminder — Vendor', subject: 'Reminder: session with {{user_name}}',
    preview_text: 'You have a session coming up with {{user_name}}.',
    email_category: 'Reminder',
    email_reason: 'You are receiving this email as a reminder about an upcoming session.',
    html_content:
      h('You have a session soon') +
      C.countdown(t, { lead: 'Your session is coming up at', big: '{{booking_time}}' }) +
      C.infoCard(t, [['Client', '{{user_name}}'], ['Service', '{{service_name}}'], ['When', '{{booking_date}}']]),
    cta_label: '{{action_label}}', cta_url: '{{action_link}}',
  }; })(),

  // ── Booking — Cancelled ─────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Booking Cancelled'); return {
    event_key: 'BOOKING_CANCELLED_CUSTOMER', sender_key: 'bookings', audience: 'all', category: 'Booking',
    name: 'Booking Cancelled — Customer', subject: 'Your booking was cancelled',
    preview_text: 'Your booking with {{vendor_name}} was cancelled.',
    email_category: 'Booking Cancelled',
    email_reason: 'You are receiving this email because a booking on your account was cancelled.',
    // Receipt frame, warm first line (PR-8 empathy reframe). The cancellation
    // itself is a known loss for the guest — acknowledge it, then show the record.
    html_content:
      h('Your booking was cancelled') +
      lead("Sorry you won't be meeting {{vendor_name}} this time. If you paid for this booking, the refund is on its way — most reach you within 5–7 working days.") +
      C.banner(t, { title: '{{service_name}}', sub: '{{booking_date}} at {{booking_time}} · with {{vendor_name}}' }) +
      lead("If anything feels off about this, just reply to this email — we'll take a look."),
    cta_label: 'Find another slot', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Booking Cancelled'); return {
    event_key: 'BOOKING_CANCELLED_VENDOR', sender_key: 'bookings', audience: 'all', category: 'Booking',
    name: 'Booking Cancelled — Vendor', subject: 'A booking was cancelled',
    preview_text: 'A booking with {{user_name}} was cancelled.',
    email_category: 'Booking Cancelled',
    email_reason: 'You are receiving this email because a booking was cancelled.',
    html_content:
      h('A booking was cancelled') +
      lead('This booking has been cancelled:') +
      C.banner(t, { title: '{{service_name}}', sub: '{{booking_date}} at {{booking_time}} · {{user_name}}' }),
    cta_label: 'Open dashboard', cta_url: '{{dashboard_url}}',
  }; })(),

  // ── Booking — Completed ─────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Session Complete'); return {
    event_key: 'BOOKING_COMPLETED_CUSTOMER', sender_key: 'bookings', audience: 'all', category: 'Booking',
    name: 'Booking Completed — Customer', subject: 'Thanks for booking with {{vendor_name}}',
    preview_text: 'How was your session with {{vendor_name}}?',
    email_category: 'Session Complete',
    email_reason: 'You are receiving this email because your session was marked as complete.',
    html_content:
      h('Thanks, {{first_name}}!') +
      lead('We hope your session with {{vendor_name}} went well.') +
      C.infoCard(t, [['Service', '{{service_name}}'], ['When', '{{booking_date}} at {{booking_time}}']]) +
      lead("We'd love your feedback — share a quick review of your session with {{vendor_name}}."),
    cta_label: 'Leave a review', cta_url: '{{review_url}}',
  }; })(),

  (() => { const t = themeForCategory('Session Complete'); return {
    event_key: 'BOOKING_COMPLETED_VENDOR', sender_key: 'bookings', audience: 'all', category: 'Booking',
    name: 'Booking Completed — Vendor', subject: 'Session with {{user_name}} marked complete',
    preview_text: 'Your session with {{user_name}} is complete.',
    email_category: 'Session Complete',
    email_reason: 'You are receiving this email because a session was marked complete on your account.',
    html_content:
      h('Session completed') +
      lead('Your session has been marked complete:') +
      C.infoCard(t, [['Client', '{{user_name}}'], ['Service', '{{service_name}}'], ['When', '{{booking_date}} at {{booking_time}}']]),
    cta_label: 'View earnings', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Session Complete'); return {
    event_key: 'REBOOK_NUDGE_CUSTOMER', audience: 'all', category: 'Marketing', sender_key: 'news',
    name: 'Rebook Nudge — Customer', subject: 'Ready for another session with {{vendor_name}}?',
    preview_text: 'Book {{vendor_name}} again in a tap.',
    email_category: 'Session Complete',
    email_reason: 'You are receiving this because you recently booked a session on Meeticulous.',
    html_content:
      h('Hi {{first_name}},') +
      lead('Hope your session with {{vendor_name}} went well. Ready for another?') +
      C.infoCard(t, [['Last service', '{{service_name}}']]) +
      lead('Booking your next session takes just a tap.'),
    cta_label: 'Book again', cta_url: '{{profile_url}}',
  }; })(),

  // ── Booking — Rescheduled ───────────────────────────────────────────────────

  (() => { const t = themeForCategory('Rescheduled'); return {
    event_key: 'BOOKING_RESCHEDULED_CUSTOMER', sender_key: 'bookings', audience: 'all', category: 'Booking',
    name: 'Booking Rescheduled — Customer', subject: 'Please confirm your rescheduled booking',
    preview_text: 'Your appointment time changed — please confirm.',
    email_category: 'Rescheduled',
    email_reason: 'You are receiving this email because your booking was rescheduled.',
    html_content:
      h('Please confirm the new time') +
      lead('Your appointment with {{vendor_name}} has been rescheduled:') +
      C.infoCard(t, [['Service', '{{service_name}}'], ['New time', '{{booking_date}} at {{booking_time}}']]) +
      lead('Please confirm the new time works for you.'),
    cta_label: 'Confirm new time', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Rescheduled'); return {
    event_key: 'BOOKING_RESCHEDULED_VENDOR', sender_key: 'bookings', audience: 'all', category: 'Booking',
    name: 'Booking Rescheduled — Vendor', subject: 'A booking was rescheduled',
    preview_text: 'A booking with {{user_name}} was rescheduled.',
    email_category: 'Rescheduled',
    email_reason: 'You are receiving this email because a booking was rescheduled.',
    html_content:
      h('A booking was rescheduled') +
      lead('This booking has a new time:') +
      C.infoCard(t, [['Client', '{{user_name}}'], ['Service', '{{service_name}}'], ['New time', '{{booking_date}} at {{booking_time}}']]),
    cta_label: 'Open dashboard', cta_url: '{{dashboard_url}}',
  }; })(),

  // ── Profile ─────────────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Onboarding'); return {
    event_key: 'PROFILE_COMPLETION_REMINDER', audience: 'all', category: 'Profile', sender_key: 'tithi',
    name: 'Profile Completion Reminder', subject: 'Your page is one step from live',
    preview_text: 'Your page is claimed — finish it and start taking bookings.',
    email_category: 'Onboarding',
    email_reason: 'You are receiving this email because your Meeticulous profile is incomplete.',
    html_content:
      h('One step from live, {{first_name}}') +
      lead("You claimed <strong>meeticulous.com/{{slug}}</strong> but haven't published yet. It's saved and waiting — the last step takes two minutes.") +
      C.banner(t, { title: 'Finish & publish', sub: 'Then your link works and people can book you.' }),
    cta_label: 'Publish my page', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Account Update'); return {
    event_key: 'PROFILE_VERIFIED', sender_key: 'account', audience: 'all', category: 'Profile',
    name: 'Verification Approved', subject: "You're verified on Meeticulous",
    preview_text: 'Your verification was approved.',
    email_category: 'Account Update',
    email_reason: 'You are receiving this email because your account verification status was updated.',
    html_content:
      h("You're verified, {{first_name}}!") +
      lead('A verified badge now appears on your public profile.') +
      C.banner(t, { title: 'Verified', sub: 'Status: {{verification_status}}' }),
    cta_label: 'View profile', cta_url: '{{profile_url}}',
  }; })(),

  (() => { const t = themeForCategory('Account Update'); return {
    event_key: 'PROFILE_REJECTED', sender_key: 'account', audience: 'all', category: 'Profile',
    name: 'Verification Rejected', subject: 'Update needed on your verification',
    preview_text: 'Your verification needs another look.',
    email_category: 'Account Update',
    email_reason: 'You are receiving this email because action is required on your account verification.',
    html_content:
      h('Your verification needs attention') +
      lead("We couldn't approve your verification this time. Review the requirements and resubmit.") +
      C.banner(t, { title: 'Needs attention', sub: 'Status: {{verification_status}}' }) +
      note('Questions? Email {{support_email}}.'),
    cta_label: 'Review & resubmit', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Account Update'); return {
    event_key: 'KYC_APPROVED', sender_key: 'account', audience: 'vendor', category: 'Profile',
    name: 'KYC Approved', subject: 'Your KYC is verified — payouts unlocked',
    preview_text: 'Your identity verification was approved.',
    email_category: 'Account Update',
    email_reason: 'You are receiving this email because your KYC verification status was updated.',
    html_content:
      C.heroImage('kyc-approved', 'Verified — payouts unlocked') +
      h("You're verified, {{first_name}}!") +
      lead('Your identity verification was approved. You can now request payouts from your dashboard.') +
      C.banner(t, { title: 'Verified', sub: 'Payouts are now unlocked' }),
    cta_label: 'Go to payouts', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Account Update'); return {
    event_key: 'KYC_REJECTED', sender_key: 'account', audience: 'vendor', category: 'Profile',
    name: 'KYC Rejected', subject: 'Action needed on your KYC verification',
    preview_text: 'Your KYC needs another look.',
    email_category: 'Account Update',
    email_reason: 'You are receiving this email because action is required on your KYC verification.',
    html_content:
      h('Your KYC needs attention') +
      lead("We couldn't approve your KYC this time. Review the reason below and resubmit.") +
      C.banner(t, { title: 'Needs attention', sub: '{{review_note}}' }) +
      note('Questions? Email {{support_email}}.'),
    cta_label: 'Review & resubmit', cta_url: '{{dashboard_url}}',
  }; })(),

  // ── Badge ────────────────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Achievement Unlocked'); return {
    event_key: 'BADGE_UNLOCKED', audience: 'all', category: 'Badge', sender_key: 'news',
    name: 'Badge Unlocked', subject: 'You earned the {{badge_name}} badge',
    preview_text: 'A new badge just landed on your profile.',
    email_category: 'Achievement Unlocked',
    email_reason: 'You are receiving this email because you earned a new achievement on Meeticulous.',
    html_content:
      C.heroImage('badge-unlocked', 'A new badge') +
      h('You earned the {{badge_name}} badge, {{first_name}}!') +
      lead('{{badge_description}}'),
    cta_label: 'See my badges', cta_url: '{{profile_url}}/badges',
  }; })(),

  // ── Milestones ───────────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Achievement Unlocked'); return {
    event_key: 'MILESTONE_FIRST_BOOKING', audience: 'all', category: 'Badge', sender_key: 'shubham',
    name: 'Milestone — First Booking', subject: 'Your first booking on Meeticulous!',
    preview_text: 'A note from Shubham — and the Pro reminders are on us for 60 days.',
    email_category: 'Achievement Unlocked',
    email_reason: 'You are receiving this email because you reached a booking milestone on Meeticulous.',
    // Consolidated with PRO_TASTE_STARTED: one email on first booking, not two.
    // PRO_TASTE_STARTED now sends the in-app bell only — the Pro Taste gift is
    // announced here, in Shubham's voice. ENDING and ENDED keep their own emails.
    html_content:
      C.heroImage('milestone-1', 'First booking') +
      h('Your first booking is in, {{first_name}}') +
      lead("This is the start of something. Someone found you on Meeticulous, and they chose you. That matters.") +
      lead('From today, for the next <strong>60 days</strong>, your guests get WhatsApp reminders and you both get reschedule alerts — that is Pro, on us. After that they switch to email unless you go Pro.') +
      lead("Nothing to do right now. Go run the booking. Hit reply any time — I read these."),
    cta_label: 'See my bookings', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Achievement Unlocked'); return {
    event_key: 'MILESTONE_10_BOOKINGS', audience: 'all', category: 'Badge', sender_key: 'news',
    name: 'Milestone — 10 Bookings', subject: '10 bookings and counting!',
    preview_text: "You've reached {{milestone_value}} bookings.",
    email_category: 'Achievement Unlocked',
    email_reason: 'You are receiving this email because you reached a booking milestone on Meeticulous.',
    html_content:
      C.heroImage('milestone-10', '10 bookings') +
      h('10 bookings, {{first_name}}!') +
      lead('Momentum is building.'),
    cta_label: 'View dashboard', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Achievement Unlocked'); return {
    event_key: 'MILESTONE_50_BOOKINGS', audience: 'all', category: 'Badge', sender_key: 'news',
    name: 'Milestone — 50 Bookings', subject: "50 bookings — you're on a roll",
    preview_text: "You've reached {{milestone_value}} bookings.",
    email_category: 'Achievement Unlocked',
    email_reason: 'You are receiving this email because you reached a booking milestone on Meeticulous.',
    html_content:
      C.heroImage('milestone-50', '50 bookings') +
      h('50 bookings!') +
      lead('Your clients clearly love working with you.'),
    cta_label: 'View dashboard', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Achievement Unlocked'); return {
    event_key: 'MILESTONE_100_BOOKINGS', audience: 'all', category: 'Badge', sender_key: 'news',
    name: 'Milestone — 100 Bookings', subject: '100 bookings — incredible!',
    preview_text: "You've reached {{milestone_value}} bookings.",
    email_category: 'Achievement Unlocked',
    email_reason: 'You are receiving this email because you reached a booking milestone on Meeticulous.',
    html_content:
      C.heroImage('milestone-100', '100 bookings') +
      h('100 bookings, {{first_name}}!') +
      lead("That's a serious achievement."),
    cta_label: 'View dashboard', cta_url: '{{dashboard_url}}',
  }; })(),

  // ── Subscription ─────────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Payment Receipt'); return {
    event_key: 'SUBSCRIPTION_PURCHASED', sender_key: 'payments', audience: 'all', category: 'Subscription',
    name: 'Premium Activated', subject: "You're officially on {{plan_name}} 🎉",
    preview_text: "{{plan_name}} is live — your booking link's ready to get you paid.",
    email_category: 'Payment Receipt',
    email_reason: 'You are receiving this email because you made a purchase on Meeticulous.',
    html_content:
      C.heroImage('premium-active', 'Premium unlocked') +
      h("You're officially on {{plan_name}}, {{first_name}} 🎉") +
      lead("Some people spend weeks 'thinking about it.' You just did the thing. Your {{plan_name}} plan is live, and everything you need to get booked and get paid is switched on.") +
      C.banner(t, { title: "Here's what just went live for you", sub: 'Your booking link is ready to share · payments land straight in your account · every guest gets automatic reminders and confirmations' }) +
      lead("Next move: get your page in front of people. One link in your bio beats a hundred “DM me to book” replies — and it works while you sleep.") +
      C.infoCard(t, [['Plan', '{{plan_name}}'], ['Amount paid', '{{amount_charged}}'], ['Renews', '{{expiry_date}}']]) +
      note('GST tax invoice: <a href="{{invoice_url}}" style="color:#960D32;font-weight:600;text-decoration:none">view or download the PDF</a> — also filed under Transactions in your dashboard.'),
    cta_label: 'Set up your page', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Renewal'); return {
    event_key: 'SUBSCRIPTION_EXPIRING', audience: 'all', category: 'Subscription', sender_key: 'payments',
    name: 'Premium Expiring', subject: 'Your {{plan_name}} plan renews in {{days_left}} days',
    preview_text: "Keep your 0% commission — don't slip back to 5%.",
    email_category: 'Renewal',
    email_reason: 'You are receiving this email because your Meeticulous subscription is due to renew soon.',
    html_content:
      C.heroImage('premium-expiring', 'Your plan renews soon') +
      C.heroBand(t, { kick: 'Renews in {{days_left}} days', h2: 'Keep your 0%.', sub: "Don't slip back to 5% commission, {{first_name}}." }) +
      lead('Your <strong>{{plan_name}}</strong> plan renews on <strong>{{expiry_date}}</strong>. Stay on it and every booking stays commission-free.') +
      lead('If it lapses, you drop to Starter — 5% per booking comes back.'),
    cta_label: 'Renew {{plan_name}}', cta_url: '{{renew_url}}',
  }; })(),

  (() => { const t = themeForCategory('Payment Receipt'); return {
    event_key: 'SUBSCRIPTION_RENEWED', sender_key: 'payments', audience: 'all', category: 'Subscription',
    name: 'Premium Renewed', subject: 'Your {{plan_name}} plan is renewed',
    preview_text: 'Your subscription was renewed successfully.',
    email_category: 'Payment Receipt',
    email_reason: 'You are receiving this email because your Meeticulous subscription was renewed.',
    html_content:
      C.heroImage('premium-active', 'Plan renewed') +
      h("You're renewed, {{first_name}}") +
      lead('Your {{plan_name}} plan has been renewed.') +
      C.infoCard(t, [['Plan', '{{plan_name}}'], ['Amount paid', '{{amount_charged}}'], ['Renews', '{{expiry_date}}']]) +
      lead('Your GST tax invoice is ready — <a href="{{invoice_url}}" style="color:#960D32;font-weight:600;text-decoration:none">view or download the PDF</a>. It is also under Transactions in your dashboard.'),
    cta_label: 'View dashboard', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Renewal'); return {
    event_key: 'SUBSCRIPTION_HALTED', audience: 'vendor', category: 'Subscription', sender_key: 'payments',
    name: 'Subscription Payment Failed', subject: "Your renewal didn't go through",
    preview_text: 'Update your payment to keep your plan and 0% commission.',
    email_category: 'Renewal',
    email_reason: 'You are receiving this email because an automatic renewal charge for your Meeticulous subscription could not be completed.',
    html_content:
      h("Your renewal didn't go through, {{first_name}}") +
      lead("We tried to charge your {{plan_name}} renewal a few times and it didn't go through. Your plan is paused — update your payment method to keep it (and your 0% commission).") +
      note('If you meant to cancel, no action is needed — your plan simply ends at the current period.'),
    cta_label: 'Update payment', cta_url: '{{dashboard_url}}',
  }; })(),

  // ── Gifted Pro (v3.190, planGiftService) ─────────────────────────────────────
  // The gift itself comes from the founder (he gifted it); the lifecycle notices
  // that follow come from Tithi. Plain sender keys, never crm_* — these are
  // transactional and must send even while crm_admin_sends is off.

  (() => { const t = themeForCategory('Community Update'); return {
    event_key: 'PLAN_GIFT_RECEIVED', audience: 'vendor', category: 'Subscription', sender_key: 'shubham',
    name: 'Gifted Pro Received', subject: '{{gift_headline}} 🎁',
    preview_text: 'Pro for {{tenure}}, on us. No card needed.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this email because the Meeticulous team gifted your account a complimentary Pro plan.',
    html_content:
      h('{{gift_headline}}, {{first_name}}') +
      lead('You now have <strong>Pro</strong> for <strong>{{tenure}}</strong>, on me. No card, no catch. It runs until <strong>{{end_date}}</strong>.') +
      lead('{{gift_note}}') +
      lead('Every Pro feature is switched on: 0% commission on bookings, every reminder flow, the full CRM and unlimited AI help.') +
      note('When the gift ends you go back to Starter. Your services, bookings and clients stay exactly as they are.') +
      '<!--cta-->' +
      C.signOff('Shubham', 'Founder, Meeticulous'),
    cta_label: 'Open your dashboard', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Renewal'); return {
    event_key: 'PLAN_GIFT_ENDING', audience: 'vendor', category: 'Subscription', sender_key: 'tithi',
    name: 'Gifted Pro Ending', subject: 'Your gifted Pro ends {{ends_in}}',
    preview_text: 'Go Pro to keep everything you have now.',
    email_category: 'Renewal',
    email_reason: 'You are receiving this email because your complimentary Pro plan from Meeticulous ends soon.',
    html_content:
      C.heroBand(t, { kick: 'Ends {{ends_in}}', h2: 'Keep Pro going.', sub: 'Your gift ends on {{end_date}}, {{first_name}}.' }) +
      lead('Your gifted <strong>Pro</strong> ends on <strong>{{end_date}}</strong>. After that you go back to Starter, and the Pro features switch off.') +
      lead('Go Pro before then and nothing changes for you or your clients.') +
      '<!--cta-->' +
      C.signOff('Tithi', 'Meeticulous'),
    cta_label: 'Keep Pro', cta_url: '{{upgrade_url}}',
  }; })(),

  (() => { const t = themeForCategory('Renewal'); return {
    event_key: 'PLAN_GIFT_ENDED', audience: 'vendor', category: 'Subscription', sender_key: 'tithi',
    name: 'Gifted Pro Expired', subject: 'Your gifted Pro has expired',
    preview_text: 'Go Pro to keep using the benefits.',
    email_category: 'Renewal',
    email_reason: 'You are receiving this email because your complimentary Pro plan from Meeticulous has ended.',
    html_content:
      h('Your gifted Pro has expired, {{first_name}}') +
      lead('To keep using the Pro benefits, go Pro. It takes a minute.') +
      note("You're on Starter now. Your services, bookings and clients are all still here.") +
      '<!--cta-->' +
      C.signOff('Tithi', 'Meeticulous'),
    cta_label: 'Go Pro', cta_url: '{{upgrade_url}}',
  }; })(),

  (() => { const t = themeForCategory('Payment Receipt'); return {
    event_key: 'REFERRAL_REWARD_RELEASED', sender_key: 'payments', audience: 'vendor', category: 'Payments',
    name: 'Referral Reward Released', subject: 'You earned a referral reward 🎉',
    preview_text: 'Your referral reward is now in your withdrawable balance.',
    email_category: 'Payment Receipt',
    email_reason: 'You are receiving this email because a referral reward was credited to your Meeticulous account.',
    html_content:
      C.heroImage('referral-reward', 'Referral reward') +
      h('Nice — you earned {{reward_amount}}, {{first_name}}') +
      lead('Someone you referred stuck around, so your referral reward has been released to your withdrawable balance.') +
      C.infoCard(t, [['Reward', '{{reward_amount}}'], ['Status', 'Added to withdrawable balance']]) +
      lead('Refer more hosts and keep earning.'),
    cta_label: 'View referrals', cta_url: '{{dashboard_url}}',
  }; })(),

  // ── Celebrations ─────────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Community Update'); return {
    event_key: 'BIRTHDAY', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Birthday', subject: 'Happy birthday, {{first_name}}!',
    preview_text: 'A little birthday note from Meeticulous.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this email because you are a valued member of the Meeticulous community.',
    html_content:
      C.heroImage('birthday', 'Birthday cake') +
      h('Happy birthday, {{first_name}}!') +
      lead('Everyone at Meeticulous wishes you a wonderful day. Thanks for being part of our community.'),
    cta_label: '', cta_url: '',
  }; })(),

  (() => { const t = themeForCategory('Community Update'); return {
    event_key: 'ACCOUNT_ANNIVERSARY', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Account Anniversary', subject: "It's your Meeticulous anniversary!",
    preview_text: 'Celebrating another year with you.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this email because you are a valued member of the Meeticulous community.',
    html_content:
      // ponytail: always the 1-year banner — nothing sends this event yet, so no
      // years value exists. anniversary-2/-3.png are shipped; pick by years once a sender passes it.
      C.heroImage('anniversary-1', 'Another year together') +
      h('Happy anniversary, {{first_name}}!') +
      lead("It's been another year with Meeticulous. Thank you for trusting us with your bookings."),
    cta_label: 'View dashboard', cta_url: '{{dashboard_url}}',
  }; })(),

  // ── Vendor welcome ────────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Welcome'); return {
    event_key: 'VENDOR_WELCOME', audience: 'all', category: 'Profile', sender_key: 'tithi',
    name: 'Vendor Welcome', subject: 'Welcome to Meeticulous, {{first_name}}',
    preview_text: "Let's get your booking page ready.",
    email_category: 'Welcome',
    email_reason: 'You are receiving this email because you recently created a Meeticulous host account.',
    html_content:
      C.heroImage('host-welcome', 'Welcome to Meeticulous') +
      h('Welcome to Meeticulous, {{first_name}}') +
      lead('Your account is ready. Three quick steps and clients can book and pay you — about 5 minutes in total.') +
      steps(
        step(1, 'Add your first service', 'Name, duration and price · 2 min'),
        step(2, 'Set your availability', 'The hours clients can book · 1 min'),
        step(3, 'Share your link', '{{profile_url}} · WhatsApp, Instagram bio'),
      ) +
      '<!--cta-->' +
      C.signOff('Tithi', 'Meeticulous'),
    cta_label: 'Set up my page', cta_url: '{{dashboard_url}}',
  }; })(),

  // ── Guest welcome (founder voice, from Shubham) ───────────────────────────────
  // Fired once when a brand-new guest account is created (OTP or email/password).
  // Plain, personal note in the Resend-founder-email spirit, wrapped in our shell.

  (() => { const t = themeForCategory('Welcome'); return {
    event_key: 'GUEST_WELCOME', audience: 'all', category: 'Profile', sender_key: 'shubham',
    name: 'Guest Welcome', subject: 'Welcome to Meeticulous, {{first_name}}',
    preview_text: 'A quick hello from the founder — and three ways to get started.',
    email_category: 'Welcome',
    email_reason: 'You are receiving this email because you recently created a Meeticulous account.',
    html_content:
      C.heroImage('guest-welcome', 'Welcome to Meeticulous') +
      h('Welcome to Meeticulous, {{first_name}}') +
      lead("I'm Shubham, founder of Meeticulous. I started it because booking time with the people you actually want to meet should feel effortless — no back-and-forth, no friction.") +
      lead('Three ways to get started:') +
      `<ol style="margin:0 0 18px;padding-left:20px;font-size:16px;line-height:1.7;color:#4A3A3E;font-family:'Poppins','Plus Jakarta Sans',Arial,sans-serif;">` +
        `<li><a href="{{website_url}}/explore" style="color:{{brand_color}};font-weight:600;text-decoration:none;">Explore creators</a> and find someone worth your time</li>` +
        `<li>Book your first session in a couple of taps</li>` +
        `<li>Manage everything from your bookings dashboard</li>` +
      `</ol>` +
      lead('<strong>P.S.</strong> What brought you here? Just hit reply and let me know — I read every email.') +
      C.signOff('Shubham', 'Founder, Meeticulous'),
    cta_label: 'Explore creators', cta_url: '{{website_url}}/explore',
  }; })(),

  // ── First earning → payouts (reframed: lead with the win, KYC as how-to-claim) ─

  (() => { const t = themeForCategory('Payment Receipt'); return {
    event_key: 'KYC_EARN_NUDGE', audience: 'all', category: 'Payments', sender_key: 'tithi',
    name: 'First Earning — Set Up Payouts', subject: "You've earned {{earned_amount}} 🎉",
    preview_text: "It's yours — here's how to get it into your account.",
    email_category: 'Payment Receipt',
    email_reason: 'You are receiving this email because you have earnings waiting on Meeticulous.',
    html_content:
      h("You've earned {{earned_amount}}, {{first_name}}") +
      lead('Real money, from a real booking. One quick step to receive it — add your PAN and bank details so we can pay you out. About 2 minutes, one time only.') +
      C.amountRow(t, 'Ready to withdraw', '{{earned_amount}}') +
      lead('After this, every rupee you earn lands in your account automatically.'),
    cta_label: 'Set up payouts', cta_url: '{{kyc_url}}',
  }; })(),

  // ── Payout / settlement lifecycle (host-facing) ──────────────────────────
  (() => { const t = themeForCategory('Payment Receipt'); return {
    event_key: 'PAYOUT_SENT', audience: 'all', category: 'Payments', sender_key: 'payments',
    name: 'Payout — On The Way', subject: '{{payout_amount}} is on its way to your bank 💸',
    preview_text: 'Your earnings have been released and are settling to your account.',
    email_category: 'Payment Receipt',
    email_reason: 'You are receiving this email because you received a payout on Meeticulous.',
    html_content:
      C.heroImage('payout-sent', 'Payout on its way') +
      h('{{payout_amount}} is on its way, {{first_name}}') +
      lead('Nice work. Your earnings from a completed booking have been released and are settling to your bank account now. Depending on your bank it usually lands within 1–2 working days (a little longer over holidays).') +
      C.amountRow(t, 'Paid to you', '{{payout_amount}}') +
      lead('You can see every payout and its status in your dashboard.') +
      note('{{commission_line}}'),
    cta_label: 'View payouts', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Account Update'); return {
    event_key: 'PAYOUT_VERIFICATION_NEEDED', audience: 'all', category: 'Payments', sender_key: 'payments',
    name: 'Payout — Verification Needed', subject: 'One more step to unlock your payouts',
    preview_text: 'Your payment partner needs a little more to verify your account.',
    email_category: 'Account Update',
    email_reason: 'You are receiving this email because your payout account needs verification on Meeticulous.',
    html_content:
      h('Almost there, {{first_name}}') +
      lead('You have money waiting, but our payments partner needs a little more information to finish verifying your payout account before we can release it. It only takes a few minutes.') +
      lead('Open your dashboard to see exactly what is needed and complete it.'),
    cta_label: 'Complete verification', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Account Update'); return {
    event_key: 'PAYOUT_FAILED', audience: 'all', category: 'Payments', sender_key: 'payments',
    name: 'Payout — Could Not Complete', subject: "We couldn't send your payout — quick fix inside",
    preview_text: "Your payout didn't go through. A quick check of your bank details fixes it.",
    email_category: 'Account Update',
    email_reason: 'You are receiving this email because a payout to you could not be completed on Meeticulous.',
    html_content:
      h("Your payout didn't go through, {{first_name}}") +
      lead("We tried to send {{payout_amount}} to your bank but it didn't complete — usually a bank or account detail needs updating. Your money is safe and waiting; confirm your payout details and we'll retry automatically.") +
      C.amountRow(t, 'Waiting to be paid', '{{payout_amount}}') +
      lead('Update your details and the next payout run picks it up.'),
    cta_label: 'Check payout details', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Payment Receipt'); return {
    event_key: 'EARNING_REVERSED', audience: 'all', category: 'Payments', sender_key: 'payments',
    name: 'Earning Reversed', subject: 'A booking was refunded — earning reversed',
    preview_text: 'A booking you earned on was refunded, so that payout was reversed.',
    email_category: 'Payment Receipt',
    email_reason: 'You are receiving this email because a booking you earned on was refunded on Meeticulous.',
    // Receipt frame, warm first line (PR-8 empathy reframe). A reversal reads
    // as a punishment if we just state it — explain the WHY plainly first.
    html_content:
      h('Heads up on a reversal, {{first_name}}') +
      lead("A booking you earned on was cancelled or refunded, so the {{payout_amount}} for it has been pulled back. Not your mistake — refunds mean the money has to return to the guest, and whatever you were due from it goes with it.") +
      C.amountRow(t, 'Reversed', '{{payout_amount}}') +
      lead("Everything else you've earned is unaffected. If this reversal looks wrong to you, reply to this email and we'll check it ourselves."),
    cta_label: 'View transactions', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Payment Receipt'); return {
    event_key: 'PAYOUT_DELAY_HOLIDAY', audience: 'all', category: 'Payments', sender_key: 'payments',
    name: 'Payout — Bank Holiday Delay', subject: 'Heads up — {{holiday}} may add a day to your payout',
    preview_text: 'Banks are closed for the holiday, so your payout lands a working day later.',
    email_category: 'Payment Receipt',
    email_reason: 'You are receiving this email because you have a payout settling around a bank holiday on Meeticulous.',
    html_content:
      h('Your payout may take an extra day, {{first_name}}') +
      lead("Banks are closed for {{holiday}} on {{holiday_date}}, so payouts don't settle that day. Your recent payout of {{payout_amount}} should reach your account by {{expected_date}} instead — nothing's wrong, it's just the bank holiday.") +
      C.amountRow(t, 'On the way', '{{payout_amount}}') +
      lead('We follow the bank settlement schedule, so this catches up automatically.'),
    cta_label: 'View payouts', cta_url: '{{dashboard_url}}',
  }; })(),

  // ── Engagement ───────────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Product Feedback'); return {
    event_key: 'FEEDBACK_STATUS_CHANGED', sender_key: 'account', audience: 'vendor', category: 'Engagement',
    name: 'Feedback Status Update', subject: 'Update on your feedback: {{feedback_subject}}',
    preview_text: 'Your feedback is now {{status_label}}.',
    email_category: 'Product Feedback',
    email_reason: 'You are receiving this email because you submitted feedback on Meeticulous.',
    html_content:
      h('Your feedback is now {{status_label}}') +
      lead('Thanks for helping us improve Meeticulous. Here is where your feedback stands:') +
      C.banner(t, { title: '{{status_label}}', sub: '{{feedback_subject}}' }) +
      lead('{{admin_response}}') +
      note('Have more to share? Open Feedback in your dashboard any time.'),
    cta_label: 'Open my feedback', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Invitation'); return {
    event_key: 'GUEST_TO_HOST_INVITE', audience: 'all', category: 'Marketing', sender_key: 'shubham',
    name: 'Guest → Host Invite', subject: "You've booked {{completed_count}} times — ever thought about the other side?",
    preview_text: 'A quick note from Shubham — your account is already set up to host.',
    email_category: 'Invitation',
    email_reason: 'You are receiving this email because you are a Meeticulous guest.',
    // Founder frame: one voice, one ask, no grids. Shubham is the sender; the body
    // reads like a short personal note. The CTA is a convenience, not the point.
    html_content:
      h('{{first_name}}, a quick note from me') +
      lead("You've booked {{completed_count}} times on Meeticulous. I noticed, and figured I'd write.") +
      lead('The hosts you paid use the same platform to <strong>get paid</strong> — one link they share, bookings that just show up. Your account is already set up for it. No new signup, no card, nothing to fill in.') +
      lead("If you've been thinking of the other side, this is your opening. If not, ignore me — hit reply, tell me why. Either way, good to have you here."),
    cta_label: 'Start hosting free', cta_url: '{{become_host_url}}',
  }; })(),

  // ── Booking — Abandoned recovery ──────────────────────────────────────────────

  (() => { const t = themeForCategory('Held Slot'); return {
    event_key: 'BOOKING_ABANDONED_CUSTOMER', audience: 'all', category: 'Booking', sender_key: 'tithi',
    name: 'Abandoned Booking — Recover', subject: 'Your slot with {{vendor_name}} is still held',
    preview_text: '{{service_name}} — finish in one tap.',
    email_category: 'Held Slot',
    email_reason: 'You are receiving this email because you started a booking on Meeticulous.',
    html_content:
      h('Finish your booking, {{first_name}}') +
      lead("You were almost done booking <strong>{{service_name}}</strong> with {{vendor_name}}. We're holding your slot — but not for long, it'll open back up to others soon.") +
      C.bookingCard({ title: '{{service_name}}', sub: 'with {{vendor_name}}', rows: [['Date', '{{booking_date}}'], ['Time', '{{booking_time}}']] }) +
      C.countdown(t, { lead: 'Held for you', big: 'A few more minutes' }),
    cta_label: 'Complete your booking', cta_url: '{{resume_url}}',
  }; })(),

  // ── Host activation nudges (sent by services/activationNudges.js) ──────────────
  // First seeded by migration v3.164; owned here since the 2026-11 redesign so a
  // reseed keeps them in step with the other templates. {{link}} is per-nudge.

  ...[
    ['HOST_ADD_SERVICE_NUDGE', 'Host — Add First Service', 'Onboarding', 'Your Meeticulous page is empty, {{first_name}}',
      "Add one service with a price and you're live.", 'Getting Started', 'You are receiving this because you signed up as a host on Meeticulous.',
      'Add your first service, {{first_name}}',
      'Your account is ready — but there is nothing on your page to book yet. Add one service with a price and you are live. Takes about two minutes.',
      'Add my service'],
    ['HOST_SHARE_LINK_NUDGE', 'Host — Share Booking Link', 'Onboarding', 'Your page is live — now share it, {{first_name}}',
      'A page nobody sees gets no bookings.', 'Getting Started', 'You are receiving this because you have a live booking page on Meeticulous.',
      'Your booking page is live, {{first_name}} 🎉',
      'The only thing between you and your first booking is people seeing your link. Share it with 5 people today — WhatsApp, your Instagram bio, anywhere your clients already are.',
      'Copy my link'],
    ['HOST_FIRST_BOOKING_NUDGE', 'Host — Get First Booking', 'Onboarding', "Still no bookings? Here's the fastest fix",
      'The first booking usually comes from your own circle.', 'Getting Started', 'You are receiving this because you have a live booking page on Meeticulous.',
      'No bookings yet is normal, {{first_name}}',
      'The first one is the hardest. Fastest path: send your link to 3 people who have paid you before, or share it once in a group you are in. First bookings almost always come from your own circle, not strangers.',
      'Share my link'],
    ['HOST_PAYOUT_WAITING_NUDGE', 'Host — Payout Waiting (KYC)', 'Payments', 'You have a payout waiting, {{first_name}}',
      "Finish KYC and we'll send it to your bank.", 'Payment Receipt', 'You are receiving this because you have earnings waiting on Meeticulous.',
      'Your money is waiting, {{first_name}} 💰',
      'You have earned on Meeticulous. To send it to your bank we need a quick KYC (PAN + bank details) — a regulatory requirement, about three minutes.',
      'Finish KYC'],
  ].map(([event_key, name, category, subject, preview_text, email_category, email_reason, title, body, cta_label]) => ({
    event_key, name, category, subject, preview_text, email_category, email_reason,
    audience: 'vendor', sender_key: 'tithi',
    html_content: h(title) + lead(body) + '<!--cta-->' + C.signOff('Tithi', 'Meeticulous'),
    cta_label, cta_url: '{{link}}',
  })),

  // ── 60-day Pro taste (sent by services/proTasteNudges.js) ───────────────────────
  // Free hosts get WhatsApp reminders + reschedule alerts for 60 days from their
  // first booking. {{link}} is the dashboard / upgrade URL for each stage.

  ...[
    ['PRO_TASTE_STARTED', 'Pro Taste — Started', 'Upgrade', 'Your first booking is in, {{first_name}} 🎉',
      'WhatsApp reminders are on for 60 days.', 'Your plan', 'You are receiving this because you are a Meeticulous host on the free plan.',
      'Your first booking is in, {{first_name}} 🎉',
      'For the next 60 days your guests get <strong>WhatsApp reminders</strong>, and you both get <strong>reschedule alerts</strong> — that is Pro, on us. After {{taste_ends_on}} they switch to email unless you go Pro.',
      'See my bookings'],
    ['PRO_TASTE_ENDING', 'Pro Taste — Ending Soon', 'Upgrade', '{{days_left}} days left of WhatsApp reminders',
      'They switch to email on {{taste_ends_on}}.', 'Your plan', 'You are receiving this because you are a Meeticulous host on the free plan.',
      '{{days_left}} days left of WhatsApp reminders',
      'Since your first booking, Meeticulous has sent WhatsApp reminders for <strong>{{reminded_count}}</strong> of your bookings. On {{taste_ends_on}} they switch to email. Keep them on with Pro — founding price ₹1,179/yr incl. GST, locked for life. {{spots_line}}',
      'Keep WhatsApp reminders'],
    ['PRO_TASTE_ENDED', 'Pro Taste — Ended', 'Upgrade', 'WhatsApp reminders are now off',
      'Your guests now get email reminders only.', 'Your plan', 'You are receiving this because you are a Meeticulous host on the free plan.',
      'WhatsApp reminders are now off',
      'Your guests now get email reminders only, and reschedule alerts are off for you. Everything else stays the same — your page, bookings and payments keep working. Turn WhatsApp back on any time with Pro.',
      'Turn WhatsApp back on'],
  ].map(([event_key, name, category, subject, preview_text, email_category, email_reason, title, body, cta_label]) => ({
    event_key, name, category, subject, preview_text, email_category, email_reason,
    audience: 'vendor', sender_key: 'tithi',
    html_content: h(title) + lead(body) + '<!--cta-->' + C.signOff('Tithi', 'Meeticulous team · just reply with any question'),
    cta_label, cta_url: '{{link}}',
  })),

  // ── Marketing ─────────────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Upgrade'); return {
    event_key: 'UPGRADE_COMMISSION_NUDGE', audience: 'all', category: 'Marketing', sender_key: 'news',
    name: 'Upgrade — Keep Every Rupee', subject: "You paid {{commission_total}} in commission this month",
    preview_text: 'Pro costs less than that — and takes 0%.',
    email_category: 'Upgrade',
    email_reason: 'You are receiving this because you are a Meeticulous host on the free plan.',
    html_content:
      C.heroBand(t, { kick: 'Commission given up', big: '{{commission_total}}', sub: "On Pro that's ₹0, {{first_name}}." }) +
      lead("You've earned well — but the free plan takes <strong>5%</strong> of every booking. In the last 30 days you handed back <strong>{{commission_total}}</strong> across {{bookings_count}} bookings. Pro yearly works out to ₹98 a month and takes 0%.") +
      C.compareRow(t, { leftLabel: 'Starter', leftPct: '5%', leftCap: 'per booking', rightLabel: 'Pro', rightPct: '0%', rightCap: 'you keep it all' }) +
      C.stars({ rating: 5, text: 'Hosts who upgraded keep every rupee they earn.' }),
    cta_label: 'Upgrade to 0% commission', cta_url: '{{upgrade_url}}',
  }; })(),

  (() => { const t = themeForCategory('Upgrade'); return {
    event_key: 'FOUNDING_SPOTS_LOW', audience: 'vendor', category: 'Marketing', sender_key: 'news',
    name: 'Upgrade — Founding Spots Low', subject: '{{spots_left}} founding Pro spots left',
    preview_text: 'Founding price ₹1,179/yr incl. GST, locked for life — then Pro is ₹1,769.',
    email_category: 'Upgrade',
    email_reason: 'You are receiving this because you are a Meeticulous host on the free plan.',
    html_content:
      C.heroBand(t, { kick: 'Founding spots left', big: '{{spots_left}}', sub: 'of 100, {{first_name}}.' }) +
      lead('The founding Pro price — <strong>₹1,179/yr incl. GST, locked for life</strong> — closes after the first 100 hosts. After that, Pro is ₹1,769/yr.') +
      lead("You've paid <strong>{{commission_total}}</strong> in commission so far. Pro takes 0%, keeps WhatsApp reminders on for every guest, and rebooks your regulars automatically."),
    cta_label: 'Claim a founding spot', cta_url: '{{upgrade_url}}',
  }; })(),

  // ── Newsletter ────────────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Newsletter'); return {
    event_key: 'NEWSLETTER_WELCOME', audience: 'all', category: 'Newsletter', sender_key: 'news',
    name: 'Newsletter Welcome', subject: 'Welcome to the Collective 🎉',
    preview_text: 'Practical tips, templates and honest lessons — straight to your inbox.',
    email_category: 'Newsletter',
    email_reason: 'You are receiving this email because you subscribed to the Meeticulous newsletter.',
    html_content:
      C.heroImage('newsletter-welcome', 'Welcome to the newsletter') +
      h("You're in.") +
      lead('Thanks for subscribing. Every week we send tips, templates and honest lessons on getting booked and paid.') +
      lead('No noise, no spam — just the good stuff.') +
      note('Not for you? You can unsubscribe any time using the link below.'),
    cta_label: 'Explore Meeticulous', cta_url: '{{website_url}}',
  }; })(),

  // ── Community (reply / mention / removal) ────────────────────────────────────

  (() => { const t = themeForCategory('Community Update'); return {
    event_key: 'COMMUNITY_REPLY', audience: 'all', category: 'Community', sender_key: 'community',
    name: 'Community Reply', subject: '{{actor_name}} replied to your {{target_label}}',
    preview_text: '{{actor_name}} replied in the Meeticulous community.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this email because someone replied to you in the Meeticulous community. To stop these emails, use the unsubscribe link in this email.',
    html_content:
      h('{{actor_name}} replied to your {{target_label}}') +
      lead('Hi {{first_name}}, here is what they said:') +
      C.infoCard(t, [['Reply', '{{excerpt}}']]) +
      lead('Join the conversation whenever you are ready.') +
      // In the body, not just the footer: the vendor (host) shell has no unsubscribe row.
      note('Prefer not to get these emails? <a href="{{website_url}}/unsubscribe?u={{unsubscribe_token}}" style="color:#7D6B70;">Unsubscribe</a>.'),
    cta_label: 'View the reply', cta_url: '{{community_url}}',
  }; })(),

  (() => { const t = themeForCategory('Community Update'); return {
    event_key: 'COMMUNITY_MENTION', audience: 'all', category: 'Community', sender_key: 'community',
    name: 'Community Mention', subject: '{{actor_name}} mentioned you',
    preview_text: '{{actor_name}} mentioned you in the Meeticulous community.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this email because someone mentioned you in the Meeticulous community. To stop these emails, use the unsubscribe link in this email.',
    html_content:
      h('{{actor_name}} mentioned you') +
      lead('Hi {{first_name}}, you were mentioned in the community:') +
      C.infoCard(t, [['Message', '{{excerpt}}']]) +
      note('Prefer not to get these emails? <a href="{{website_url}}/unsubscribe?u={{unsubscribe_token}}" style="color:#7D6B70;">Unsubscribe</a>.'),
    cta_label: 'See the mention', cta_url: '{{community_url}}',
  }; })(),

  (() => { const t = themeForCategory('Community Update'); return {
    event_key: 'COMMUNITY_ANSWER_ACCEPTED', audience: 'all', category: 'Community', sender_key: 'community',
    name: 'Community Answer Accepted', subject: 'Your answer was accepted — {{asker_name}}\'s question',
    preview_text: '{{asker_name}} picked your answer in the Meeticulous community.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this email because the author of a question in the Meeticulous community accepted your answer. To stop these emails, use the unsubscribe link in this email.',
    html_content:
      h('{{asker_name}} picked your answer') +
      lead('Hi {{first_name}}, your answer was accepted on this question:') +
      C.infoCard(t, [['Question', '{{question_excerpt}}'], ['Your answer', '{{answer_excerpt}}']]) +
      lead('That is the whole point of this space — a real person got unstuck because you knew the thing. Thank you.') +
      note('Prefer not to get these emails? <a href="{{website_url}}/unsubscribe?u={{unsubscribe_token}}" style="color:#7D6B70;">Unsubscribe</a>.'),
    cta_label: 'Open the thread', cta_url: '{{community_url}}',
  }; })(),

  {
    event_key: 'COMMUNITY_CONTENT_REMOVED', audience: 'all', category: 'Community', sender_key: 'community',
    name: 'Community Content Removed', subject: 'Your community {{target_label}} was removed',
    preview_text: 'A moderator removed your community {{target_label}}.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this email because a moderator removed your content from the Meeticulous community.',
    html_content:
      h('Your {{target_label}} was removed') +
      lead('Hi {{first_name}}, a moderator removed your {{target_label}} because it did not follow our community guidelines.') +
      lead('If you think this was a mistake, reply to this email and we will take another look.'),
    cta_label: 'Read the guidelines', cta_url: '{{community_url}}',
  },

  // ── Community onboarding sequence (5-step, 14 days) ────────────────────────────
  // Placeholder copy — final copy to be edited in the admin editor (templateSync
  // keeps admin edits per v3.187). All share sender_key 'community' (v3.201).

  (() => { const t = themeForCategory('Community Update'); return {
    event_key: 'COMMUNITY_WELCOME', audience: 'all', category: 'Community', sender_key: 'community',
    name: 'Community — Welcome', subject: 'You are in, {{first_name}}. Here is where to start.',
    preview_text: 'Three places to go first. Everything else can wait.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this email because you joined the Meeticulous community. To stop these emails, use the unsubscribe link in this email.',
    html_content:
      h('You are in.') +
      lead('Hi {{first_name}} — welcome to the Meeticulous community. It is a small space where hosts and guests figure things out together. Here is the shortest useful tour.') +
      C.infoCard(t, [
        ['Help & Questions', 'Ask anything about hosting, bookings, payments. People here answer fast.'],
        ['Host Corner', 'Pricing, growth, what actually works — hosts only.'],
        ['General', 'Say hi in one line. Lowest-stakes first post you can make.'],
      ]) +
      lead('The first post is the hardest one. After that, this gets easy — promise.') +
      note('Prefer not to get these emails? <a href="{{website_url}}/unsubscribe?u={{unsubscribe_token}}" style="color:#7D6B70;">Unsubscribe</a>.'),
    cta_label: 'Open the community', cta_url: '{{community_url}}',
  }; })(),

  (() => { const t = themeForCategory('Community Update'); return {
    event_key: 'COMMUNITY_ONBOARD_HOW', audience: 'all', category: 'Community', sender_key: 'community',
    name: 'Community — How it works', subject: 'Three ways people use the community',
    preview_text: 'Post, ask, or start a thread — a small tour.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this email because you joined the Meeticulous community. To stop these emails, use the unsubscribe link in this email.',
    html_content:
      h('Three rhythms. Pick one.') +
      lead('Hi {{first_name}} — a quick tour so you do not have to figure it out from scratch.') +
      C.infoCard(t, [
        ['Post', 'Share one thing you figured out this week. A paragraph is enough.'],
        ['Ask', 'Stuck on something? Ask. Replies usually land within hours.'],
        ['Thread', 'Start an ongoing conversation that lives in a space.'],
      ]) +
      lead('You do not have to pick one and stick with it. Use whichever fits what you want to say today.') +
      note('Prefer not to get these emails? <a href="{{website_url}}/unsubscribe?u={{unsubscribe_token}}" style="color:#7D6B70;">Unsubscribe</a>.'),
    cta_label: 'Browse the spaces', cta_url: '{{community_url}}',
  }; })(),

  (() => { const t = themeForCategory('Community Update'); return {
    event_key: 'COMMUNITY_ONBOARD_HOT', audience: 'all', category: 'Community', sender_key: 'community',
    name: 'Community — Hot this week', subject: 'Three threads worth your time this week',
    preview_text: 'What is catching attention in the community right now.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this email because you joined the Meeticulous community. To stop these emails, use the unsubscribe link in this email.',
    html_content:
      h('What is catching attention') +
      lead('Hi {{first_name}} — three threads with real replies this week. Pick one, jump in if it is useful.') +
      C.infoCard(t, [
        ['{{hot1_title}}', 'by {{hot1_author}} · {{hot1_likes}} likes · {{hot1_replies}} replies'],
        ['{{hot2_title}}', 'by {{hot2_author}} · {{hot2_likes}} likes · {{hot2_replies}} replies'],
        ['{{hot3_title}}', 'by {{hot3_author}} · {{hot3_likes}} likes · {{hot3_replies}} replies'],
      ]) +
      lead('The quiet way to get known in the community is to leave one good reply a week. That is it.') +
      note('Prefer not to get these emails? <a href="{{website_url}}/unsubscribe?u={{unsubscribe_token}}" style="color:#7D6B70;">Unsubscribe</a>.'),
    cta_label: 'See all this week', cta_url: '{{community_url}}',
  }; })(),

  (() => { const t = themeForCategory('Community Update'); return {
    event_key: 'COMMUNITY_ONBOARD_FIRSTPOST', audience: 'all', category: 'Community', sender_key: 'community',
    name: 'Community — First-post nudge', subject: 'Your first post, {{first_name}}',
    preview_text: 'Three low-stakes ways to start. Pick the easiest.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this email because you joined the Meeticulous community and have not posted yet. To stop these emails, use the unsubscribe link in this email.',
    html_content:
      h('Your turn') +
      lead('Hi {{first_name}} — you have been reading for a week. The next good thread in here is one you start. No judgement, promise.') +
      C.infoCard(t, [
        ['Introduce yourself', 'One line in General. "Hi, I am {{first_name}}. I run sessions on X." That is the whole post.'],
        ['Ask the thing you Googled', 'If you Googled it last week, three other people here Googled it too.'],
        ['Share a small win', '"I tried X this week and Y happened." That counts as a post.'],
      ]) +
      lead('Most first posts get a reply within the hour. That is the whole point of this place.') +
      note('Stuck on what to write? Hit reply to this email — we will help you draft it.') +
      note('Prefer not to get these emails? <a href="{{website_url}}/unsubscribe?u={{unsubscribe_token}}" style="color:#7D6B70;">Unsubscribe</a>.'),
    cta_label: 'Open the community', cta_url: '{{community_url}}',
  }; })(),

  (() => { return {
    event_key: 'COMMUNITY_ONBOARD_WINDDOWN', audience: 'all', category: 'Community', sender_key: 'community',
    name: 'Community — Sequence wind-down', subject: 'Last note from onboarding, {{first_name}}',
    preview_text: 'We will stop writing. Come back whenever.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this email because you joined the Meeticulous community two weeks ago. This is the last message in the onboarding sequence.',
    html_content:
      h('One last note') +
      lead('Hi {{first_name}} — this is the last onboarding mail from us. You are still a member; we just do not want to keep landing in your inbox if the sequence is not useful to you.') +
      lead('You will still hear from us when someone replies to you or mentions you. Nothing else from this sequence.') +
      lead('The community is here whenever you want it. No pressure either way.') +
      note('Rather not get any community emails at all? <a href="{{website_url}}/unsubscribe?u={{unsubscribe_token}}" style="color:#7D6B70;">Unsubscribe</a>.'),
    cta_label: 'Open the community', cta_url: '{{community_url}}',
  }; })(),

  // ── Humanity track — festival + calendar greetings ────────────────────────────
  // All Founder frame, Shubham sender. Zero or soft CTA — the greeting IS the
  // email (see docs/email-playbook.md §Frames · Founder). One line of Hindi is
  // welcome; no inline translation.

  {
    event_key: 'GREETING_DIWALI', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Greeting — Diwali', subject: 'Diwali mubarak, {{first_name}}',
    preview_text: 'A quick note from Shubham, nothing to do.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you are on Meeticulous. Reply any time.',
    html_content:
      C.heroImage('greeting-diwali', 'A lit diya') +
      h('{{first_name}}, Diwali mubarak') +
      lead("A short note. Thank you for being on Meeticulous this year.") +
      lead("The work you do — a session, a class, a conversation — lights something up for the people who find you. Today a lot of us light diyas; whatever you light, light one more.") +
      lead("Phir milte hain."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GREETING_HOLI', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Greeting — Holi', subject: 'Happy Holi, {{first_name}}',
    preview_text: 'From all of us, a happy Holi.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you are on Meeticulous. Reply any time.',
    html_content:
      C.heroImage('greeting-holi', 'Colour-powder loops') +
      h('Happy Holi, {{first_name}}') +
      lead("Colour makes everything better for a day. Whatever yours looks like, hope it's a good one.") +
      lead("Back to bookings tomorrow. Enjoy today."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GREETING_EID', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Greeting — Eid', subject: 'Eid mubarak, {{first_name}}',
    preview_text: 'A short greeting from Shubham.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you are on Meeticulous. Reply any time.',
    html_content:
      C.heroImage('greeting-eid', 'Crescent moon and star') +
      h('Eid mubarak, {{first_name}}') +
      lead("A quiet note, no CTA. Thanks for being here. Celebrate well, rest well."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GREETING_CHRISTMAS', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Greeting — Christmas', subject: 'Merry Christmas, {{first_name}}',
    preview_text: 'A short note before the new year.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you are on Meeticulous. Reply any time.',
    html_content:
      C.heroImage('greeting-christmas', 'A small wreath') +
      h('Merry Christmas, {{first_name}}') +
      lead("Hope today is warm, slow and spent with people you want to spend it with.") +
      lead("We'll be around if you need us. Merry Christmas."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GREETING_NEWYEAR', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Greeting — New Year', subject: 'A new year, {{first_name}}',
    preview_text: 'A quick note before you start.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you are on Meeticulous. Reply any time.',
    html_content:
      C.heroImage('greeting-newyear', 'Three rising arcs') +
      h('Happy new year, {{first_name}}') +
      lead("Short one. Thanks for sharing a year with Meeticulous. Last year worked because of what you shipped on your page — your sessions, your classes, your consults. Here's to another one like that.") +
      lead("Aage dekhte hain."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GREETING_PONGAL_SANKRANTI', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Greeting — Pongal / Sankranti', subject: 'Happy Pongal, {{first_name}}',
    preview_text: 'Harvest season, new year, same wish from us.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you are on Meeticulous. Reply any time.',
    html_content:
      C.heroImage('greeting-pongal-sankranti', 'Harvest pot and wheat') +
      h('Happy Pongal, {{first_name}}') +
      lead("Harvest season looks different everywhere. Pongal, Sankranti, Bihu, Lohri — same beat. Hope yours is full of the people who make it matter."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GREETING_ONAM', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Greeting — Onam', subject: 'Happy Onam, {{first_name}}',
    preview_text: 'A short greeting for Thiru Onam.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you are on Meeticulous. Reply any time.',
    html_content:
      C.heroImage('greeting-onam', 'A simplified pookalam') +
      h('Happy Onam, {{first_name}}') +
      lead("Hope the sadya is good, the pookalam is better, and the week is spent with people you love."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GREETING_INDEPENDENCE_DAY', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Greeting — Independence Day', subject: 'On this day, a quick note',
    preview_text: 'A short note on 15 August.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you are on Meeticulous. Reply any time.',
    html_content:
      C.heroImage('greeting-independence-day', 'Three horizontal slots') +
      h('{{first_name}}, a short note') +
      lead("Today we get to do our own work, in our own voice, for people we chose. That's worth saying out loud once a year.") +
      lead("Thanks for building on Meeticulous. Jai Hind."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GREETING_REPUBLIC_DAY', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Greeting — Republic Day', subject: 'On this day, a quick note',
    preview_text: 'A short note on 26 January.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you are on Meeticulous. Reply any time.',
    html_content:
      C.heroImage('greeting-republic-day', 'Three slots on an arc') +
      h('Republic Day, {{first_name}}') +
      lead("Rules exist so people can do their own thing without asking. Keep doing yours."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GREETING_TEACHERS_DAY', audience: 'vendor', category: 'Celebrations', sender_key: 'shubham',
    name: "Greeting — Teachers' Day", subject: 'Thank you, {{first_name}}',
    preview_text: "A quick note on Teachers' Day.",
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you teach or coach on Meeticulous. Reply any time.',
    html_content:
      C.heroImage('greeting-teachers-day', 'An open book and a halo') +
      h('Thank you, {{first_name}}') +
      lead("Today is a thank-you, from this side of the platform to yours. Someone learned something they didn't know yesterday because of a session with you.") +
      lead("That is the whole product. Guru Dakshina is reading your replies — hit me back with one thing a student recently told you."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GREETING_MENTAL_HEALTH_DAY', audience: 'vendor', category: 'Celebrations', sender_key: 'shubham',
    name: 'Greeting — Mental Health Day', subject: 'A note on the work you do',
    preview_text: 'A quiet note from Shubham.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you do therapy / counselling work on Meeticulous. Reply any time.',
    html_content:
      C.heroImage('greeting-mental-health-day', 'A quiet potted plant') +
      h('{{first_name}}, a note') +
      lead("World Mental Health Day. I know the work you do is often invisible and almost always underpaid for what it actually does.") +
      lead("We built the booking side of Meeticulous so the quiet parts — scheduling, reminders, payouts — stop pulling at your attention. If any of it is still in your way, reply and tell me.") +
      lead("Take care of yourself today, too."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GREETING_YOGA_DAY', audience: 'vendor', category: 'Celebrations', sender_key: 'shubham',
    name: 'Greeting — Yoga Day', subject: 'Happy International Yoga Day',
    preview_text: 'A short note for 21 June.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you teach yoga on Meeticulous. Reply any time.',
    html_content:
      C.heroImage('greeting-yoga-day', 'Abstract seated figure') +
      h('Happy Yoga Day, {{first_name}}') +
      lead("A short note. Your sessions on Meeticulous have reached people on the other side of the country this year — that is a strange and good thing.") +
      lead("Enjoy the day. Teach one extra class today if you can."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GREETING_WOMENS_DAY', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: "Greeting — Women's Day", subject: 'A note, {{first_name}}',
    preview_text: 'A short note on 8 March.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you are on Meeticulous. Reply any time.',
    html_content:
      C.heroImage('greeting-womens-day', 'Three overlapping loops') +
      h('{{first_name}}, a short one') +
      lead("A lot of what Meeticulous runs on — the services, the voices, the hosts people come back for — is built by women. Today's a good day to say that plainly.") +
      lead("Thanks for being on this side of the internet."),
    cta_label: '', cta_url: '',
  },

  // ── Dormant / win-back track (sent by services/dormancyNudges.js) ──────────
  // Three stages escalating in voice and tone. All email-only, Founder frame.
  // 30d = soft nudge (Tithi), 60d = personal (Shubham), 90d = goodbye-or-stay.

  {
    event_key: 'HOST_DORMANT_30D', audience: 'vendor', category: 'Engagement', sender_key: 'tithi',
    name: 'Host — 30 days quiet', subject: 'Everything ok, {{first_name}}?',
    preview_text: "It's been a quiet month on your page.",
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you are a Meeticulous host and your page has had no bookings for 30 days.',
    html_content:
      h('Everything ok, {{first_name}}?') +
      lead("It's been a quiet month on your Meeticulous page — no new bookings in the last 30 days.") +
      lead("Sometimes life gets in the way, sometimes a page needs a refresh. Either way, we'd love to help if there's anything we can do — just reply to this email."),
    cta_label: 'Open my dashboard', cta_url: '{{dashboard_url}}',
  },

  {
    event_key: 'HOST_DORMANT_60D', audience: 'vendor', category: 'Engagement', sender_key: 'shubham',
    name: 'Host — 60 days quiet', subject: 'A note from Shubham',
    preview_text: "I noticed your page has been quiet — just checking in.",
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you are a Meeticulous host and your page has had no bookings for 60 days.',
    html_content:
      h('{{first_name}}, a quick note') +
      lead("It's been two months since your last booking on Meeticulous, so I figured I'd write.") +
      lead("I don't know what changed — the work, the audience, the platform. I'd like to. If you have five minutes, hit reply and tell me what's going on. I read every one of these.") +
      lead("No pitch. Just curious."),
    cta_label: 'Open my dashboard', cta_url: '{{dashboard_url}}',
  },

  {
    event_key: 'HOST_DORMANT_90D', audience: 'vendor', category: 'Engagement', sender_key: 'shubham',
    name: 'Host — 90 days quiet (final)', subject: 'Last note from me',
    preview_text: "Your page is still here whenever you are.",
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you are a Meeticulous host and your page has had no bookings for 90 days.',
    html_content:
      h('Last one, {{first_name}}') +
      lead("Three months. I'll stop writing after this.") +
      lead("Your page is still here — same link, same services, same rate. Come back whenever you're ready, or tell me to delete it. No wrong answer.") +
      lead("Thanks for trying Meeticulous. Reply any time."),
    cta_label: 'Open my dashboard', cta_url: '{{dashboard_url}}',
  },

  // ── Onboarding — start KYC (sent by services/activationNudges.js) ─────────────
  // Fires 2 days after signup if onboarding is still pending. Ladder frame:
  // 3 crisp steps, one deep link per step, no decorative hero.

  {
    event_key: 'HOST_START_KYC_NUDGE', audience: 'vendor', category: 'Onboarding', sender_key: 'tithi',
    name: 'Host — start KYC', subject: 'Finish your Meeticulous setup, {{first_name}}',
    preview_text: 'Three short steps and your booking page goes live.',
    email_category: 'Onboarding',
    email_reason: 'You are receiving this because you signed up as a Meeticulous host and have not completed setup.',
    html_content:
      h('Three short steps, {{first_name}}') +
      lead("Your Meeticulous page is almost ready. Finish these and it goes live.") +
      steps(
        step(1, 'Verify KYC', 'Quick ID check so we can send you payouts.'),
        step(2, 'Add your first service', 'Name it, price it — a line is enough.'),
        step(3, 'Share your link', 'Send it to one person who already books with you.'),
      ) +
      note('Takes under five minutes. Any trouble, just reply to this email.'),
    cta_label: 'Finish setup', cta_url: '{{link}}',
  },

  // ── Guest review nudge (sent by services/reviewNudges.js) ─────────────────────
  // Fires 48h after a completed paid booking with no review row.

  {
    event_key: 'GUEST_REVIEW_NUDGE', audience: 'all', category: 'Engagement', sender_key: 'tithi',
    name: 'Guest — review nudge', subject: 'How was your session with {{vendor_name}}?',
    preview_text: 'A few words go a long way for small creators.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you had a session on Meeticulous and have not left a review yet.',
    html_content:
      h('How was it, {{first_name}}?') +
      lead('You had a session with <strong>{{vendor_name}}</strong> two days ago. If it went well, two lines from you means a lot to a small creator.') +
      lead('If something was off, reply to this email instead — we read every one and we help sort it out.'),
    cta_label: 'Leave a review', cta_url: '{{review_url}}',
  },

  // ── Humanity track — human-moment events (PR-7) ───────────────────────────────
  // All Shubham, Founder frame. Detail-led openers that prove the email is real.

  {
    event_key: 'HOST_FIRST_REVIEW', audience: 'vendor', category: 'Celebrations', sender_key: 'shubham',
    name: 'Host — first review', subject: 'Someone said something nice about you',
    preview_text: 'Your first review is live, {{first_name}}.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because someone left a review for you on Meeticulous.',
    html_content:
      C.heroImage('moment-first-review', 'A quote bubble') +
      h('{{first_name}}, your first review is in') +
      lead('{{reviewer_first_name}} just left a review on your page. You can read it on your dashboard.') +
      lead("First ones mean the most. The stranger just told a future stranger you were worth it."),
    cta_label: 'Read it', cta_url: '{{dashboard_url}}',
  },

  {
    event_key: 'HOST_FIRST_FIVE_STAR', audience: 'vendor', category: 'Celebrations', sender_key: 'shubham',
    name: 'Host — first 5-star', subject: 'Your first five stars, {{first_name}}',
    preview_text: 'Your first 5-star review just landed.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you received a 5-star review on Meeticulous.',
    html_content:
      C.heroImage('moment-first-five-star', 'Five dots in a row') +
      h('Five stars, {{first_name}}') +
      lead("{{reviewer_first_name}} rated your session five stars. That's not a number — that's someone saying they'd send a friend to you.") +
      lead("Mubarak. Take the win."),
    cta_label: 'Read the review', cta_url: '{{dashboard_url}}',
  },

  {
    event_key: 'HOST_PERFECT_MONTH', audience: 'vendor', category: 'Celebrations', sender_key: 'shubham',
    name: 'Host — perfect month', subject: 'A perfect month, {{first_name}}',
    preview_text: '100% show-up in {{month_name}} — that is rare.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because every booking on your page in the last month was completed.',
    html_content:
      C.heroImage('moment-perfect-month', 'A calendar page, all filled') +
      h("A clean month, {{first_name}}") +
      lead("{{completed_count}} bookings in {{month_name}}. Zero no-shows. Zero cancellations.") +
      lead("This is harder than it looks. It means your reminders landed, your guests showed up, and whatever your session is — it was worth the trip."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'HOST_BOOKING_STREAK', audience: 'vendor', category: 'Celebrations', sender_key: 'shubham',
    name: 'Host — 3-week streak', subject: 'Three weeks in a row, {{first_name}}',
    preview_text: 'At least one booking every week for three weeks.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because your page took bookings three weeks in a row.',
    html_content:
      C.heroImage('moment-booking-streak', 'Three beats in a row') +
      h('Three weeks, {{first_name}}') +
      lead("At least one booking every week for the last three weeks on your Meeticulous page. That's a rhythm.") +
      lead("Keep it going. Reply if you want help pushing it to four."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'HOST_FIRST_REPEAT', audience: 'vendor', category: 'Celebrations', sender_key: 'shubham',
    name: 'Host — first repeat guest', subject: 'They came back, {{first_name}}',
    preview_text: '{{guest_first_name}} booked you again.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because a past guest booked you again on Meeticulous.',
    html_content:
      C.heroImage('moment-first-repeat', 'Two overlapping loops') +
      h('{{guest_first_name}} came back') +
      lead("{{guest_first_name}} just booked a second session with you. First repeat is the real signal — whatever you did the first time worked.") +
      lead("Welcome them back."),
    cta_label: 'Open the booking', cta_url: '{{dashboard_url}}',
  },

  {
    event_key: 'GUEST_EXPLORER_5_HOSTS', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Guest — explorer (5 hosts)', subject: 'Five hosts in, {{first_name}}',
    preview_text: "You've booked five different hosts on Meeticulous.",
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you have booked five different hosts on Meeticulous.',
    html_content:
      C.heroImage('moment-explorer', 'A compass of arcs') +
      h('Five hosts, {{first_name}}') +
      lead("You've booked five different hosts on Meeticulous. Most guests don't — most settle into one.") +
      lead("Thanks for exploring. If any of them is worth a friend knowing about, your words travel further than our ads do."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GUEST_COMEBACK', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Guest — comeback', subject: 'Good to see you again, {{first_name}}',
    preview_text: "Welcome back — it's been a while.",
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you returned to Meeticulous after a long break.',
    html_content:
      C.heroImage('moment-comeback', 'A soft returning arc') +
      h('Good to see you, {{first_name}}') +
      lead("It's been a while since your last booking on Meeticulous — and you just made another one. Noticed, and figured I'd write.") +
      lead("Nothing to do. Just wanted to say welcome back."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'GUEST_REVIEW_LANDED', audience: 'all', category: 'Celebrations', sender_key: 'shubham',
    name: 'Guest — review landed', subject: 'Your words reached them',
    preview_text: 'Your review of {{vendor_name}} is live.',
    email_category: 'Community Update',
    email_reason: "You are receiving this because your review is now live on the host's page.",
    html_content:
      C.heroImage('moment-review-landed', 'A paper-plane shape') +
      h('{{first_name}}, your words are live') +
      lead('Your review of <strong>{{vendor_name}}</strong> is now on their page. A future guest will read it and decide to try them.') +
      lead("That's the whole flywheel. Thank you."),
    cta_label: "See the host's page", cta_url: '{{host_url}}',
  },

  // ── Humanity track — empathy events (PR-8) ────────────────────────────────────
  // Shubham-sender, Founder frame, no CTA. These are notes, not nudges.

  {
    event_key: 'HOST_LOW_RATINGS_RUN', audience: 'vendor', category: 'Engagement', sender_key: 'shubham',
    name: 'Host — 3 low ratings', subject: 'Hey {{first_name}}, a private note',
    preview_text: 'Short, private. Just a check-in.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because of a change in review pattern on your Meeticulous page. This email is private to you.',
    html_content:
      h('{{first_name}}, a private note') +
      lead("Your last three reviews on Meeticulous came in at three stars or below. Could mean nothing. Could mean something to fix.") +
      lead("Not a nudge, not a performance email. If you want to look at it together — pricing, slot length, scheduling, whatever's in the way — hit reply and I'll set up a short call. On me.") +
      lead("Everything stays between us."),
    cta_label: '', cta_url: '',
  },

  {
    event_key: 'ACCOUNT_PAUSED_BY_USER', audience: 'vendor', category: 'Engagement', sender_key: 'shubham',
    name: 'Host — paused by user', subject: "We'll keep it safe, {{first_name}}",
    preview_text: 'Your page is paused. Come back anytime.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this because you paused your hosting page on Meeticulous.',
    html_content:
      h("We'll hold your spot, {{first_name}}") +
      lead("You paused your Meeticulous page. That's fine — things happen.") +
      lead("Nothing is deleted. Your link, services, reviews, history — all here when you're back. Flip hosting back on from your dashboard whenever that is: tomorrow, next month, next year.") +
      lead("Take care."),
    cta_label: '', cta_url: '',
  },

];

module.exports = TEMPLATES;
