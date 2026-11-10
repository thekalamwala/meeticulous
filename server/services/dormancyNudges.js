'use strict';

/**
 * dormancyNudges.js — host dormant / win-back track (30 / 60 / 90 days).
 *
 * Reads vendor_metrics.inactive_days and fires one of three
 * NotificationEngine events per host, deduped on notification_logs.
 *
 *   30d  HOST_DORMANT_30D  tithi   "Everything ok?"           (soft nudge)
 *   60d  HOST_DORMANT_60D  shubham "A note from me"           (personal)
 *   90d  HOST_DORMANT_90D  shubham "Last note from me"        (final)
 *
 * SAFETY — double-gated, sends nothing until BOTH are flipped on:
 *   1. feature flag `dormant_nudges` (default OFF — this whole job no-ops),
 *   2. per-event notification_events.is_active / email_enabled
 *      (seeded ON in v3.193 so flipping the flag alone turns the track live).
 * Plus: quiet-hours 09–20 IST, 60-day per-host-per-event dedupe
 * (notification_logs), internal/test accounts excluded, opt-out honoured
 * inside the engine.
 *
 * Only hosts with completed_bookings >= 1 qualify — a host who never had
 * a booking is an activation problem, not a dormancy one (that track is
 * services/activationNudges.js).
 */
const { supabaseAdmin } = require('../config/supabase');
const { isFeatureEnabled } = require('./featureFlags');
const notificationEngine = require('./notificationEngine');

const DEDUPE_DAYS = 60;

// stage → event, window (inclusive from, exclusive to). The windows do not
// overlap; a host only ever matches one stage per run.
const STAGES = [
  { event: 'HOST_DORMANT_30D', from: 30,  to: 60  },
  { event: 'HOST_DORMANT_60D', from: 60,  to: 90  },
  { event: 'HOST_DORMANT_90D', from: 90,  to: 120 },
];

// 09:00–20:00 Asia/Kolkata (IST = UTC+5:30), regardless of server TZ.
function withinQuietHours(now = new Date()) {
  const istHour = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000).getHours();
  return istHour >= 9 && istHour < 20;
}

async function alreadyNudged(event, email) {
  if (!email) return true; // no address = cannot send = count as already handled
  const since = new Date(Date.now() - DEDUPE_DAYS * 24 * 3600 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from('notification_logs')
    .select('id')
    .eq('event', event)
    .eq('destination', email)
    .gte('created_at', since)
    .limit(1);
  return !!(data && data.length);
}

function stageFor(inactiveDays) {
  return STAGES.find((s) => inactiveDays >= s.from && inactiveDays < s.to) || null;
}

async function runDormancyNudges() {
  if (!(await isFeatureEnabled('dormant_nudges'))) return { skipped: 'flag_off' };
  if (!withinQuietHours()) return { skipped: 'quiet_hours' };

  // vendor_metrics is the computed view (inactive_days, completed_bookings
  // already set). Join profiles for name + email + internal filter.
  const { data: rows, error } = await supabaseAdmin
    .from('vendor_metrics')
    .select('vendor_id, inactive_days, completed_bookings')
    .gte('inactive_days', 30)
    .lt('inactive_days', 120)
    .gte('completed_bookings', 1);
  if (error || !rows) return { skipped: 'query_failed' };

  let processed = 0, skipped = 0;

  for (const row of rows) {
    const stage = stageFor(row.inactive_days);
    if (!stage) { skipped++; continue; }

    const { data: p } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, phone, is_internal')
      .eq('id', row.vendor_id)
      .maybeSingle();
    if (!p || p.is_internal || !p.email) { skipped++; continue; }

    if (await alreadyNudged(stage.event, p.email)) { skipped++; continue; }

    const firstName = (p.name || '').trim().split(/\s+/)[0] || 'there';
    const dashboardUrl = `${process.env.CLIENT_URL || 'https://meeticulous.com'}/dashboard`;

    await notificationEngine.send({
      event: stage.event,
      data: {
        email: p.email,
        phone: p.phone || undefined,
        name: firstName,
        audience: 'vendor',
        // AiSensy template params: see docs/aisensy-template-spec.md.
        // Dormant 30d/60d: {{1}} = first name, {{2}} = dashboard deep link.
        // 90d stays email-only (whatsapp_enabled=false on the event row).
        templateParams: [firstName, dashboardUrl],
        emailData: { first_name: firstName, dashboard_url: dashboardUrl },
        recipientUserId: p.id,
      },
    });
    processed++;
  }
  return { processed, skipped };
}

module.exports = { runDormancyNudges, stageFor };
