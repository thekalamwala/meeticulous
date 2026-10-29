// Reviews and ratings — bidirectional (guest <-> host).
// Either party can review the other once a booking is completed. A single
// `review_submission` feature flag gates submission in both directions.
const { supabaseAdmin } = require("../config/supabase");
const { safeError } = require('../utils/httpError');
const { inAppNotify } = require("../utils/inAppNotify");

// Ceiling for review lists. count/avg are computed over the returned rows, so
// these endpoints cap only (no offset paging) — capping the window would skew
// the average. No account is anywhere near this; it's a pathological-case guard.
const REVIEW_LIST_MAX = 500;

const DIRECTIONS = ["guest_to_host", "host_to_guest"];

// POST /api/reviews — submit a review for a completed booking
const createReview = async (req, res) => {
  try {
    const { booking_id, rating, comment } = req.body;
    const direction = req.body.direction || "guest_to_host";
    if (!booking_id || !rating)
      return res.status(400).json({ message: "booking_id and rating are required" });
    // Strict integer 1–5. The old `rating < 1 || rating > 5` let a non-numeric
    // value (NaN → both comparisons false) or a fractional one through, which
    // then poisons the reduce()-computed host average.
    if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5)
      return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
    if (!DIRECTIONS.includes(direction))
      return res.status(400).json({ message: "Invalid review direction" });

    const { data: booking, error: bErr } = await supabaseAdmin
      .from("bookings")
      .select("id, guest_id, host_id, status, service_id")
      .eq("id", booking_id)
      .single();

    if (bErr || !booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "completed")
      return res.status(400).json({ message: "You can only review a completed booking" });

    // Authorize by direction and resolve who is being reviewed (the subject).
    let subjectId;
    if (direction === "guest_to_host") {
      if (req.user.id !== booking.guest_id)
        return res.status(403).json({ message: "Only the guest can review the host for this booking" });
      subjectId = booking.host_id;
    } else {
      if (req.user.id !== booking.host_id)
        return res.status(403).json({ message: "Only the host can review the guest for this booking" });
      if (!booking.guest_id)
        return res.status(400).json({ message: "This guest booked without an account and can't be reviewed" });
      subjectId = booking.guest_id;
    }

    // One review per author per booking.
    const { data: existing } = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("booking_id", booking_id)
      .eq("reviewer_id", req.user.id)
      .maybeSingle();
    if (existing) return res.status(400).json({ message: "You have already reviewed this booking" });

    const { data: review, error } = await supabaseAdmin
      .from("reviews")
      .insert({
        booking_id,
        reviewer_id: req.user.id,
        host_id: booking.host_id,   // always the booking's host (used by host-profile queries)
        service_id: booking.service_id, // ties the review to the booked service (service-page rating)
        subject_id: subjectId,
        direction,
        rating,
        comment,
      })
      .select()
      .single();

    if (error) return safeError(res, error);

    // Badge evaluation only matters when the host is the one being reviewed.
    if (direction === "guest_to_host") {
      require("../services/badgeEngine")
        .evaluate({ vendorIds: [booking.host_id] })
        .catch((e) => console.error("Badge evaluation error:", e.message));
    }

    // In-app: notify the review subject.
    const subjectIsHost = direction === "guest_to_host";
    inAppNotify({
      userId: subjectId,
      role: subjectIsHost ? "host" : "guest",
      type: "REVIEW_RECEIVED",
      title: "New review received",
      body: `${rating}★`,
      // Host has no reviews page; land them on Clients. Guest keeps /user/reviews.
      link: subjectIsHost ? "/dashboard/clients" : "/user/reviews",
    });

    res.status(201).json(review);
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/reviews/booking/:id — author updates THEIR review for a booking.
const updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (rating != null && (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5))
      return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });

    const { data: existing } = await supabaseAdmin
      .from("reviews")
      .select("id, reviewer_id, host_id, direction")
      .eq("booking_id", req.params.id)
      .eq("reviewer_id", req.user.id)
      .maybeSingle();
    if (!existing) return res.status(404).json({ message: "No review to edit" });

    const patch = {};
    if (rating != null) patch.rating = rating;
    if (comment !== undefined) patch.comment = comment;

    const { data: review, error } = await supabaseAdmin
      .from("reviews").update(patch).eq("id", existing.id).select().single();
    if (error) return safeError(res, error);

    if (existing.direction === "guest_to_host") {
      require("../services/badgeEngine")
        .evaluate({ vendorIds: [existing.host_id] })
        .catch((e) => console.error("Badge evaluation error:", e.message));
    }
    res.json(review);
  } catch (error) { safeError(res, error); }
};

// GET /api/reviews/received — reviews the current user has RECEIVED (any direction)
const getReceivedReviews = async (req, res) => {
  try {
    let q = supabaseAdmin
      .from("reviews")
      .select("id, rating, comment, created_at, direction, profiles!reviews_reviewer_id_fkey(name, profile_image), bookings(services(title))")
      .eq("subject_id", req.user.id)
      .neq("status", "hidden");   // admin-hidden reviews are excluded from public reads
    const dir = req.query.direction;
    if (dir === "guest_to_host" || dir === "host_to_guest") q = q.eq("direction", dir);
    const { data: reviews, error } = await q
      .limit(REVIEW_LIST_MAX)
      .order("created_at", { ascending: false });

    if (error) return safeError(res, error);

    const count = reviews?.length || 0;
    const avg = count > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
      : 0;

    res.json({ reviews: reviews || [], count, avg });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/reviews/:username — public; reviews ABOUT a host (guest -> host only)
const getHostReviews = async (req, res) => {
  try {
    const { data: host } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", req.params.username)
      .single();

    if (!host) return res.status(404).json({ message: "Host not found" });

    const { data: reviews, error } = await supabaseAdmin
      .from("reviews")
      .select("id, rating, comment, created_at, profiles!reviews_reviewer_id_fkey(name, profile_image)")
      .eq("host_id", host.id)
      .eq("direction", "guest_to_host")
      .neq("status", "hidden")   // admin-hidden reviews are excluded from public reads
      .limit(REVIEW_LIST_MAX)
      .order("created_at", { ascending: false });

    if (error) return safeError(res, error);

    const count = reviews?.length || 0;
    const avg = count > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
      : 0;

    res.json({ reviews: reviews || [], count, avg });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/reviews/booking/:id — the CURRENT user's own review for a booking
// (used by the UI to show "you've already reviewed" state per party).
const getBookingReview = async (req, res) => {
  try {
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, guest_id, host_id")
      .eq("id", req.params.id)
      .single();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (req.user.id !== booking.guest_id && req.user.id !== booking.host_id) {
      return res.status(403).json({ message: "Not authorized to view this review" });
    }

    const { data, error } = await supabaseAdmin
      .from("reviews")
      .select("*")
      .eq("booking_id", req.params.id)
      .eq("reviewer_id", req.user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") return safeError(res, error);
    res.json(data || null);
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { createReview, updateReview, getReceivedReviews, getHostReviews, getBookingReview };
