'use strict';
/**
 * testimonialController — host-authored "proof wall" quotes (v3.212).
 *
 * Hosts import praise they already have and show it on their public profile.
 * These are HOST-AUTHORED, not verified booking reviews — kept entirely apart
 * from the `reviews` table so they never touch the public star rating /
 * aggregateRating (see reviewController.getHostReviews).
 *
 * Host CRUD is scoped by req.user.id. The public read is by username.
 * FREE hosts are capped at FREE_CAP testimonials; Pro is unlimited.
 *
 * Schema-fallback safe: until migration v3.212 is applied, reads return an
 * empty list and writes 503 gracefully, so the feature is dormant/harmless.
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const planService = require('../services/planService');

const FREE_CAP = 3;
const MAX_QUOTE = 2000;
const MAX_NAME = 120;
const MAX_ROLE = 160;

// A missing table/column = migration not applied yet → treat as "dormant".
const isMissingSchema = (error) =>
  !!error && /relation .* does not exist|Could not find the|column .* does not exist|schema cache/i.test(error.message || '');

const clean = (v, max) => {
  const s = String(v == null ? '' : v).trim();
  return s.length > max ? s.slice(0, max) : s;
};

// Shape the host sends → row columns. Only the writable fields.
const toRow = (b) => ({
  quote: clean(b.quote, MAX_QUOTE),
  author_name: clean(b.author_name, MAX_NAME),
  author_role: b.author_role ? clean(b.author_role, MAX_ROLE) : null,
  author_image_url: b.author_image_url ? clean(b.author_image_url, 500) : null,
  sort_order: Number.isFinite(Number(b.sort_order)) ? parseInt(b.sort_order, 10) : 0,
});

// GET /api/host/testimonials — the host's own testimonials
const listMyTestimonials = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('host_testimonials')
      .select('*')
      .eq('host_id', req.user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      if (isMissingSchema(error)) return res.json([]); // dormant until migration applied
      return safeError(res, error);
    }
    return res.json(data || []);
  } catch (e) { return safeError(res, e); }
};

// POST /api/host/testimonials — create one (free hosts capped at FREE_CAP)
const createTestimonial = async (req, res) => {
  try {
    const row = toRow(req.body || {});
    if (!row.quote) return res.status(400).json({ message: 'A quote is required.' });
    if (!row.author_name) return res.status(400).json({ message: 'An author name is required.' });

    // Free-tier cap. Pro (any non-free slug) is unlimited.
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('plan, plan_expires_at').eq('id', req.user.id).single();
    if (planService.isFreeSlug(planService.resolveVendorPlan(profile || {}))) {
      const { count, error: cErr } = await supabaseAdmin
        .from('host_testimonials')
        .select('id', { count: 'exact', head: true })
        .eq('host_id', req.user.id);
      if (cErr && isMissingSchema(cErr)) return res.status(503).json({ message: 'Testimonials are not available yet.' });
      if (!cErr && (count || 0) >= FREE_CAP) {
        return res.status(409).json({ message: `Free plan is limited to ${FREE_CAP} testimonials. Upgrade to Pro for unlimited.`, code: 'FREE_LIMIT' });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('host_testimonials')
      .insert({ ...row, host_id: req.user.id })
      .select().single();
    if (error) {
      if (isMissingSchema(error)) return res.status(503).json({ message: 'Testimonials are not available yet.' });
      return safeError(res, error);
    }
    return res.status(201).json(data);
  } catch (e) { return safeError(res, e); }
};

// PUT /api/host/testimonials/:id
const updateTestimonial = async (req, res) => {
  try {
    const row = toRow(req.body || {});
    if (!row.quote) return res.status(400).json({ message: 'A quote is required.' });
    if (!row.author_name) return res.status(400).json({ message: 'An author name is required.' });
    const { data, error } = await supabaseAdmin
      .from('host_testimonials')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('host_id', req.user.id)
      .select().single();
    if (error) {
      if (isMissingSchema(error)) return res.status(503).json({ message: 'Testimonials are not available yet.' });
      return safeError(res, error);
    }
    if (!data) return res.status(404).json({ message: 'Testimonial not found.' });
    return res.json(data);
  } catch (e) { return safeError(res, e); }
};

// DELETE /api/host/testimonials/:id
const deleteTestimonial = async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('host_testimonials')
      .delete().eq('id', req.params.id).eq('host_id', req.user.id);
    if (error) {
      if (isMissingSchema(error)) return res.json({ ok: true }); // nothing to delete; stay graceful
      return safeError(res, error);
    }
    return res.json({ ok: true });
  } catch (e) { return safeError(res, e); }
};

// GET /api/host/:username/testimonials — public proof wall
const getPublicTestimonials = async (req, res) => {
  try {
    const { data: host } = await supabaseAdmin
      .from('profiles').select('id').eq('username', req.params.username).single();
    if (!host) return res.status(404).json({ message: 'Host not found' });

    const { data, error } = await supabaseAdmin
      .from('host_testimonials')
      .select('id, quote, author_name, author_role, author_image_url, created_at')
      .eq('host_id', host.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      if (isMissingSchema(error)) return res.json([]); // dormant until migration applied
      return safeError(res, error);
    }
    return res.json(data || []);
  } catch (e) { return safeError(res, e); }
};

module.exports = {
  listMyTestimonials, createTestimonial, updateTestimonial, deleteTestimonial,
  getPublicTestimonials, FREE_CAP,
};
