/**
 * reviewAdminController.js — admin Reviews Moderation.
 *
 * Lists every platform review (both directions: guest→host and host→guest) with
 * the reviewer, subject, host and service resolved to display names, and lets an
 * admin change a review's moderation state or delete it outright.
 *
 * Moderation model (v3.64 reviews.status):
 *   visible  → shown everywhere (default for all existing rows)
 *   flagged  → still visible, queued for admin attention (ops "Reviews to moderate")
 *   hidden   → excluded from every public read (host profile, service page, etc.)
 *
 * Names are resolved with a single batched profiles lookup rather than PostgREST
 * FK embeds — subject_id / host_id do not carry named FK constraints, so a batch
 * `in()` is both simpler and immune to embed-alias drift.
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');

const PAGE_SIZE = 25;
const STATUSES = ['visible', 'flagged', 'hidden'];
const DIRECTIONS = ['guest_to_host', 'host_to_guest'];

// GET /admin/reviews?status=&direction=&rating=&search=&page=
const listReviews = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabaseAdmin
      .from('reviews')
      .select('id, booking_id, service_id, reviewer_id, subject_id, host_id, direction, rating, comment, status, admin_note, moderated_at, created_at', { count: 'exact' });

    if (STATUSES.includes(req.query.status)) q = q.eq('status', req.query.status);
    if (DIRECTIONS.includes(req.query.direction)) q = q.eq('direction', req.query.direction);
    const rating = parseInt(req.query.rating, 10);
    if (rating >= 1 && rating <= 5) q = q.eq('rating', rating);
    const search = (req.query.search || '').trim();
    if (search) q = q.ilike('comment', `%${search}%`);

    const { data: reviews, count, error } = await q
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) return safeError(res, error);

    const rows = reviews || [];

    // Batch-resolve every referenced profile + service in two queries.
    const profileIds = [...new Set(rows.flatMap(r => [r.reviewer_id, r.subject_id, r.host_id]).filter(Boolean))];
    const serviceIds = [...new Set(rows.map(r => r.service_id).filter(Boolean))];

    const [{ data: profiles }, { data: services }] = await Promise.all([
      profileIds.length
        ? supabaseAdmin.from('profiles').select('id, name, username, profile_image').in('id', profileIds)
        : Promise.resolve({ data: [] }),
      serviceIds.length
        ? supabaseAdmin.from('services').select('id, title').in('id', serviceIds)
        : Promise.resolve({ data: [] }),
    ]);

    const pMap = new Map((profiles || []).map(p => [p.id, p]));
    const sMap = new Map((services || []).map(s => [s.id, s]));

    const items = rows.map(r => ({
      id: r.id,
      booking_id: r.booking_id,
      direction: r.direction,
      rating: r.rating,
      comment: r.comment,
      status: r.status,
      admin_note: r.admin_note,
      moderated_at: r.moderated_at,
      created_at: r.created_at,
      reviewer: pMap.get(r.reviewer_id) || null,
      subject: pMap.get(r.subject_id) || null,
      host: pMap.get(r.host_id) || null,
      service: sMap.get(r.service_id) || null,
    }));

    res.json({ reviews: items, total: count || 0, page, pageSize: PAGE_SIZE });
  } catch (error) {
    safeError(res, error);
  }
};

// PATCH /admin/reviews/:id  { status?, admin_note? } — moderate a review.
const moderateReview = async (req, res) => {
  try {
    const { status, admin_note } = req.body;
    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({ message: `status must be one of ${STATUSES.join(', ')}` });
    }
    const patch = { moderated_at: new Date().toISOString(), moderated_by: req.admin.id };
    if (status !== undefined) patch.status = status;
    if (admin_note !== undefined) patch.admin_note = admin_note;

    const { data, error } = await supabaseAdmin
      .from('reviews').update(patch).eq('id', req.params.id).select().maybeSingle();
    if (error) return safeError(res, error);
    if (!data) return res.status(404).json({ message: 'Review not found' });
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// DELETE /admin/reviews/:id — permanently remove a review.
const deleteReview = async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('reviews').delete().eq('id', req.params.id);
    if (error) return safeError(res, error);
    res.json({ ok: true });
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { listReviews, moderateReview, deleteReview };
