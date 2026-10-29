// server/controllers/feedbackAdminController.js
// Admin triage for vendor feedback: list with filters, and a status pipeline
// that closes the loop by emailing the vendor on planned/shipped/declined.
const { supabaseAdmin } = require("../config/supabase");
const { safeError } = require("../utils/httpError");
const { sanitizeLikeTerm } = require("../utils/searchSanitize");
const { runInBackground } = require("../utils/background");
const NotificationEngine = require("../services/notificationEngine");

const STATUSES = ["new", "reviewing", "planned", "shipped", "declined"];
const NOTIFY_ON = new Set(["planned", "shipped", "declined"]);
const STATUS_LABELS = {
  planned: "planned", shipped: "shipped", declined: "declined",
  new: "received", reviewing: "under review",
};

// GET /api/admin/feedback — triage list with optional filters
const listFeedback = async (req, res) => {
  try {
    const { status, type, area, search } = req.query || {};
    let q = supabaseAdmin
      .from("feedback")
      .select("id, vendor_id, source, type, area, subject, body, status, admin_note, admin_response, created_at, updated_at, profiles:vendor_id(name, email)")
      .order("created_at", { ascending: false });

    if (status && STATUSES.includes(status)) q = q.eq("status", status);
    if (type) q = q.eq("type", type);
    if (area) q = q.eq("area", area);
    const safeSearch = sanitizeLikeTerm(search);
    if (safeSearch) q = q.ilike("body", `%${safeSearch}%`);

    const { data, error } = await q;
    if (error) return safeError(res, error);
    res.json({ feedback: data || [] });
  } catch (error) {
    safeError(res, error);
  }
};

// PATCH /api/admin/feedback/:id — set status / note / response; close the loop
const updateFeedbackStatus = async (req, res) => {
  try {
    const { status, admin_note, admin_response } = req.body || {};
    if (!STATUSES.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const patch = {
      status,
      handled_by: req.admin.id,
      handled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (admin_note !== undefined) patch.admin_note = admin_note;
    if (admin_response !== undefined) patch.admin_response = admin_response;

    const { data, error } = await supabaseAdmin
      .from("feedback")
      .update(patch)
      .eq("id", req.params.id)
      .select("id, vendor_id, status, subject, admin_response, profiles:vendor_id(name, email)")
      .single();

    if (error) return safeError(res, error);
    if (!data) return res.status(404).json({ message: "Feedback not found" });

    // Close the loop: notify the vendor when the item reaches a decision state.
    if (NOTIFY_ON.has(status) && data.profiles?.email) {
      runInBackground("feedback-status-notify", () =>
        NotificationEngine.send({
          event: "FEEDBACK_STATUS_CHANGED",
          data: {
            email: data.profiles.email,
            name: data.profiles.name,
            audience: "vendor",
            recipientUserId: data.vendor_id,
            emailData: {
              status_label: STATUS_LABELS[status] || status,
              feedback_subject: data.subject || "your feedback",
              admin_response: data.admin_response || "",
            },
          },
        }),
      );
    }

    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { listFeedback, updateFeedbackStatus, STATUSES };
