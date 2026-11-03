// Platform reviews — signed-in hosts/guests reviewing Meeticulous itself (v3.185).
// Not the per-booking guest <-> host `reviews` (see reviewController.js).
//
// Trust model: every review belongs to a real signed-in profile (one per account).
// Nothing is public until an admin approves it AND the author ticked consent for
// public/marketing use. An edit sends the review back to 'pending'.
const { supabaseAdmin } = require("../config/supabase");
const { safeError } = require("../utils/httpError");

const MAX_TITLE = 120;
const MIN_BODY = 10;
const MAX_BODY = 2000;
const STATUSES = ["pending", "approved", "rejected"];
const PUBLIC_MAX = 100;

// Pre-migration DB: table missing → public reads degrade to empty, not 500.
const isMissingTable = (e) => e && (e.code === "42P01" || e.code === "PGRST205");

// GET /api/platform-reviews/me — the caller's own review (or null)
const getMine = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("platform_reviews").select("*").eq("user_id", req.user.id).maybeSingle();
    if (error) return safeError(res, error);
    res.json(data || null);
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/platform-reviews/me — create or edit the caller's review
const saveMine = async (req, res) => {
  try {
    const { rating, title, body, consent_public } = req.body || {};
    if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5)
      return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
    const cleanBody = String(body || "").trim();
    if (cleanBody.length < MIN_BODY || cleanBody.length > MAX_BODY)
      return res.status(400).json({ message: `Review must be ${MIN_BODY}–${MAX_BODY} characters` });
    const cleanTitle = String(title || "").trim();
    if (cleanTitle.length > MAX_TITLE)
      return res.status(400).json({ message: `Headline is too long (max ${MAX_TITLE} chars)` });

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles").select("is_host, role").eq("id", req.user.id).maybeSingle();
    if (pErr) return safeError(res, pErr);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const consent = consent_public === true;
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("platform_reviews")
      .upsert({
        user_id: req.user.id,
        reviewer_role: profile.is_host === true || profile.role === "host" ? "host" : "guest",
        rating: Number(rating),
        title: cleanTitle || null,
        body: cleanBody,
        consent_public: consent,
        consented_at: consent ? now : null,
        // Any edit goes back through moderation before it can be public again.
        status: "pending",
        moderated_at: null,
        moderated_by: null,
        updated_at: now,
      }, { onConflict: "user_id" })
      .select().single();
    if (error) return safeError(res, error);
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/platform-reviews — public: approved + consented reviews and their summary
const listPublic = async (req, res) => {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from("platform_reviews")
      .select("id, user_id, reviewer_role, rating, title, body, created_at")
      .eq("status", "approved").eq("consent_public", true)
      .order("created_at", { ascending: false })
      .limit(PUBLIC_MAX);
    if (isMissingTable(error)) return res.json({ reviews: [], count: 0, average: null });
    if (error) return safeError(res, error);

    const list = rows || [];
    const ids = list.map((r) => r.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, name, username, profile_image, profession").in("id", ids)
      : { data: [] };
    const pMap = new Map((profiles || []).map((p) => [p.id, p]));

    // Public shape only — never phone/email. Username/profession only for hosts
    // (a host's public page is the "verified" link; guests have none).
    const reviews = list.map(({ user_id, ...r }) => {
      const p = pMap.get(user_id) || {};
      const host = r.reviewer_role === "host";
      return {
        ...r,
        name: p.name || (host ? "Meeticulous host" : "Meeticulous guest"),
        avatar: p.profile_image || null,
        username: host ? p.username || null : null,
        profession: host ? p.profession || null : null,
      };
    });
    const average = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;
    res.set("Cache-Control", "public, max-age=300");
    res.json({ reviews, count: reviews.length, average });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /admin/platform-reviews?status= — moderation queue (newest first)
const adminList = async (req, res) => {
  try {
    let q = supabaseAdmin.from("platform_reviews").select("*").order("created_at", { ascending: false }).limit(200);
    if (STATUSES.includes(req.query.status)) q = q.eq("status", req.query.status);
    const { data: rows, error } = await q;
    if (error) return safeError(res, error);

    const ids = (rows || []).map((r) => r.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, name, username, email, phone").in("id", ids)
      : { data: [] };
    const pMap = new Map((profiles || []).map((p) => [p.id, p]));
    res.json((rows || []).map((r) => ({ ...r, author: pMap.get(r.user_id) || null })));
  } catch (error) {
    safeError(res, error);
  }
};

// PATCH /admin/platform-reviews/:id { status?, admin_note? }
const adminModerate = async (req, res) => {
  try {
    const { status, admin_note } = req.body || {};
    if (status !== undefined && !STATUSES.includes(status))
      return res.status(400).json({ message: `status must be one of ${STATUSES.join(", ")}` });
    const patch = { moderated_at: new Date().toISOString(), moderated_by: req.admin.id };
    if (status !== undefined) patch.status = status;
    if (admin_note !== undefined) patch.admin_note = admin_note;

    const { data, error } = await supabaseAdmin
      .from("platform_reviews").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return safeError(res, error);
    if (!data) return res.status(404).json({ message: "Review not found" });
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { getMine, saveMine, listPublic, adminList, adminModerate };
