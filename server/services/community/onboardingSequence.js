'use strict';

/**
 * onboardingSequence.js — community welcome + 4-step onboarding over 14 days.
 *
 * Instant piece: `sendWelcome(userId, profile)` fires COMMUNITY_WELCOME when
 * `acceptTerms` upserts the member row. Called inline from the controller.
 *
 * Scheduled piece: `runSweep()` reads community_members where created_at is in
 * the target windows and fires the matching event per step. One step per user
 * per day; per-event dedupe via notification_logs. Steps 4 + 5 extra-gated:
 * only fire if post_count + comment_count == 0 (sequence auto-ends on engagement).
 *
 * Steps + windows
 *   COMMUNITY_WELCOME            day 0  (inline, not in the sweep)
 *   COMMUNITY_ONBOARD_HOW        day 2  (>= 48h since created_at, < 72h)
 *   COMMUNITY_ONBOARD_HOT        day 5  (>= 120h, < 144h)
 *   COMMUNITY_ONBOARD_FIRSTPOST  day 9  (>= 216h, < 240h) + zero activity
 *   COMMUNITY_ONBOARD_WINDDOWN   day 14 (>= 336h, < 360h) + zero activity
 *
 * SAFETY — triple-gated:
 *   1. feature flag `community_email_onboarding` (OFF, seeded v3.202).
 *   2. per-event notification_events.is_active / email_enabled (ON in v3.202).
 *   3. `community_members.email_replies` must not be false.
 *
 * All sends fire-and-forget. A failure is logged, never thrown.
 */
const { supabaseAdmin } = require('../../config/supabase');
const { isFeatureEnabled } = require('../featureFlags');
const notificationEngine = require('../notificationEngine');
const { alreadyNotified } = require('../../utils/notificationDedupe');

const FLAG = 'community_email_onboarding';
const HOUR_MS = 3600 * 1000;

// Each step: eventKey, hoursLow, hoursHigh, requireZeroActivity.
// Windows sized at 24h so a daily sweep lands inside each exactly once.
const STEPS = [
  { event: 'COMMUNITY_ONBOARD_HOW',       low: 48,  high: 72,  requireZero: false },
  { event: 'COMMUNITY_ONBOARD_HOT',       low: 120, high: 144, requireZero: false },
  { event: 'COMMUNITY_ONBOARD_FIRSTPOST', low: 216, high: 240, requireZero: true  },
  { event: 'COMMUNITY_ONBOARD_WINDDOWN',  low: 336, high: 360, requireZero: true  },
];

const BASE = () => process.env.CLIENT_URL || 'https://meeticulous.com';
const firstName = (p) => (p?.is_host ? (p.name || '').trim().split(/\s+/)[0] : p?.first_name?.trim()) || 'there';

// Once per (event, user). notification_logs has no recipient_user_id column, so
// the send stamps `dedupe_key: <event>:<userId>` into payload and we match on it.
async function alreadySent(event, userId) {
  return alreadyNotified({ event, dedupeKey: `${event}:${userId}` });
}

function emailDataFor(event, profile) {
  // Placeholder for hot-this-week (COMMUNITY_ONBOARD_HOT). Real lookup lands
  // alongside the content copy pass — the template exposes 9 placeholders so
  // the resolver can fill them when they exist. If they are missing the row
  // still renders ("{{hot1_title}}" becomes empty via placeholderResolver).
  const base = { first_name: firstName(profile), community_url: `${BASE()}/community` };
  return base;
}

// Inline: called from controllers/communityController.js acceptTerms. The
// `isFirstAcceptance` flag lets us skip re-sending when a user re-accepts a
// future terms version (the acceptTerms upsert bumps terms_version only).
async function sendWelcome(profile, { isFirstAcceptance = true } = {}) {
  try {
    if (!profile?.email) return;
    if (!isFirstAcceptance) return;
    if (!(await isFeatureEnabled(FLAG))) return;
    if (await alreadySent('COMMUNITY_WELCOME', profile.id)) return;
    await notificationEngine.send({
      event: 'COMMUNITY_WELCOME',
      data: {
        email: profile.email,
        name: firstName(profile),
        audience: profile.is_host ? 'vendor' : 'customer',
        emailData: emailDataFor('COMMUNITY_WELCOME', profile),
        recipientUserId: profile.id,
        dedupeKey: `COMMUNITY_WELCOME:${profile.id}`,
      },
    });
  } catch (err) { console.error('[onboardingSequence.sendWelcome]', err.message); }
}

async function runSweep() {
  try {
    if (!(await isFeatureEnabled(FLAG))) return { skipped: 'flag_off' };
    const now = Date.now();
    let processed = 0, skipped = 0;

    for (const step of STEPS) {
      const sinceIso = new Date(now - step.high * HOUR_MS).toISOString();
      const untilIso = new Date(now - step.low  * HOUR_MS).toISOString();
      const { data: rows, error } = await supabaseAdmin
        .from('community_members')
        .select('user_id, created_at, email_replies, post_count, comment_count')
        .gte('created_at', sinceIso)
        .lt('created_at', untilIso);
      if (error || !rows) continue;

      for (const m of rows) {
        if (m.email_replies === false) { skipped++; continue; }
        if (step.requireZero && ((m.post_count || 0) + (m.comment_count || 0)) > 0) { skipped++; continue; }
        if (await alreadySent(step.event, m.user_id)) { skipped++; continue; }

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, email, name, first_name, is_host, is_banned')
          .eq('id', m.user_id)
          .maybeSingle();
        if (!profile || profile.is_banned || !profile.email) { skipped++; continue; }

        await notificationEngine.send({
          event: step.event,
          data: {
            email: profile.email,
            name: firstName(profile),
            audience: profile.is_host ? 'vendor' : 'customer',
            emailData: emailDataFor(step.event, profile),
            recipientUserId: profile.id,
            dedupeKey: `${step.event}:${profile.id}`,
          },
        });
        processed++;
      }
    }

    return { processed, skipped };
  } catch (err) {
    console.error('[onboardingSequence.runSweep]', err.message);
    return { skipped: 'error' };
  }
}

module.exports = { sendWelcome, runSweep, STEPS };
