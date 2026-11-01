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
      lead('{{vendor_name}} is expecting you. Everything you need is below.') +
      C.bookingCard({ title: '{{service_name}}', sub: 'with {{vendor_name}}', rows: [['Date', '{{booking_date}}'], ['Time', '{{booking_time}}'], ['Where', '{{location}}']] }) +
      note('Your GST tax invoice is ready — <a href="{{invoice_url}}" style="color:#960D32;font-weight:600;text-decoration:none">view or download the PDF</a>. It is also under My Bookings in your dashboard.'),
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
      lead("You've received a new booking. Please review your schedule.") +
      C.bookingCard({ title: '{{service_name}}', sub: 'with {{user_name}}', rows: [['Date', '{{booking_date}}'], ['Time', '{{booking_time}}'], ['Where', '{{location}}']] }),
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
    html_content:
      h('Your booking was cancelled') +
      lead('The following booking has been cancelled:') +
      C.banner(t, { title: '{{service_name}}', sub: '{{booking_date}} at {{booking_time}} · with {{vendor_name}}' }) +
      note('Questions? Reach us at {{support_email}}.'),
    cta_label: 'Book again', cta_url: '{{dashboard_url}}',
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
      h('You earned a badge, {{first_name}}!') +
      C.celebration(t, { title: '{{badge_name}}' }) +
      lead('{{badge_description}}'),
    cta_label: 'See my badges', cta_url: '{{profile_url}}/badges',
  }; })(),

  // ── Milestones ───────────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Achievement Unlocked'); return {
    event_key: 'MILESTONE_FIRST_BOOKING', audience: 'all', category: 'Badge', sender_key: 'shubham',
    name: 'Milestone — First Booking', subject: 'Your first booking on Meeticulous!',
    preview_text: 'You just landed your first booking.',
    email_category: 'Achievement Unlocked',
    email_reason: 'You are receiving this email because you reached a booking milestone on Meeticulous.',
    html_content:
      h('Your first booking, {{first_name}}!') +
      C.celebration(t, { title: 'First booking' }) +
      lead('Congratulations on your first booking. This is the start of something good.'),
    cta_label: 'View dashboard', cta_url: '{{dashboard_url}}',
  }; })(),

  (() => { const t = themeForCategory('Achievement Unlocked'); return {
    event_key: 'MILESTONE_10_BOOKINGS', audience: 'all', category: 'Badge', sender_key: 'news',
    name: 'Milestone — 10 Bookings', subject: '10 bookings and counting!',
    preview_text: "You've reached {{milestone_value}} bookings.",
    email_category: 'Achievement Unlocked',
    email_reason: 'You are receiving this email because you reached a booking milestone on Meeticulous.',
    html_content:
      h('10 bookings, {{first_name}}!') +
      C.celebration(t, { title: '{{milestone_value}} bookings' }) +
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
      h('50 bookings!') +
      C.celebration(t, { title: '{{milestone_value}} bookings' }) +
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
      h('100 bookings, {{first_name}}!') +
      C.celebration(t, { title: '{{milestone_value}} bookings' }) +
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
      h("You're officially on {{plan_name}}, {{first_name}} 🎉") +
      C.celebration(t, { title: '{{plan_name}} — unlocked' }) +
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

  (() => { const t = themeForCategory('Payment Receipt'); return {
    event_key: 'REFERRAL_REWARD_RELEASED', sender_key: 'payments', audience: 'vendor', category: 'Payments',
    name: 'Referral Reward Released', subject: 'You earned a referral reward 🎉',
    preview_text: 'Your referral reward is now in your withdrawable balance.',
    email_category: 'Payment Receipt',
    email_reason: 'You are receiving this email because a referral reward was credited to your Meeticulous account.',
    html_content:
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
      h('Happy birthday, {{first_name}}!') +
      C.celebration(t, { title: 'Happy birthday!' }) +
      lead('Everyone at Meeticulous wishes you a wonderful day. Thanks for being part of our community.'),
    cta_label: '', cta_url: '',
  }; })(),

  (() => { const t = themeForCategory('Community Update'); return {
    event_key: 'ACCOUNT_ANNIVERSARY', audience: 'all', category: 'Celebrations',
    name: 'Account Anniversary', subject: "It's your Meeticulous anniversary!",
    preview_text: 'Celebrating another year with you.',
    email_category: 'Community Update',
    email_reason: 'You are receiving this email because you are a valued member of the Meeticulous community.',
    html_content:
      h('Happy anniversary, {{first_name}}!') +
      C.celebration(t, { title: 'Another year together' }) +
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
      h('Welcome to Meeticulous, {{first_name}}') +
      lead('Your account is ready. Three quick steps and clients can book and pay you — about 5 minutes in total.') +
      steps(
        step(1, 'Add your first service', 'Name, duration and price · 2 min'),
        step(2, 'Set your availability', 'The hours clients can book · 1 min'),
        step(3, 'Share your link', '{{profile_url}} · WhatsApp, Instagram bio'),
      ) +
      '<!--cta-->' +
      C.signOff('Tithi', 'Meeticulous team · just reply if you get stuck'),
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
      h('Welcome to Meeticulous, {{first_name}}') +
      lead("I'm Shubham, founder of Meeticulous. I started it because booking time with the people you actually want to meet should feel effortless — no back-and-forth, no friction.") +
      lead('Three ways to get started:') +
      `<ol style="margin:0 0 18px;padding-left:20px;font-size:16px;line-height:1.7;color:#4A3A3E;font-family:'Poppins','Plus Jakarta Sans',Arial,sans-serif;">` +
        `<li><a href="{{website_url}}/explore" style="color:{{brand_color}};font-weight:600;text-decoration:none;">Explore creators</a> and find someone worth your time</li>` +
        `<li>Book your first session in a couple of taps</li>` +
        `<li>Manage everything from your bookings dashboard</li>` +
      `</ol>` +
      lead('<strong>P.S.</strong> What brought you here? Just hit reply and let me know — I read every email.') +
      lead('— Shubham<br/>Founder, Meeticulous'),
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
      h('{{payout_amount}} is on its way, {{first_name}}') +
      lead('Nice work. Your earnings from a completed booking have been released and are settling to your bank account now. Depending on your bank it usually lands within 1–2 working days (a little longer over holidays).') +
      C.amountRow(t, 'Paid to you', '{{payout_amount}}') +
      lead('You can see every payout and its status in your dashboard.'),
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
    html_content:
      h('A booking was refunded, {{first_name}}') +
      lead("One of your bookings was cancelled or refunded, so the {{payout_amount}} earning for it has been reversed and won't be paid out. Everything else you've earned is unaffected.") +
      C.amountRow(t, 'Reversed', '{{payout_amount}}') +
      lead('You can see the details in your transactions.'),
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
    event_key: 'GUEST_TO_HOST_INVITE', audience: 'all', category: 'Marketing', sender_key: 'news',
    name: 'Guest → Host Invite', subject: "You've booked {{completed_count}} times — ever thought about the other side?",
    preview_text: 'The people you booked earn on Meeticulous. Your account is ready.',
    email_category: 'Invitation',
    email_reason: 'You are receiving this email because you are a Meeticulous guest.',
    html_content:
      C.heroBand(t, { kick: "You've booked {{completed_count}} times, {{first_name}}", h2: 'Ever thought about the other side?', sub: 'The people you booked earn on Meeticulous. So could you.' }) +
      lead('You know how smooth booking is from this side. The hosts you paid use the exact same platform to <strong>get paid</strong> — a link they share, bookings that just show up.') +
      C.benefitGrid([{ icon: 'link.png', label: 'Share your link' }, { icon: 'calendar.png', label: 'Take bookings' }, { icon: 'wallet.png', label: 'Get paid' }]) +
      lead('Your account is <strong>already set up</strong> to host. No new signup — start free, no card.'),
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

  // ── Marketing ─────────────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Upgrade'); return {
    event_key: 'UPGRADE_COMMISSION_NUDGE', audience: 'all', category: 'Marketing', sender_key: 'news',
    name: 'Upgrade — Keep Every Rupee', subject: "You've given up {{commission_total}} in commission",
    preview_text: 'On Host+ that number is zero.',
    email_category: 'Upgrade',
    email_reason: 'You are receiving this because you are a Meeticulous host on the free plan.',
    html_content:
      C.heroBand(t, { kick: 'Commission given up', big: '{{commission_total}}', sub: "On Host+ that's ₹0, {{first_name}}." }) +
      lead("You've earned well — but the free plan takes <strong>5%</strong> of every booking. You've handed back <strong>{{commission_total}}</strong> across {{bookings_count}} bookings.") +
      C.compareRow(t, { leftLabel: 'Starter', leftPct: '5%', leftCap: 'per booking', rightLabel: 'Host+', rightPct: '0%', rightCap: 'you keep it all' }) +
      C.stars({ rating: 5, text: 'Hosts who upgraded keep every rupee they earn.' }),
    cta_label: 'Upgrade to 0% commission', cta_url: '{{upgrade_url}}',
  }; })(),

  // ── Newsletter ────────────────────────────────────────────────────────────────

  (() => { const t = themeForCategory('Newsletter'); return {
    event_key: 'NEWSLETTER_WELCOME', audience: 'all', category: 'Newsletter', sender_key: 'news',
    name: 'Newsletter Welcome', subject: 'Welcome to the Collective 🎉',
    preview_text: 'Practical tips, templates and honest lessons — straight to your inbox.',
    email_category: 'Newsletter',
    email_reason: 'You are receiving this email because you subscribed to the Meeticulous newsletter.',
    html_content:
      h("You're in.") +
      lead('Thanks for subscribing. Every week we send tips, templates and honest lessons on getting booked and paid.') +
      lead('No noise, no spam — just the good stuff.') +
      note('Not for you? You can unsubscribe any time using the link below.'),
    cta_label: 'Explore Meeticulous', cta_url: '{{website_url}}',
  }; })(),

];

module.exports = TEMPLATES;
