// server/controllers/feedbackController.js
// Vendor → platform feedback (Phase 1: spontaneous widget submissions).
// All access is server-side via the service-role client. Admin triage lives in
// feedbackAdminController.js.
const { supabaseAdmin } = require("../config/supabase");
const { safeError } = require("../utils/httpError");

const TYPES = ["idea", "bug", "complaint", "praise", "other"];
const AREAS = ["booking", "payments", "dashboard", "profile", "availability", "other"];
const MAX_BODY = 4000;
const MAX_SUBJECT = 160;

// POST /api/feedback — vendor submits feedback
const createFeedback = async (req, res) => {
  try {
    const { type, area, subject, body, screenshot_url, context } = req.body || {};

    if (!body || !String(body).trim())
      return res.status(400).json({ message: "Feedback body is required" });
    if (String(body).length > MAX_BODY)
      return res.status(400).json({ message: `Feedback is too long (max ${MAX_BODY} chars)` });
    if (!TYPES.includes(type))
      return res.status(400).json({ message: "Invalid feedback type" });
    if (area != null && !AREAS.includes(area))
      return res.status(400).json({ message: "Invalid feedback area" });
    if (subject != null && String(subject).length > MAX_SUBJECT)
      return res.status(400).json({ message: `Subject is too long (max ${MAX_SUBJECT} chars)` });

    const { data, error } = await supabaseAdmin
      .from("feedback")
      .insert({
        vendor_id: req.user.id,
        source: "widget",
        type,
        area: area || null,
        subject: subject ? String(subject).trim() : null,
        body: String(body).trim(),
        screenshot_url: screenshot_url || null,
        context: context || null,
        status: "new",
      })
      .select()
      .single();

    if (error) return safeError(res, error);
    res.status(201).json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/feedback/mine — the vendor's own submissions + current status
const getMyFeedback = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("feedback")
      .select("id, type, area, subject, body, status, admin_response, created_at, updated_at")
      .eq("vendor_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) return safeError(res, error);
    res.json({ feedback: data || [] });
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { createFeedback, getMyFeedback, TYPES, AREAS };
