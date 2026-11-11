/**
 * adminMiddleware.js — RBAC route guard for the admin platform.
 *
 * SECURITY: fully isolated from vendor/user auth.
 *   - Verifies tokens with SUPER_ADMIN_JWT_SECRET only (adminAuthService).
 *   - Rejects any token whose type !== 'admin'.
 *   - `requireAdmin(permission)` additionally checks the token's permission
 *     array (embedded at login). Omit the argument to require only a valid
 *     admin session.
 *   - `requireSuperAdmin` requires the wildcard ('*') — i.e. the super role —
 *     for the most dangerous routes (staff management, impersonation, flags).
 *   - Session revocation (audit F-02): a per-admin token_version stamped into
 *     the JWT (`tv`) is re-checked against the DB; a token minted before a
 *     deactivate/demote/reset is rejected. See `checkRevocation` (fail-open).
 *   - On success attaches `req.admin` (and legacy `req.superAdmin`) for
 *     controllers + the audit service.
 */

const { jwtVerify } = require('../services/adminAuthService');
const { hasPermission } = require('../lib/adminPermissions');

// Verify the bearer token and attach req.admin. Returns the decoded payload,
// or sends the appropriate 401/403 and returns null.
const authenticate = (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Admin token required.' });
    return null;
  }
  let payload;
  try {
    payload = jwtVerify(authHeader.split(' ')[1]);
  } catch (_) {
    res.status(401).json({ message: 'Invalid or expired admin token.' });
    return null;
  }
  if (payload.type !== 'admin') {
    res.status(403).json({ message: 'Admin access required.' });
    return null;
  }
  req.admin = {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    username: payload.username,
    role: payload.role,
    permissions: payload.permissions || [],
  };
  // Legacy alias for any controller still reading req.superAdmin.
  req.superAdmin = { username: payload.username, name: payload.name };
  return payload;
};

// ── Session revocation (audit F-02) ───────────────────────────────────────────
// Each session JWT carries the admin's token_version (`tv`) at mint time. When an
// admin is deactivated / demoted / password-reset, staffAdminController bumps the
// DB token_version, and any earlier token is then rejected here.
//
// FAIL-OPEN by design: reject ONLY on a confirmed higher DB version or
// is_active=false. ANY uncertainty — a token with no `tv` (minted before this
// deploy), the column not yet applied, or a transient DB error — ALLOWS the
// request. So this can never lock admins out; the worst case is that it does not
// revoke yet (exactly today's behaviour). A 30s cache keeps the hot path cheap.
const REV_TTL_MS = 30 * 1000;
const _revCache = new Map(); // adminId -> { tv, active, at }
let _tvColumnMissing = false; // flips true once; avoids re-reading a missing column pre-migration

const evalRow = (row, tokenTv) => {
  if (row.active === false) return { revoked: true, reason: 'Account deactivated' };
  if (row.tv > tokenTv) return { revoked: true, reason: 'Session revoked, sign in again' };
  return { revoked: false };
};

const checkRevocation = async (payload) => {
  const id = payload && payload.sub;
  const tokenTv = Number(payload && payload.tv);
  // No subject, a pre-`tv` token, or a known-missing column → can't evaluate → allow.
  if (!id || !Number.isFinite(tokenTv) || _tvColumnMissing) return { revoked: false };
  try {
    const now = Date.now();
    const cached = _revCache.get(id);
    if (cached && now - cached.at <= REV_TTL_MS) return evalRow(cached, tokenTv);

    // Lazy-require so merely loading this middleware (e.g. a unit test that only
    // exercises token verification) doesn't pull in / construct the DB client.
    const { supabaseAdmin } = require('../config/supabase');
    const { data, error } = await supabaseAdmin
      .from('admin_users').select('token_version, is_active').eq('id', id).maybeSingle();
    if (error || !data) {
      if (error && /token_version|does not exist|could not find/i.test(error.message || '')) {
        _tvColumnMissing = true; // pre-migration — stop reading, stay fail-open
      }
      return cached ? evalRow(cached, tokenTv) : { revoked: false };
    }
    const row = { tv: Number(data.token_version) || 0, active: data.is_active !== false, at: now };
    _revCache.set(id, row);
    return evalRow(row, tokenTv);
  } catch (_) {
    return { revoked: false }; // fail-open on any error
  }
};

/** Require a valid admin session, optionally gated on a specific permission. */
const requireAdmin = (permission) => async (req, res, next) => {
  const payload = authenticate(req, res);
  if (!payload) return; // response already sent
  if (permission && !hasPermission(payload.permissions, permission)) {
    return res.status(403).json({ message: `Forbidden — missing permission: ${permission}` });
  }
  const rev = await checkRevocation(payload);
  if (rev.revoked) return res.status(401).json({ message: rev.reason });
  return next();
};

/** Require the super role (wildcard permission). */
const requireSuperAdmin = async (req, res, next) => {
  const payload = authenticate(req, res);
  if (!payload) return;
  if (!Array.isArray(payload.permissions) || !payload.permissions.includes('*')) {
    return res.status(403).json({ message: 'Super admin access required.' });
  }
  const rev = await checkRevocation(payload);
  if (rev.revoked) return res.status(401).json({ message: rev.reason });
  return next();
};

module.exports = { requireAdmin, requireSuperAdmin };
