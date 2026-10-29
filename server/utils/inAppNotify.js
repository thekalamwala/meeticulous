const { supabaseAdmin } = require("../config/supabase");
const { runInBackground } = require("./background");
const { broadcastTopic } = require("./realtimeBroadcast");
const { notifChannelTopic } = require("./notifChannel");

// Fire-and-forget in-app notification. Never throws into the request path —
// a feed write must not break a booking/review/payout mutation.
// role = which space the notification belongs to ('guest' | 'host').
//
// dedupeKey (optional): when set, skip the insert if a row with the same
// (user_id, dedupe_key) already exists. Stops re-runs (e.g. the confirmation
// reconciler re-firing a booking) from stacking duplicate bell rows. Callers
// that WANT a fresh note each period vary the key (include a date/week).
//
// After a successful insert, broadcast to the recipient's realtime topic so an
// open bell updates live instead of only on next poll/open (display-only ping —
// the client refetches the feed, the DB row stays the source of truth).
function inAppNotify({ userId, role = "guest", type, title, body = null, link = null, data = {}, dedupeKey = null }) {
  if (!userId || !type || !title) return;
  runInBackground("inAppNotify", async () => {
    if (dedupeKey) {
      const { data: existing } = await supabaseAdmin
        .from("in_app_notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("dedupe_key", dedupeKey)
        .limit(1)
        .maybeSingle();
      if (existing) return; // already notified — no-op
    }
    const { error } = await supabaseAdmin
      .from("in_app_notifications")
      .insert({ user_id: userId, role, type, title, body, link, data, dedupe_key: dedupeKey });
    if (error) {
      // Unique-index race: another emit inserted the same (user_id, dedupe_key)
      // first. Dedupe worked at the DB level — benign no-op, not a failure.
      if (error.code === "23505") return;
      // Schema fallback: a pre-v3.131 DB has no dedupe_key column. Retry the insert
      // without it so the notification still lands (dedupe just no-ops until migrated).
      if (dedupeKey && /dedupe_key|column .* does not exist|Could not find/i.test(error.message || "")) {
        const { error: retryErr } = await supabaseAdmin
          .from("in_app_notifications")
          .insert({ user_id: userId, role, type, title, body, link, data });
        if (retryErr) { console.error("inAppNotify insert failed:", retryErr.message); return; }
      } else {
        console.error("inAppNotify insert failed:", error.message);
        return;
      }
    }
    broadcastTopic(notifChannelTopic(userId), "notification", { role, type });
  });
}

// Resolve a prior actionable notification once the host has fixed the underlying
// problem (KYC re-approved, renewal re-charged, payout retried). Marks matching
// UNRESOLVED rows read + stamps resolved_at, so the notice stops "shouting" — the
// unread badge and any banner keyed on it clear. Match by type and/or dedupeKey.
// Fire-and-forget; never throws. Schema-fallback: with no resolved_at column it
// just marks the rows read.
function resolveInApp({ userId, type = null, dedupeKey = null }) {
  if (!userId || (!type && !dedupeKey)) return;
  runInBackground("resolveInApp", async () => {
    const nowIso = new Date().toISOString();
    let q = supabaseAdmin
      .from("in_app_notifications")
      .update({ read_at: nowIso, resolved_at: nowIso })
      .eq("user_id", userId)
      .is("resolved_at", null);
    if (type) q = q.eq("type", type);
    if (dedupeKey) q = q.eq("dedupe_key", dedupeKey);
    const { data, error } = await q.select("id");
    if (error) {
      // Schema fallback: pre-v3.132 DB has no resolved_at column — just mark read.
      if (/resolved_at|column .* does not exist|Could not find/i.test(error.message || "")) {
        let q2 = supabaseAdmin
          .from("in_app_notifications")
          .update({ read_at: nowIso })
          .eq("user_id", userId)
          .is("read_at", null);
        if (type) q2 = q2.eq("type", type);
        if (dedupeKey) q2 = q2.eq("dedupe_key", dedupeKey);
        await q2;
        broadcastTopic(notifChannelTopic(userId), "notification", { resolved: true, type });
        return;
      }
      console.error("resolveInApp failed:", error.message);
      return;
    }
    if (data && data.length) {
      broadcastTopic(notifChannelTopic(userId), "notification", { resolved: true, type });
    }
  });
}

module.exports = { inAppNotify, resolveInApp };
