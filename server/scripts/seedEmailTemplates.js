/**
 * seedEmailTemplates.js — idempotent upsert of all Communication Engine
 * templates (config/emailTemplates.js) and registration of their events in
 * notification_events so the channel registry + admin can manage them.
 *
 * Run: node scripts/seedEmailTemplates.js
 */
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');
const TEMPLATES = require('../config/emailTemplates');

// Events that should exist in the channel registry (email on, WhatsApp off
// unless an approved WhatsApp template already drives it elsewhere).
const EMAIL_ONLY_EVENTS = [
  ['AUTH_EMAIL_VERIFICATION', 'Email Verification'],
  ['SECURITY_PASSWORD_CHANGED', 'Password Changed'],
  ['SECURITY_LOGIN_ALERT', 'Login Alert'],
  ['BOOKING_COMPLETED_VENDOR', 'Booking Completed — Vendor'],
  ['PROFILE_COMPLETION_REMINDER', 'Profile Completion Reminder'],
  ['PROFILE_VERIFIED', 'Verification Approved'],
  ['PROFILE_REJECTED', 'Verification Rejected'],
  ['KYC_APPROVED', 'KYC Approved'],
  ['KYC_REJECTED', 'KYC Rejected'],
  ['BADGE_UNLOCKED', 'Badge Unlocked'],
  ['MILESTONE_FIRST_BOOKING', 'Milestone — First Booking'],
  ['MILESTONE_10_BOOKINGS', 'Milestone — 10 Bookings'],
  ['MILESTONE_50_BOOKINGS', 'Milestone — 50 Bookings'],
  ['MILESTONE_100_BOOKINGS', 'Milestone — 100 Bookings'],
  ['SUBSCRIPTION_PURCHASED', 'Premium Activated'],
  ['SUBSCRIPTION_EXPIRING', 'Premium Expiring'],
  ['SUBSCRIPTION_RENEWED', 'Premium Renewed'],
  ['VENDOR_WELCOME', 'Host Welcome'],
  ['GUEST_WELCOME', 'Guest Welcome'],
  ['KYC_EARN_NUDGE', 'First Earning — Payout Nudge'],
  ['PAYOUT_SENT', 'Payout — On The Way'],
  ['PAYOUT_VERIFICATION_NEEDED', 'Payout — Verification Needed'],
  ['PAYOUT_FAILED', 'Payout — Could Not Complete'],
  ['EARNING_REVERSED', 'Earning Reversed'],
  ['PAYOUT_DELAY_HOLIDAY', 'Payout — Bank Holiday Delay'],
  ['UPGRADE_COMMISSION_NUDGE', 'Upgrade — Keep Every Rupee'],
  ['BOOKING_ABANDONED_CUSTOMER', 'Abandoned Booking — Recover'],
  ['GUEST_TO_HOST_INVITE', 'Guest → Host Invite'],
  ['BIRTHDAY', 'Birthday'],
  ['ACCOUNT_ANNIVERSARY', 'Account Anniversary'],
  ['NEWSLETTER_WELCOME', 'Newsletter Welcome'],
];

async function upsertTemplate(t) {
  // Look for an existing active row for this (event_key, audience)
  const { data: existing } = await supabaseAdmin
    .from('email_templates')
    .select('id')
    .eq('event_key', t.event_key)
    .eq('audience', t.audience || 'all')
    .eq('status', 'active')
    .maybeSingle();

  const row = {
    event_key: t.event_key,
    audience: t.audience || 'all',
    name: t.name,
    category: t.category,
    subject: t.subject,
    preview_text: t.preview_text || '',
    html_content: t.html_content,
    cta_label: t.cta_label || '',
    cta_url: t.cta_url || '',
    email_category: t.email_category || '',
    email_reason: t.email_reason || '',
    sender_key: t.sender_key || null,
    status: 'active',
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabaseAdmin.from('email_templates').update(row).eq('id', existing.id);
    if (error) throw new Error(`update ${t.event_key}: ${error.message}`);
    return 'updated';
  }
  const { error } = await supabaseAdmin.from('email_templates').insert(row);
  if (error) throw new Error(`insert ${t.event_key}: ${error.message}`);
  return 'inserted';
}

async function registerEvent(event_key, display_name) {
  const { error } = await supabaseAdmin
    .from('notification_events')
    .upsert(
      { event_key, display_name, whatsapp_enabled: false, email_enabled: true, is_active: true },
      { onConflict: 'event_key', ignoreDuplicates: true }
    );
  if (error && !/duplicate/i.test(error.message)) {
    console.warn(`event ${event_key}: ${error.message}`);
  }
}

(async () => {
  let inserted = 0, updated = 0;
  for (const t of TEMPLATES) {
    const r = await upsertTemplate(t);
    if (r === 'inserted') inserted++; else updated++;
  }
  for (const [key, name] of EMAIL_ONLY_EVENTS) await registerEvent(key, name);

  console.log(`Email templates seeded: ${inserted} inserted, ${updated} updated (${TEMPLATES.length} total).`);
  console.log(`Registered ${EMAIL_ONLY_EVENTS.length} email events.`);
  process.exit(0);
})().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
