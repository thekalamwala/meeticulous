'use strict';

/**
 * profileCompletion.js — pull stalled hosts back to publish (Tithi).
 *
 * A host who claimed a URL but never published (onboarding_completed=false) was
 * never nudged. This emails them once they've been stalled > STALL_HOURS, and
 * again a few days later, then stops. Dedup per host per window via email_logs.
 * No migration. Never throws.
 */

const { supabaseAdmin } = require('../config/supabase');
const NotificationEngine = require('./notificationEngine');

const EVENT = 'PROFILE_COMPLETION_REMINDER';
const STALL_HOURS = Number(process.env.PROFILE_STALL_HOURS) || 24;
const REMIND_EVERY_DAYS = Number(process.env.PROFILE_REMIND_EVERY_DAYS) || 3;
const MAX_REMINDERS = Number(process.env.PROFILE_MAX_REMINDERS) || 2;
const DAY_MS = 86400000;

async function reminderState(email) {
  // Count how many we've sent, and whether one went out inside the window.
  const windowStart = new Date(Date.now() - REMIND_EVERY_DAYS * DAY_MS).toISOString();
  const { data } = await supabaseAdmin
    .from('email_logs').select('id, created_at').eq('event_key', EVENT).eq('recipient', email);
  const list = data || [];
  const recent = list.some((r) => r.created_at && r.created_at > windowStart);
  return { count: list.length, recent };
}

async function processProfileCompletion() {
  try {
    const stalledBefore = new Date(Date.now() - STALL_HOURS * 3600000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, username, onboarding_slug, onboarding_completed, is_host, updated_at')
      .eq('is_host', true).eq('onboarding_completed', false)
      .lt('updated_at', stalledBefore)
      .limit(500);
    if (error) { console.error('profile completion scan:', error.message); return { sent: 0 }; }

    let sent = 0;
    for (const p of rows || []) {
      if (!p.email) continue;
      const st = await reminderState(p.email);
      if (st.recent || st.count >= MAX_REMINDERS) continue;

      const base = process.env.CLIENT_URL || 'https://bookasloth.com';
      await NotificationEngine.send({
        event: EVENT,
        data: {
          email: p.email, name: p.name,
          emailUser: { name: p.name, email: p.email, username: p.username },
          emailData: {
            first_name: (p.name || '').split(' ')[0] || 'there',
            slug: p.onboarding_slug || p.username || '',
            dashboard_url: `${base}/dashboard`,
          },
          recipientUserId: p.id,
        },
      });
      sent++;
    }
    if (sent) console.log(`Profile completion: sent ${sent} reminder(s)`);
    return { sent };
  } catch (err) {
    console.error('profile completion (non-fatal):', err.message);
    return { sent: 0 };
  }
}

module.exports = { processProfileCompletion, EVENT, STALL_HOURS };
