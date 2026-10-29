const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const featureFlags = require('../services/featureFlags');
const { REGISTRY } = require('../config/featureRegistry');
const { audit } = require('../services/auditService');

/**
 * Upsert every registry flag into feature_flags WITHOUT touching the `enabled`
 * column of rows that already exist (admin choices win). New rows land enabled.
 * Idempotent — safe to call on boot and on every admin GET.
 */
const syncRegistry = async () => {
  try {
    const { data: existing } = await supabaseAdmin.from('feature_flags').select('key');
    const have = new Set((existing || []).map((r) => r.key));
    // New rows land enabled by default, EXCEPT entries that opt out with
    // `enabled: false` (e.g. a send kill-switch that must ship OFF). Existing
    // rows are never touched (admin choice wins) — this default only applies on
    // first insert.
    const missing = REGISTRY.filter((f) => !have.has(f.key)).map((f) => ({
      key: f.key, label: f.label, description: f.description,
      category: f.category, scope: f.scope, enabled: f.enabled !== false,
    }));
    if (missing.length) await supabaseAdmin.from('feature_flags').insert(missing);

    // Keep label/description/category/scope fresh for known keys (metadata only,
    // never `enabled`) so registry edits propagate to the admin UI.
    for (const f of REGISTRY) {
      if (!have.has(f.key)) continue;
      await supabaseAdmin.from('feature_flags')
        .update({ label: f.label, description: f.description, category: f.category, scope: f.scope })
        .eq('key', f.key);
    }
    featureFlags.clearCache();
  } catch (_) { /* boot/best-effort; getFlags still returns whatever exists */ }
};

// GET /api/admin/features
const getFlags = async (req, res) => {
  try {
    await syncRegistry();
    const { data, error } = await supabaseAdmin.from('feature_flags').select('*').order('key');
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (e) { safeError(res, e); }
};

// PATCH /api/admin/features/:key
const toggleFlag = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean')
      return res.status(400).json({ message: 'enabled (boolean) is required' });
    // Capture the prior value for the audit trail — a kill-switch flip (send
    // suppression, payments, confirmation emails) is a high-leverage action and
    // was previously recorded nowhere (audit F12).
    const { data: prior } = await supabaseAdmin
      .from('feature_flags').select('enabled').eq('key', req.params.key).maybeSingle();
    const { data, error } = await supabaseAdmin
      .from('feature_flags')
      .update({ enabled, updated_at: new Date().toISOString(), updated_by: req.admin?.id || req.user?.id || null })
      .eq('key', req.params.key)
      .select().single();
    if (error) return safeError(res, error);
    if (!data) return res.status(404).json({ message: 'Flag not found' });
    featureFlags.clearCache();
    await audit(req, {
      action: 'feature_flag.toggle', resource_type: 'feature_flag', resource_id: req.params.key,
      before: { enabled: prior?.enabled }, after: { enabled },
    });
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// POST /api/admin/features — create a custom flag from the admin UI.
const createFlag = async (req, res) => {
  try {
    let { key, label, description, category, scope } = req.body || {};
    key = String(key || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!key) return res.status(400).json({ message: 'key is required' });
    if (!label || !String(label).trim()) return res.status(400).json({ message: 'label is required' });

    const { data: clash } = await supabaseAdmin.from('feature_flags').select('key').eq('key', key).maybeSingle();
    if (clash) return res.status(409).json({ message: `Flag "${key}" already exists` });

    const row = {
      key,
      label: String(label).trim(),
      description: description ? String(description).trim() : null,
      category: category ? String(category).trim() : 'Custom',
      scope: ['vendor', 'customer', 'both'].includes(scope) ? scope : 'both',
      enabled: true, // new switches always ship ON
      updated_by: req.admin?.id || req.user?.id || null,
    };
    const { data, error } = await supabaseAdmin.from('feature_flags').insert(row).select().single();
    if (error) return safeError(res, error);
    featureFlags.clearCache();
    await audit(req, {
      action: 'feature_flag.create', resource_type: 'feature_flag', resource_id: key,
      after: { label: row.label, category: row.category, scope: row.scope, enabled: row.enabled },
    });
    res.status(201).json(data);
  } catch (e) { safeError(res, e); }
};

// GET /api/feature-flags  (public) — every flag, for client UI gating.
// Values only (key → bool); labels/descriptions stay admin-side.
const getPublicFlags = async (req, res) => {
  try {
    const map = await featureFlags.loadFlags();
    res.json(map);
  } catch (e) { safeError(res, e); }
};

module.exports = { getFlags, toggleFlag, createFlag, getPublicFlags, syncRegistry };
