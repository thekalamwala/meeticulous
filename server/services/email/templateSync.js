/**
 * templateSync.js — keep the `email_templates` DB rows in step with the copy in
 * config/emailTemplates.js, without clobbering edits made in the admin editor.
 *
 * Emails are SENT from the DB rows, but the copy is WRITTEN in code, so the two
 * drift unless someone re-seeds (2026-11-03: 22 of 54 live rows were stale and 4
 * were missing). This runs on every production boot (server.js) and from
 * scripts/seedEmailTemplates.js.
 *
 * How admin edits survive: each row remembers `seed_hash` — the hash of the
 * content this sync last wrote (v3.187). Per active (event_key, audience) row:
 *   - missing                    → insert from code
 *   - content == code            → nothing to do (stamp seed_hash if unset)
 *   - content == its seed_hash   → untouched since our last write → update to code
 *   - anything else              → edited in admin (or never tracked) → KEEP, log
 * `force` overwrites the last case too (the old seed-script behaviour).
 *
 * A failing row is logged and skipped, never thrown. Schema-fallback safe: with
 * no seed_hash column the sync skips entirely, so nothing is overwritten before
 * v3.187 is applied.
 */
const crypto = require('crypto');
const { supabaseAdmin } = require('../../config/supabase');

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
  ['PRO_TASTE_STARTED', 'Pro Taste — Started'],
  ['PRO_TASTE_ENDING', 'Pro Taste — Ending Soon'],
  ['PRO_TASTE_ENDED', 'Pro Taste — Ended'],
  ['FOUNDING_SPOTS_LOW', 'Upgrade — Founding Spots Low'],
  ['BOOKING_ABANDONED_CUSTOMER', 'Abandoned Booking — Recover'],
  ['GUEST_TO_HOST_INVITE', 'Guest → Host Invite'],
  ['BIRTHDAY', 'Birthday'],
  ['ACCOUNT_ANNIVERSARY', 'Account Anniversary'],
  ['NEWSLETTER_WELCOME', 'Newsletter Welcome'],
  ['HOST_DORMANT_30D', 'Host — 30 days quiet'],
  ['HOST_DORMANT_60D', 'Host — 60 days quiet'],
  ['HOST_DORMANT_90D', 'Host — 90 days quiet (final)'],
  ['HOST_START_KYC_NUDGE', 'Host — start KYC'],
  ['GUEST_REVIEW_NUDGE', 'Guest — review nudge'],
];

// The fields this sync owns. Order is part of the hash — changing it re-hashes
// every row, which reads as "edited" and freezes them until a --force run.
const FIELDS = ['name', 'category', 'subject', 'preview_text', 'html_content',
  'cta_label', 'cta_url', 'email_category', 'email_reason', 'sender_key'];

const toRow = (t) => ({
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
});

const templateHash = (r) => crypto.createHash('sha256')
  .update(JSON.stringify(FIELDS.map((f) => r[f] ?? '')))
  .digest('hex');

const isMissingColumn = (e) => /seed_hash|does not exist|Could not find the/i.test(e?.message || '');

/**
 * @param {object}   [opts]
 * @param {object[]} [opts.templates] defaults to config/emailTemplates.js
 * @param {boolean}  [opts.force]     overwrite admin-edited rows too
 * @returns {Promise<{inserted:number, updated:number, unchanged:number, kept:string[], skipped?:string}>}
 */
async function syncTemplates({ templates = require('../../config/emailTemplates'), force = false } = {}) {
  const out = { inserted: 0, updated: 0, unchanged: 0, kept: [] };

  const { data: rows, error } = await supabaseAdmin
    .from('email_templates')
    .select(`id, event_key, audience, seed_hash, ${FIELDS.join(', ')}`)
    .eq('status', 'active');
  if (error) {
    if (isMissingColumn(error)) return { ...out, skipped: 'seed_hash column missing (apply v3.187)' };
    throw error;
  }
  const byKey = new Map((rows || []).map((r) => [`${r.event_key}|${r.audience}`, r]));

  for (const t of templates) {
    const row = toRow(t);
    const label = `${row.event_key}/${row.audience}`;
    const codeHash = templateHash(row);
    const existing = byKey.get(`${row.event_key}|${row.audience}`);
    try {
      if (!existing) {
        const { error: e } = await supabaseAdmin.from('email_templates')
          .insert({ ...row, status: 'active', seed_hash: codeHash, updated_at: new Date().toISOString() });
        if (e) throw e;
        out.inserted++;
        continue;
      }
      const rowHash = templateHash(existing);
      if (rowHash === codeHash) {
        if (existing.seed_hash !== codeHash) {
          const { error: e } = await supabaseAdmin.from('email_templates')
            .update({ seed_hash: codeHash }).eq('id', existing.id);
          if (e) throw e;
        }
        out.unchanged++;
        continue;
      }
      if (!force && existing.seed_hash !== rowHash) {
        out.kept.push(label);
        continue;
      }
      const { error: e } = await supabaseAdmin.from('email_templates')
        .update({ ...row, seed_hash: codeHash, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (e) throw e;
      out.updated++;
    } catch (e) {
      console.error(`templateSync ${label}:`, e.message);
    }
  }

  // Register email-only events in the channel registry (insert-only).
  for (const [event_key, display_name] of EMAIL_ONLY_EVENTS) {
    const { error: e } = await supabaseAdmin.from('notification_events').upsert(
      { event_key, display_name, whatsapp_enabled: false, email_enabled: true, is_active: true },
      { onConflict: 'event_key', ignoreDuplicates: true },
    );
    if (e && !/duplicate/i.test(e.message)) console.warn(`templateSync event ${event_key}: ${e.message}`);
  }

  if (out.inserted || out.updated) require('./communicationEngine').clearCache();
  return out;
}

module.exports = { syncTemplates, templateHash, toRow, EMAIL_ONLY_EVENTS };
