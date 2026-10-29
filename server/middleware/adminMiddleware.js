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

/** Require a valid admin session, optionally gated on a specific permission. */
const requireAdmin = (permission) => (req, res, next) => {
  const payload = authenticate(req, res);
  if (!payload) return; // response already sent
  if (permission && !hasPermission(payload.permissions, permission)) {
    return res.status(403).json({ message: `Forbidden — missing permission: ${permission}` });
  }
  return next();
};

/** Require the super role (wildcard permission). */
const requireSuperAdmin = (req, res, next) => {
  const payload = authenticate(req, res);
  if (!payload) return;
  if (!Array.isArray(payload.permissions) || !payload.permissions.includes('*')) {
    return res.status(403).json({ message: 'Super admin access required.' });
  }
  return next();
};

module.exports = { requireAdmin, requireSuperAdmin };
