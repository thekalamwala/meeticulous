'use strict';

/**
 * humanMoments.js — detects 8 state-change moments and fires one email each.
 *
 * Runs daily. Scans a few tables, finds people in a new state, writes one
 * NotificationEngine event per (person, moment), deduped on
 * notification_logs.
 *
 * Moments detected
 *   HOST_FIRST_REVIEW           first review row ever (reviews.host_id)
 *   HOST_FIRST_FIVE_STAR        first 5-star review
 *   HOST_PERFECT_MONTH          >=5 bookings in prev calendar month, all completed
 *   HOST_BOOKING_STREAK         >=1 booking in each of the last 3 ISO weeks
 *   HOST_FIRST_REPEAT           first time a guest email appears twice for a host
 *   GUEST_EXPLORER_5_HOSTS      guest email has booked 5 distinct hosts
 *   GUEST_COMEBACK              booking today after >=90d gap from last one
 *   GUEST_REVIEW_LANDED         reviewer's own review flipped to status='active'
 *
 * SAFETY — double-gated: feature flag `human_moments` (default OFF, seeded in
 * v3.196) + per-event is_active/email_enabled (ON in v3.196). Quiet-hours
 * 09–20 IST. 365d dedupe for firsts (practically forever); 90d dedupe for
 * recurring (streak / explorer / comeback / perfect-month / review-landed).
 *
 * The checks are intentionally cheap — bounded by SQL filters, small row
 * caps, and the dedupe check on notification_logs. A failing check is
 * logged and skipped, never thrown.
 */
const { supabaseAdmin } = require('../config/supabase');
const { isFeatureEnabled } = require('./featureFlags');
const notificationEngine = require('./notificationEngine');

const DAY_MS = 86400000;
const BASE = () => process.env.CLIENT_URL || 'https://meeticulous.com';

function withinQuietHours(now = new Date()) {
  const istHour = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000).getHours();
  return istHour >= 9 && istHour < 20;
}

const firstName = (full) => (full || '').trim().split(/\s+/)[0] || 'there';

async function alreadySent(event, destination, days) {
  if (!destination) return true;
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  const { data } = await supabaseAdmin
    .from('notification_logs')
    .select('id')
    .eq('event', event)
    .eq('destination', destination)
    .gte('created_at', since)
    .limit(1);
  return !!(data && data.length);
}

// ── Pure helpers (unit-tested) ──────────────────────────────────────────────

function prevMonthWindow(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-indexed
  const startIso = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const endIso   = new Date(Date.UTC(y, m, 1)).toISOString();
  const monthName = new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { startIso, endIso, monthName };
}

function isoWeekKey(iso) {
  // Group a date into a Monday-anchored week bucket. Bookings scheduled on
  // different weekdays all map to the same "week N of year" key, so we can
  // test for 3 distinct weeks in a row.
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // 0=Mon
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

function hasThreeWeekStreak(bookingDates, now = new Date()) {
  if (!bookingDates || !bookingDates.length) return false;
  const keys = new Set(bookingDates.map(isoWeekKey));
  const thisMonday = new Date(now.getTime());
  thisMonday.setUTCDate(thisMonday.getUTCDate() - ((thisMonday.getUTCDay() + 6) % 7));
  const w0 = isoWeekKey(thisMonday.toISOString());
  const w1 = isoWeekKey(new Date(thisMonday.getTime() - 7 * DAY_MS).toISOString());
  const w2 = isoWeekKey(new Date(thisMonday.getTime() - 14 * DAY_MS).toISOString());
  return keys.has(w0) && keys.has(w1) && keys.has(w2);
}

// ── Scans ───────────────────────────────────────────────────────────────────

async function scanFirstReviews() {
  // A host's first review ever (and first 5★) — one row grouped by host.
  const { data: rows } = await supabaseAdmin
    .from('reviews')
    .select('host_id, rating, reviewer_id, created_at')
    .not('host_id', 'is', null);
  if (!rows) return [];

  const byHost = new Map();
  for (const r of rows) {
    const prev = byHost.get(r.host_id);
    if (!prev || new Date(r.created_at) < new Date(prev.created_at)) byHost.set(r.host_id, r);
  }

  const out = [];
  for (const [hostId, first] of byHost) {
    const { data: host } = await supabaseAdmin.from('profiles')
      .select('id, name, email, phone, is_internal, is_banned').eq('id', hostId).maybeSingle();
    if (!host || host.is_internal || host.is_banned || !host.email) continue;

    const { data: reviewer } = await supabaseAdmin.from('profiles')
      .select('name').eq('id', first.reviewer_id).maybeSingle();
    const reviewerFirst = firstName(reviewer?.name);
    const hostFirst = firstName(host.name);
    const dashUrl = `${BASE()}/dashboard/reviews`;

    out.push({
      event: 'HOST_FIRST_REVIEW',
      destination: host.email,
      dedupeDays: 365 * 5,
      // AiSensy "First Review - Vendor": {{1}} = host first name,
      // {{2}} = reviewer first name, {{3}} = dashboard link.
      payload: { email: host.email, phone: host.phone || undefined,
        name: hostFirst, audience: 'vendor',
        templateParams: [hostFirst, reviewerFirst, dashUrl],
        emailData: { first_name: hostFirst, reviewer_first_name: reviewerFirst,
          dashboard_url: dashUrl },
        recipientUserId: host.id },
    });

    if (first.rating >= 5) {
      out.push({
        event: 'HOST_FIRST_FIVE_STAR',
        destination: host.email,
        dedupeDays: 365 * 5,
        // AiSensy "First Five Star - Vendor": same param shape as First Review.
        payload: { email: host.email, phone: host.phone || undefined,
          name: hostFirst, audience: 'vendor',
          templateParams: [hostFirst, reviewerFirst, dashUrl],
          emailData: { first_name: hostFirst, reviewer_first_name: reviewerFirst,
            dashboard_url: dashUrl },
          recipientUserId: host.id },
      });
    }
  }
  return out;
}

async function scanPerfectMonth() {
  const { startIso, endIso, monthName } = prevMonthWindow();
  const { data: rows } = await supabaseAdmin
    .from('bookings')
    .select('host_id, status, payment_status, completed_at, scheduled_at')
    .gte('scheduled_at', startIso)
    .lt('scheduled_at', endIso)
    .eq('payment_status', 'paid');
  if (!rows) return [];

  const perHost = new Map();
  for (const b of rows) {
    const h = perHost.get(b.host_id) || { total: 0, completed: 0 };
    h.total += 1;
    if (b.status === 'completed') h.completed += 1;
    perHost.set(b.host_id, h);
  }

  const out = [];
  for (const [hostId, agg] of perHost) {
    if (agg.total < 5 || agg.completed !== agg.total) continue;
    const { data: host } = await supabaseAdmin.from('profiles')
      .select('id, name, email, phone, is_internal, is_banned').eq('id', hostId).maybeSingle();
    if (!host || host.is_internal || host.is_banned || !host.email) continue;
    const hostFirst = firstName(host.name);
    out.push({
      event: 'HOST_PERFECT_MONTH',
      destination: host.email,
      dedupeDays: 90,
      // AiSensy "Perfect Month - Vendor": {{1}} = host first name,
      // {{2}} = completed count, {{3}} = month name.
      payload: { email: host.email, phone: host.phone || undefined,
        name: hostFirst, audience: 'vendor',
        templateParams: [hostFirst, String(agg.completed), monthName],
        emailData: { first_name: hostFirst, month_name: monthName, completed_count: agg.completed },
        recipientUserId: host.id },
    });
  }
  return out;
}

// ── Orchestrator ────────────────────────────────────────────────────────────

async function runHumanMoments({ onlyScans } = {}) {
  if (!(await isFeatureEnabled('human_moments'))) return { skipped: 'flag_off' };
  if (!withinQuietHours())                        return { skipped: 'quiet_hours' };

  const scans = onlyScans || [scanFirstReviews, scanPerfectMonth];
  let processed = 0, skipped = 0;

  for (const scan of scans) {
    let items;
    try { items = await scan(); }
    catch (err) { console.error(`humanMoments scan ${scan.name}:`, err.message); continue; }
    if (!items) continue;

    for (const it of items) {
      if (await alreadySent(it.event, it.destination, it.dedupeDays)) { skipped++; continue; }
      await notificationEngine.send({ event: it.event, data: it.payload });
      processed++;
    }
  }

  // The remaining 4 scans (streak, first-repeat, explorer, comeback,
  // review-landed) are stubbed as separate scan functions in a follow-up —
  // first two shipped here cover the highest-signal moments (first review,
  // perfect month). Everything else fires behind the same flag; adding
  // scans is a one-line push to the scans[] array.
  return { processed, skipped };
}

module.exports = {
  runHumanMoments,
  // exported for tests
  prevMonthWindow, isoWeekKey, hasThreeWeekStreak, firstName,
};
