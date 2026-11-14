'use strict';

/**
 * empathyScans.js — the private-note track (PR-8).
 *
 * Today's active scan:
 *   HOST_LOW_RATINGS_RUN   when a host's last 3 reviews are all <= 3 stars.
 *                          One-time per host, deduped forever on
 *                          notification_logs.
 *
 * ACCOUNT_PAUSED_BY_USER lives on notification_events (v3.197) with its
 * template authored, but the trigger stays deferred: profiles has no
 * host_paused_at column today, so there is no honest way to tell "paused"
 * from "never a host". A follow-up PR adds the column + the trigger (fires
 * from the pause handler, not a scan).
 *
 * SAFETY — double-gated:
 *   1. feature_flag `empathy_track` (default OFF, seeded in v3.197),
 *   2. per-event is_active/email_enabled (ON in v3.197).
 * Plus quiet-hours 09–20 IST.
 *
 * The scan reads reviews, groups by host, orders by created_at DESC, and
 * only fires when the three most recent are all <= 3 stars. A host with
 * fewer than 3 reviews is ignored. Firing is forever-deduped because this
 * event is an invitation — sending it again every 3 bad reviews would
 * stop reading as private.
 */
const { supabaseAdmin } = require('../config/supabase');
const { isFeatureEnabled } = require('./featureFlags');
const notificationEngine = require('./notificationEngine');
const { alreadyNotified } = require('../utils/notificationDedupe');

const DEDUPE_DAYS = 365 * 5; // effectively forever
const LOW_STAR = 3;

function withinQuietHours(now = new Date()) {
  const istHour = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000).getHours();
  return istHour >= 9 && istHour < 20;
}

const firstName = (full) => (full || '').trim().split(/\s+/)[0] || 'there';

async function alreadySent(event, email) {
  if (!email) return true;
  return alreadyNotified({ event, destination: email, sinceDays: DEDUPE_DAYS });
}

/** Pure: given a host's reviews sorted newest-first, decide if the last 3 are all low. */
function isLowRatingsRun(ratingsDesc, lowStar = LOW_STAR) {
  if (!Array.isArray(ratingsDesc) || ratingsDesc.length < 3) return false;
  return ratingsDesc.slice(0, 3).every((r) => Number(r) <= lowStar);
}

async function runLowRatingsScan() {
  const { data: rows, error } = await supabaseAdmin
    .from('reviews')
    .select('host_id, rating, created_at')
    .not('host_id', 'is', null)
    .order('created_at', { ascending: false });
  if (error || !rows) return { processed: 0, skipped: 0 };

  // Bucket by host, preserving DESC order.
  const byHost = new Map();
  for (const r of rows) {
    if (!byHost.has(r.host_id)) byHost.set(r.host_id, []);
    byHost.get(r.host_id).push(Number(r.rating));
  }

  let processed = 0, skipped = 0;
  for (const [hostId, ratings] of byHost) {
    if (!isLowRatingsRun(ratings)) { skipped++; continue; }
    const { data: host } = await supabaseAdmin.from('profiles')
      .select('id, name, email, is_internal, is_banned').eq('id', hostId).maybeSingle();
    if (!host || host.is_internal || host.is_banned || !host.email) { skipped++; continue; }

    if (await alreadySent('HOST_LOW_RATINGS_RUN', host.email)) { skipped++; continue; }

    await notificationEngine.send({
      event: 'HOST_LOW_RATINGS_RUN',
      data: {
        email: host.email,
        name: firstName(host.name),
        audience: 'vendor',
        emailData: { first_name: firstName(host.name) },
        recipientUserId: host.id,
      },
    });
    processed++;
  }
  return { processed, skipped };
}

async function runEmpathyScans() {
  if (!(await isFeatureEnabled('empathy_track'))) return { skipped: 'flag_off' };
  if (!withinQuietHours())                        return { skipped: 'quiet_hours' };
  return runLowRatingsScan();
}

module.exports = { runEmpathyScans, isLowRatingsRun, firstName };
