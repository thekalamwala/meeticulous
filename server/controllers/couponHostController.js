'use strict';
/**
 * couponHostController — a host manages their own discount codes (v3.204).
 * All endpoints are host-scoped (req.user.id) and gated by the `coupons` flag.
 * Applying a code at checkout lives in bookingController; this is CRUD only.
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const featureFlags = require('../services/featureFlags');

const CODE_RE = /^[A-Za-z0-9_-]{3,24}$/;
const flagOn = () => featureFlags.isFeatureEnabled('coupons');
const notEnabled = (res) => res.status(404).json({ message: 'Coupons are not enabled.' });

// POST /api/host/coupons
const createCoupon = async (req, res) => {
  try {
    if (!(await flagOn())) return notEnabled(res);
    const b = req.body || {};
    const code = String(b.code || '').trim();
    if (!CODE_RE.test(code)) return res.status(400).json({ message: 'Code must be 3–24 letters, numbers, - or _.' });
    if (!['percent', 'flat'].includes(b.discount_type)) return res.status(400).json({ message: 'discount_type must be "percent" or "flat".' });
    const val = Number(b.discount_value);
    if (!(val > 0)) return res.status(400).json({ message: 'discount_value must be greater than 0.' });
    if (b.discount_type === 'percent' && val > 100) return res.status(400).json({ message: 'A percent discount cannot exceed 100.' });

    const row = {
      host_id: req.user.id,
      code,
      discount_type: b.discount_type,
      discount_value: val,
      active: b.active !== false,
      expires_at: b.expires_at || null,
      max_redemptions: b.max_redemptions != null ? Math.max(1, parseInt(b.max_redemptions, 10) || 1) : null,
      min_amount: b.min_amount != null ? Math.max(0, Number(b.min_amount) || 0) : 0,
    };
    const { data, error } = await supabaseAdmin.from('coupons').insert(row).select().single();
    if (error) {
      if (/duplicate key|unique/i.test(error.message)) return res.status(409).json({ message: 'You already have a coupon with that code.' });
      return safeError(res, error);
    }
    return res.status(201).json(data);
  } catch (e) { return safeError(res, e); }
};

// GET /api/host/coupons
const listCoupons = async (req, res) => {
  try {
    if (!(await flagOn())) return notEnabled(res);
    const { data, error } = await supabaseAdmin
      .from('coupons').select('*').eq('host_id', req.user.id).order('created_at', { ascending: false });
    if (error) return safeError(res, error);
    return res.json(data || []);
  } catch (e) { return safeError(res, e); }
};

// PATCH /api/host/coupons/:id  { active }
const updateCoupon = async (req, res) => {
  try {
    if (!(await flagOn())) return notEnabled(res);
    if (typeof req.body?.active !== 'boolean') return res.status(400).json({ message: 'Only `active` can be toggled.' });
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .update({ active: req.body.active, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('host_id', req.user.id)
      .select().single();
    if (error || !data) return res.status(404).json({ message: 'Coupon not found.' });
    return res.json(data);
  } catch (e) { return safeError(res, e); }
};

// DELETE /api/host/coupons/:id — a used coupon is referenced by bookings (FK), so a
// hard delete would orphan that history; return 409 and tell the host to deactivate.
const deleteCoupon = async (req, res) => {
  try {
    if (!(await flagOn())) return notEnabled(res);
    const { error } = await supabaseAdmin
      .from('coupons').delete().eq('id', req.params.id).eq('host_id', req.user.id);
    if (error) {
      if (/foreign key|violates/i.test(error.message)) return res.status(409).json({ message: 'This coupon has been used on a booking — deactivate it instead of deleting.' });
      return safeError(res, error);
    }
    return res.json({ ok: true });
  } catch (e) { return safeError(res, e); }
};

module.exports = { createCoupon, listCoupons, updateCoupon, deleteCoupon };
