'use strict';
/**
 * referralAdminController.js — admin config for Refer & Earn (v3.77).
 * "What's paid for what, per plan+cadence" (referral_reward_rules) plus a
 * read view of the referral ledger. Rules are edited live; planService cache
 * is unaffected (rules are read fresh per qualify).
 */
const { safeError } = require('../utils/httpError');
const { supabaseAdmin } = require('../config/supabase');
const { audit } = require('../services/auditService');

// GET /api/admin/referral-rules
const listRules = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('referral_reward_rules')
      .select('*')
      .order('referred_plan', { ascending: true })
      .order('cadence', { ascending: true });
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (e) { safeError(res, e); }
};

// PATCH /api/admin/referral-rules/:id
// { reward_type?, reward_value?, min_qualifying_charges?, hold_days?, monthly_cap?, active? }
const updateRule = async (req, res) => {
  try {
    const body = req.body || {};
    const patch = {};

    if ('reward_type' in body) {
      if (!['cash_inr', 'account_credit'].includes(body.reward_type)) {
        return res.status(400).json({ message: 'reward_type must be cash_inr or account_credit' });
      }
      patch.reward_type = body.reward_type;
    }
    if ('reward_value' in body) patch.reward_value = Math.max(0, Number(body.reward_value) || 0);
    if ('min_qualifying_charges' in body) patch.min_qualifying_charges = Math.max(1, parseInt(body.min_qualifying_charges, 10) || 1);
    if ('hold_days' in body) patch.hold_days = Math.max(0, parseInt(body.hold_days, 10) || 0);
    if ('monthly_cap' in body) patch.monthly_cap = Math.max(0, parseInt(body.monthly_cap, 10) || 0);
    if ('active' in body) patch.active = !!body.active;

    if (Object.keys(patch).length === 0) return res.status(400).json({ message: 'No editable fields provided' });
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('referral_reward_rules').update(patch).eq('id', req.params.id).select().single();
    if (error) return safeError(res, error);
    await audit(req, {
      action: 'referral.rule.update', resource_type: 'referral_reward_rule',
      resource_id: req.params.id, after: patch,
    });
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// GET /api/admin/referrals?status=
const listReferrals = async (req, res) => {
  try {
    const { status } = req.query || {};
    let q = supabaseAdmin
      .from('referrals')
      .select('*, referrer:referrer_id(name, username), referred:referred_id(name, username)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (e) { safeError(res, e); }
};

module.exports = { listRules, updateRule, listReferrals };
