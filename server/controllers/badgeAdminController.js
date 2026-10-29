/**
 * badgeAdminController.js — Super Admin badge management.
 * Badge catalog CRUD, rule management, preview, manual assign/revoke,
 * and engine trigger endpoints. All routes sit behind requireSuperAdmin.
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const { sanitizeLikeTerm } = require('../utils/searchSanitize');
const badgeEngine = require('../services/badgeEngine');

const slugify = (text) =>
  String(text).toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/--+/g, '-').slice(0, 120);

const VALID_OPERATORS = ['=', '>', '<', '>=', '<='];

const validateRules = (rules) => {
  for (const r of rules) {
    if (!badgeEngine.METRIC_FIELDS.includes(r.field))
      return `Unknown field: ${r.field}`;
    if (!VALID_OPERATORS.includes(r.operator))
      return `Invalid operator: ${r.operator}`;
    if (r.value === undefined || r.value === null || Number.isNaN(Number(r.value)))
      return `Rule value must be numeric (field ${r.field})`;
  }
  return null;
};

// ── GET /api/admin/badges ────────────────────────────────────────
const listBadges = async (req, res) => {
  try {
    const { search, type, status, category_id } = req.query;
    let q = supabaseAdmin
      .from('badges')
      .select('*, badge_categories(name)')
      .order('created_at', { ascending: false });
    const safeSearch = sanitizeLikeTerm(search);
    if (safeSearch)  q = q.ilike('name', `%${safeSearch}%`);
    if (type)        q = q.eq('badge_type', type);
    if (status)      q = q.eq('status', status);
    if (category_id) q = q.eq('category_id', category_id);
    const { data: badges, error } = await q;
    if (error) return safeError(res, error);

    // Live earned_count per badge (single grouped query, no N+1)
    const { data: counts } = await supabaseAdmin
      .from('vendor_badges')
      .select('badge_id')
      .is('revoked_at', null);
    const countMap = {};
    for (const c of counts || []) countMap[c.badge_id] = (countMap[c.badge_id] || 0) + 1;

    res.json((badges || []).map((b) => ({ ...b, earned_count: countMap[b.id] || 0 })));
  } catch (err) {
    safeError(res, err);
  }
};

// ── GET /api/admin/badges/meta ───────────────────────────────────
const getMeta = async (req, res) => {
  try {
    const { data: categories } = await supabaseAdmin
      .from('badge_categories').select('*').order('sort_order');
    res.json({
      categories: categories || [],
      fields: badgeEngine.METRIC_FIELDS,
      operators: VALID_OPERATORS,
    });
  } catch (err) {
    safeError(res, err);
  }
};

// ── GET /api/admin/badges/:id ────────────────────────────────────
const getBadge = async (req, res) => {
  try {
    const { data: badge, error } = await supabaseAdmin
      .from('badges').select('*, badge_categories(name)').eq('id', req.params.id).single();
    if (error || !badge) return res.status(404).json({ message: 'Badge not found' });
    const { data: rules } = await supabaseAdmin
      .from('badge_rules').select('*').eq('badge_id', badge.id).order('group_id').order('sort_order');
    res.json({ ...badge, rules: rules || [] });
  } catch (err) {
    safeError(res, err);
  }
};

// ── POST /api/admin/badges ───────────────────────────────────────
const createBadge = async (req, res) => {
  try {
    const { name, description, image_url, category_id, badge_type, is_negative, is_bas_team, status, rule_logic, rules = [] } = req.body;
    if (!name) return res.status(400).json({ message: 'Badge name is required' });
    if (badge_type === 'automatic') {
      if (!rules.length) return res.status(400).json({ message: 'Automatic badges require at least one rule' });
      const ruleError = validateRules(rules);
      if (ruleError) return res.status(400).json({ message: ruleError });
    }

    const { data: badge, error } = await supabaseAdmin
      .from('badges')
      .insert({
        name: name.trim(),
        slug: slugify(name),
        description: description || '',
        image_url: image_url || '',
        category_id: category_id || null,
        badge_type: badge_type === 'automatic' ? 'automatic' : 'manual',
        is_negative: !!is_negative,
        is_bas_team: !!is_bas_team,
        status: ['draft', 'active', 'archived'].includes(status) ? status : 'draft',
        rule_logic: rule_logic === 'OR' ? 'OR' : 'AND',
      })
      .select()
      .single();
    if (error) {
      if (/duplicate key/i.test(error.message)) return res.status(409).json({ message: 'A badge with this name already exists' });
      return safeError(res, error);
    }

    if (badge.badge_type === 'automatic' && rules.length) {
      const { error: rErr } = await supabaseAdmin.from('badge_rules').insert(
        rules.map((r, i) => ({
          badge_id: badge.id, field: r.field, operator: r.operator,
          value: Number(r.value), group_id: r.group_id ?? 0, sort_order: r.sort_order ?? i,
        }))
      );
      if (rErr) return res.status(500).json({ message: `Badge created but rules failed: ${rErr.message}` });
    }

    // Publishing an automatic badge triggers an immediate evaluation for it
    if (badge.status === 'active' && badge.badge_type === 'automatic') {
      badgeEngine.evaluate({ badgeId: badge.id }).catch((e) => console.error('Badge publish evaluation error:', e.message));
    }

    res.status(201).json(badge);
  } catch (err) {
    safeError(res, err);
  }
};

// ── PUT /api/admin/badges/:id ────────────────────────────────────
const updateBadge = async (req, res) => {
  try {
    const { name, description, image_url, category_id, is_negative, is_bas_team, rule_logic, rules } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (name)                      { updates.name = name.trim(); updates.slug = slugify(name); }
    if (description !== undefined)  updates.description = description;
    if (image_url !== undefined)    updates.image_url = image_url;
    if (category_id !== undefined)  updates.category_id = category_id || null;
    if (is_negative !== undefined)  updates.is_negative = !!is_negative;
    if (is_bas_team !== undefined)  updates.is_bas_team = !!is_bas_team;
    if (rule_logic)                 updates.rule_logic = rule_logic === 'OR' ? 'OR' : 'AND';

    const { data: badge, error } = await supabaseAdmin
      .from('badges').update(updates).eq('id', req.params.id).select().single();
    if (error || !badge) return res.status(404).json({ message: 'Badge not found' });

    if (Array.isArray(rules)) {
      const ruleError = validateRules(rules);
      if (ruleError) return res.status(400).json({ message: ruleError });
      // Replace the rule set atomically-enough for admin editing
      await supabaseAdmin.from('badge_rules').delete().eq('badge_id', badge.id);
      if (rules.length) {
        const { error: rErr } = await supabaseAdmin.from('badge_rules').insert(
          rules.map((r, i) => ({
            badge_id: badge.id, field: r.field, operator: r.operator,
            value: Number(r.value), group_id: r.group_id ?? 0, sort_order: r.sort_order ?? i,
          }))
        );
        if (rErr) return res.status(500).json({ message: rErr.message });
      }
      // Editing an active automatic badge re-evaluates holders against new rules
      if (badge.status === 'active' && badge.badge_type === 'automatic') {
        badgeEngine.evaluate({ badgeId: badge.id }).catch((e) => console.error('Badge edit evaluation error:', e.message));
      }
    }

    res.json(badge);
  } catch (err) {
    safeError(res, err);
  }
};

// ── PATCH /api/admin/badges/:id/status ───────────────────────────
const updateBadgeStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'active', 'archived'].includes(status))
      return res.status(400).json({ message: 'status must be draft, active or archived' });

    const { data: badge, error } = await supabaseAdmin
      .from('badges')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error || !badge) return res.status(404).json({ message: 'Badge not found' });

    if (status === 'active' && badge.badge_type === 'automatic') {
      badgeEngine.evaluate({ badgeId: badge.id }).catch((e) => console.error('Badge activation evaluation error:', e.message));
    }
    res.json(badge);
  } catch (err) {
    safeError(res, err);
  }
};

// ── GET /api/admin/badges/:id/preview ────────────────────────────
// Count of vendors matching current saved rules (or rules passed via query body-less GET → use saved).
const previewBadge = async (req, res) => {
  try {
    const { data: badge } = await supabaseAdmin.from('badges').select('*').eq('id', req.params.id).single();
    if (!badge) return res.status(404).json({ message: 'Badge not found' });
    const { data: rules } = await supabaseAdmin.from('badge_rules').select('*').eq('badge_id', badge.id);
    const count = await badgeEngine.previewRuleSet(badge, rules || []);
    res.json({ count });
  } catch (err) {
    safeError(res, err);
  }
};

// ── POST /api/admin/badges/preview (unsaved rules from the builder) ──
const previewRules = async (req, res) => {
  try {
    const { rule_logic = 'AND', rules = [] } = req.body;
    const ruleError = validateRules(rules);
    if (ruleError) return res.status(400).json({ message: ruleError });
    const count = await badgeEngine.previewRuleSet({ rule_logic }, rules);
    res.json({ count });
  } catch (err) {
    safeError(res, err);
  }
};

// ── GET /api/admin/vendors/:id/badges ────────────────────────────
const getVendorBadges = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('vendor_badges')
      .select('*, badges(*)')
      .eq('vendor_id', req.params.id)
      .order('assigned_at', { ascending: false });
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (err) {
    safeError(res, err);
  }
};

// ── POST /api/admin/vendors/:id/badges ───────────────────────────
const assignBadge = async (req, res) => {
  try {
    const { badge_id, reason } = req.body;
    if (!badge_id) return res.status(400).json({ message: 'badge_id is required' });
    if (!reason || !reason.trim()) return res.status(400).json({ message: 'A reason is required for manual badge assignment' });

    const { data: badge } = await supabaseAdmin.from('badges').select('id, name, description, badge_type, status').eq('id', badge_id).single();
    if (!badge) return res.status(404).json({ message: 'Badge not found' });
    if (badge.badge_type !== 'manual') return res.status(400).json({ message: 'Only manual-type badges can be assigned by admins' });
    if (badge.status === 'archived') return res.status(400).json({ message: 'Archived badges cannot be assigned' });

    const { data, error } = await supabaseAdmin
      .from('vendor_badges')
      .insert({
        vendor_id: req.params.id,
        badge_id,
        assigned_by: req.admin?.id || null,
        reason: reason.trim(),
      })
      .select()
      .single();
    if (error) {
      if (/duplicate key/i.test(error.message)) return res.status(409).json({ message: 'Host already holds this badge' });
      return safeError(res, error);
    }

    // Badge unlocked email (queued, non-blocking)
    try {
      const { data: vendor } = await supabaseAdmin
        .from('profiles').select('name, email, username').eq('id', req.params.id).maybeSingle();
      if (vendor?.email) {
        require('../services/notificationEngine').send({
          event: 'BADGE_UNLOCKED',
          data: {
            email: vendor.email,
            emailUser: { name: vendor.name, email: vendor.email, username: vendor.username },
            emailData: { badge_name: badge.name, badge_description: badge.description || '' },
            recipientUserId: req.params.id,
          },
        }).catch((e) => console.error('badge email error:', e.message));
      }
    } catch (_) { /* non-fatal */ }

    res.status(201).json(data);
  } catch (err) {
    safeError(res, err);
  }
};

// ── DELETE /api/admin/vendors/:id/badges/:badgeId ────────────────
// Soft revoke — no destructive deletes, full audit trail.
const revokeBadge = async (req, res) => {
  try {
    const reason = req.body?.reason || req.query?.reason;
    if (!reason || !reason.trim()) return res.status(400).json({ message: 'A reason is required for badge revocation' });

    const { data, error } = await supabaseAdmin
      .from('vendor_badges')
      .update({
        revoked_by: req.admin?.id || null,
        revoked_at: new Date().toISOString(),
        revocation_reason: reason.trim(),
      })
      .eq('vendor_id', req.params.id)
      .eq('badge_id', req.params.badgeId)
      .is('revoked_at', null)
      .select();
    if (error) return safeError(res, error);
    if (!data || data.length === 0) return res.status(404).json({ message: 'Host does not hold this badge' });
    res.json({ message: 'Badge revoked', revoked: data[0] });
  } catch (err) {
    safeError(res, err);
  }
};

// ── POST /api/admin/badges/evaluate[/:vendorId] ──────────────────
const runEvaluation = async (req, res) => {
  try {
    const vendorIds = req.params.vendorId ? [req.params.vendorId] : null;
    const result = await badgeEngine.evaluate({ vendorIds });
    res.json({ message: 'Evaluation complete', ...result });
  } catch (err) {
    safeError(res, err);
  }
};

module.exports = {
  listBadges, getMeta, getBadge, createBadge, updateBadge, updateBadgeStatus,
  previewBadge, previewRules, getVendorBadges, assignBadge, revokeBadge, runEvaluation,
};
