/**
 * activationNudges.js — stage-based host activation nudges (WhatsApp/email).
 *
 * Reads the host_activation view (v3.161/162), maps each stall stage to a
 * NotificationEngine event, and sends via the existing engine (AiSensy + email).
 *
 * SAFETY — double-gated, sends nothing until BOTH are flipped on:
 *   1. feature flag `activation_nudges` (default OFF — this whole job no-ops),
 *   2. the per-event notification_events.is_active / whatsapp_enabled (all OFF,
 *      seeded in v3.163) — the engine itself won't send while those are false.
 * Plus: quiet-hours 09–20 IST, 14-day per-host-per-event dedupe (notification_logs),
 * internal/test accounts excluded, opt-out honoured inside the engine.
 *
 * WhatsApp template params (all events): [ firstName, deepLink ].
 */
const { supabaseAdmin } = require('../config/supabase');
const { isFeatureEnabled } = require('./featureFlags');
const notificationEngine = require('./notificationEngine');

const BASE = 'https://bookasloth.com';
const DEDUPE_DAYS = 14;

// stage → event + link builder. needsUsername = link points at the host's page.
const RULES = [
  { stage: '2_onboarded',  event: 'HOST_ADD_SERVICE_NUDGE',    needsUsername: false, link: () => `${BASE}/dashboard` },
  { stage: '3_listed',     event: 'HOST_SHARE_LINK_NUDGE',     needsUsername: true,  link: (u) => `${BASE}/${u}` },
  { stage: '3b_shared',    event: 'HOST_FIRST_BOOKING_NUDGE',  needsUsername: true,  link: (u) => `${BASE}/${u}`, minSharedDays: 7 },
  { stage: '5_paid',       event: 'HOST_PAYOUT_WAITING_NUDGE', needsUsername: false, link: () => `${BASE}/dashboard` },
];

// Only 09:00–20:00 Asia/Kolkata (IST = UTC+5:30), regardless of server TZ.
function withinQuietHours(now = new Date()) {
  const istHour = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000).getHours();
  return istHour >= 9 && istHour < 20;
}

async function alreadyNudged(event, phone) {
  const since = new Date(Date.now() - DEDUPE_DAYS * 24 * 3600 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from('notification_logs')
    .select('id')
    .eq('event', event)
    .eq('destination', phone)
    .gte('created_at', since)
    .limit(1);
  return !!(data && data.length);
}

async function runActivationNudges() {
  if (!(await isFeatureEnabled('activation_nudges'))) return { skipped: 'flag_off' };
  if (!withinQuietHours()) return { skipped: 'quiet_hours' };

  let processed = 0, skipped = 0;
  for (const rule of RULES) {
    const { data: rows, error } = await supabaseAdmin
      .from('host_activation')
      .select('host_id,name,email,phone,first_shared_at,stage')
      .eq('stage', rule.stage)
      .eq('is_internal', false)
      .not('phone', 'is', null);
    if (error || !rows) continue;

    for (const h of rows) {
      if (!h.phone) { skipped++; continue; }
      if (rule.minSharedDays && h.first_shared_at) {
        const ageDays = (Date.now() - new Date(h.first_shared_at).getTime()) / (24 * 3600 * 1000);
        if (ageDays < rule.minSharedDays) { skipped++; continue; }
      }
      if (await alreadyNudged(rule.event, h.phone)) { skipped++; continue; }

      let username = null;
      if (rule.needsUsername) {
        const { data: p } = await supabaseAdmin.from('profiles').select('username').eq('id', h.host_id).single();
        username = p?.username;
        if (!username) { skipped++; continue; }
      }
      const firstName = (h.name || '').trim().split(/\s+/)[0] || 'there';
      const link = rule.link(username);

      // Engine gates each channel on the event's is_active + whatsapp_enabled /
      // email_enabled (all OFF now → no-op). WhatsApp uses templateParams;
      // email renders the Tithi email_templates row (v3.164) with emailData vars.
      await notificationEngine.send({
        event: rule.event,
        data: {
          phone: h.phone,
          email: h.email || undefined,
          name: firstName,
          audience: 'vendor', // resolves the vendor email template + vendor layout shell
          templateParams: [firstName, link],
          emailData: { first_name: firstName, link },
          recipientUserId: h.host_id,
        },
      });
      processed++;
    }
  }
  return { processed, skipped };
}

module.exports = { runActivationNudges };
