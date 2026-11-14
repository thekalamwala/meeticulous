const { supabaseAdmin } = require('../config/supabase');

/**
 * Has this (event, recipient) notification already been logged?
 *
 * Matches `notification_logs` on its REAL columns — `event_key`, `destination`,
 * and an optional `dedupe_key` stamped into `payload` by notificationEngine for
 * per-entity nudges (one booking, one onboarding step per user). An optional
 * `sinceDays` bounds it to a recent window.
 *
 * FAILS CLOSED: if the check errors we report "already sent", so a broken query
 * can never cause a re-send storm. (The bug this replaces queried non-existent
 * columns — `event`, `metadata->>booking_id`, `recipient_user_id` — which errored
 * on every call, was read as "not sent", and re-sent every cron tick.)
 */
async function alreadyNotified({ event, destination, dedupeKey, sinceDays } = {}) {
  if (!event) return true;
  let q = supabaseAdmin.from('notification_logs').select('id').eq('event_key', event).limit(1);
  if (destination) q = q.eq('destination', destination);
  if (dedupeKey) q = q.eq('payload->>dedupe_key', dedupeKey);
  if (sinceDays) q = q.gte('created_at', new Date(Date.now() - sinceDays * 86400000).toISOString());
  const { data, error } = await q;
  if (error) return true;
  return Array.isArray(data) && data.length > 0;
}

module.exports = { alreadyNotified };
