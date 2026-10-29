/**
 * auditService.js — append-only admin action trail (admin_audit_logs).
 *
 * Call `audit(req, {...})` from any mutating admin endpoint. It records WHO
 * (from req.admin, set by requireAdmin), WHAT (action), the target resource,
 * and an optional before/after snapshot. Best-effort: a logging failure must
 * NEVER break the underlying operation, so all errors are swallowed + warned.
 *
 * The table has no UPDATE/DELETE endpoints anywhere — it is immutable by design.
 */

const { supabaseAdmin } = require('../config/supabase');

const audit = async (req, { action, resource_type = null, resource_id = null, before = null, after = null } = {}) => {
  try {
    if (!action) return;
    const a = (req && req.admin) || {};
    await supabaseAdmin.from('admin_audit_logs').insert({
      admin_id:      a.id || null,
      admin_email:   a.email || null,
      admin_role:    a.role || null,
      action,
      resource_type,
      resource_id:   resource_id != null ? String(resource_id) : null,
      before,
      after,
      ip:            (req && (req.ip || req.headers?.['x-forwarded-for'])) || null,
      user_agent:    (req && req.headers?.['user-agent']) || null,
    });
  } catch (err) {
    // Never let auditing failure surface to the caller.
    console.error('[audit] failed to record action:', err.message);
  }
};

module.exports = { audit };
