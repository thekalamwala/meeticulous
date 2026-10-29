const { supabaseAdmin } = require("../config/supabase");
const { safeError } = require("../utils/httpError");
const { notifChannelTopic } = require("../utils/notifChannel");

// GET /api/notifications/channel — the caller's own realtime topic for the bell.
// HMAC-derived (not the raw user id), so it can't be guessed from a user id.
const channel = (req, res) => {
  res.json({ topic: notifChannelTopic(req.user.id) });
};

// GET /api/notifications?role=guest|host — current user's feed for a role.
const list = async (req, res) => {
  try {
    const role = req.query.role === "host" ? "host" : "guest";
    const { data, error } = await supabaseAdmin
      .from("in_app_notifications")
      .select("id, type, title, body, link, data, read_at, created_at")
      .eq("user_id", req.user.id).eq("role", role)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return safeError(res, error);
    const unreadCount = (data || []).filter((n) => !n.read_at).length;
    res.json({ notifications: data || [], unreadCount });
  } catch (e) { safeError(res, e); }
};

// POST /api/notifications/read-all?role=guest|host
const markAllRead = async (req, res) => {
  try {
    const role = req.query.role === "host" ? "host" : "guest";
    const { error } = await supabaseAdmin
      .from("in_app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", req.user.id).eq("role", role).is("read_at", null);
    if (error) return safeError(res, error);
    res.json({ ok: true });
  } catch (e) { safeError(res, e); }
};

// PATCH /api/notifications/:id/read
const markRead = async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("in_app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", req.params.id).eq("user_id", req.user.id);
    if (error) return safeError(res, error);
    res.json({ ok: true });
  } catch (e) { safeError(res, e); }
};

module.exports = { list, markAllRead, markRead, channel };
