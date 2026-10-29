/**
 * auditAdminController.js — read-only viewer for the admin action trail.
 *
 * GET /api/admin/audit supports filtering by admin, action, resource type, and
 * a date range, with pagination. The log is append-only — there are no write,
 * update, or delete endpoints here by design.
 */

const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');

// GET /api/admin/audit?admin_id=&action=&resource_type=&from=&to=&page=&limit=
const listAudit = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));

    let q = supabaseAdmin
      .from('admin_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (req.query.admin_id)      q = q.eq('admin_id', req.query.admin_id);
    if (req.query.action)        q = q.eq('action', req.query.action);
    if (req.query.resource_type) q = q.eq('resource_type', req.query.resource_type);
    if (req.query.resource_id)   q = q.eq('resource_id', String(req.query.resource_id));
    if (req.query.from)          q = q.gte('created_at', req.query.from);
    if (req.query.to)            q = q.lte('created_at', req.query.to);

    const { data, count, error } = await q;
    if (error) return safeError(res, error);

    res.json({ logs: data || [], total: count || 0, page, limit });
  } catch (e) {
    safeError(res, e);
  }
};

// GET /api/admin/audit/actions — distinct action keys, for the filter dropdown.
const listActions = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_audit_logs').select('action').limit(1000);
    if (error) return safeError(res, error);
    const actions = [...new Set((data || []).map(r => r.action))].sort();
    res.json({ actions });
  } catch (e) {
    safeError(res, e);
  }
};

module.exports = { listAudit, listActions };
