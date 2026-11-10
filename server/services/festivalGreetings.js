'use strict';

/**
 * festivalGreetings.js — daily Humanity-track calendar sender.
 *
 * Reads today's rows from `calendar_events` (v3.195) and fires the
 * NotificationEngine event on each, scoped by audience_filter.
 *
 * audience_filter grammar:
 *   'all'                            → every opted-in user
 *   'profession:slug'                → hosts with profiles.profession = slug
 *   'profession:slug1,slug2'         → any of the listed professions
 *
 * SAFETY — double-gated, sends nothing until BOTH are flipped on:
 *   1. feature flag `festival_nudges` (default OFF, seeded v3.195),
 *   2. per-event notification_events.is_active / email_enabled (ON in v3.195).
 * Plus: quiet-hours 09–20 IST, 365-day per-event-per-user dedupe
 * (notification_logs — same greeting can't fire twice in a year), internal
 * accounts excluded, opt-out honoured inside the engine.
 *
 * Priority: festivals outrank milestone and nudge mail on collision —
 * the governor compares priority tags, not just time. For the first ship
 * this service only records the send; priority ordering lives in the
 * governor (future PR). On collision today the governor's 48h cap wins
 * and the lower-priority mail defers naturally.
 */
const { supabaseAdmin } = require('../config/supabase');
const { isFeatureEnabled } = require('./featureFlags');
const notificationEngine = require('./notificationEngine');

const DEDUPE_DAYS = 365;

function withinQuietHours(now = new Date()) {
  const istHour = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000).getHours();
  return istHour >= 9 && istHour < 20;
}

function todayIstDate() {
  // IST = UTC+5:30. Format as YYYY-MM-DD in IST so a 00:00 UTC cron on
  // day boundary still picks the right day for Indian users.
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  return ist.toISOString().slice(0, 10);
}

function parseFilter(audience_filter) {
  if (!audience_filter || audience_filter === 'all') return { kind: 'all' };
  if (audience_filter.startsWith('profession:')) {
    const slugs = audience_filter.slice('profession:'.length).split(',').map((s) => s.trim()).filter(Boolean);
    return { kind: 'profession', slugs };
  }
  return { kind: 'unknown', raw: audience_filter };
}

async function alreadySent(event, email) {
  if (!email) return true;
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

async function recipientsFor(filter) {
  // Pre-filter in SQL where we can; final sanity + internal exclusion in code.
  let q = supabaseAdmin
    .from('profiles')
    .select('id, name, email, phone, profession, is_internal, is_banned')
    .not('email', 'is', null);
  if (filter.kind === 'profession' && filter.slugs.length) {
    q = q.in('profession', filter.slugs);
  }
  const { data, error } = await q.limit(10000);
  if (error || !data) return [];
  return data.filter((p) => !p.is_internal && !p.is_banned);
}

async function runFestivalGreetings({ dateOverride } = {}) {
  if (!(await isFeatureEnabled('festival_nudges'))) return { skipped: 'flag_off' };
  if (!withinQuietHours())                           return { skipped: 'quiet_hours' };

  const date = dateOverride || todayIstDate();
  const { data: rows, error } = await supabaseAdmin
    .from('calendar_events')
    .select('event_key, audience_filter')
    .eq('date', date)
    .eq('enabled', true);
  if (error || !rows || !rows.length) return { skipped: 'no_calendar_events', date };

  let processed = 0, skipped = 0;
  for (const row of rows) {
    const filter = parseFilter(row.audience_filter);
    if (filter.kind === 'unknown') { skipped++; continue; }

    const recipients = await recipientsFor(filter);
    for (const p of recipients) {
      if (await alreadySent(row.event_key, p.email)) { skipped++; continue; }
      const firstName = (p.name || '').trim().split(/\s+/)[0] || 'there';
      await notificationEngine.send({
        event: row.event_key,
        data: {
          email: p.email,
          phone: p.phone || undefined,
          name: firstName,
          audience: filter.kind === 'profession' ? 'vendor' : 'all',
          // AiSensy greeting templates all share the same shape: {{1}} = first name.
          templateParams: [firstName],
          emailData: { first_name: firstName },
          recipientUserId: p.id,
          metadata: { source: 'festivalGreetings', date },
        },
      });
      processed++;
    }
  }
  return { processed, skipped, date };
}

module.exports = { runFestivalGreetings, parseFilter, todayIstDate };
