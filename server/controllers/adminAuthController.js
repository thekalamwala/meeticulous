/**
 * adminAuthController.js — Admin staff authentication (separate credential store)
 *
 * SECURITY MODEL (M1, v2.4 → v2.5 with mandatory 2FA):
 *   - Staff live in `admin_users` with their own bcrypt password_hash — NOT in
 *     auth.users. Customer auth and staff auth never intersect.
 *   - Login is now a TWO-STEP flow:
 *       1. POST /login  → password checked → returns a short-lived pending token
 *          (type 'admin_2fa' or 'admin_2fa_enroll'); NO full session issued.
 *       2a. POST /2fa-verify  → TOTP or recovery code checked → full session.
 *       2b. POST /2fa-setup   → generate QR (enrollment step 1).
 *           POST /2fa-confirm → confirm first TOTP code → enable 2FA + full session.
 *   - Full session token only ever issued AFTER the second factor clears.
 *   - Secret stored encrypted at rest via cryptoTokens (AES-256-GCM).
 *   - Brute-force protection on both password and TOTP steps (MAX_FAILED attempts).
 */

const { supabaseAdmin } = require('../config/supabase');
const { jwtSign, jwtVerify, verifyPending, verifyPassword, hashPassword } = require('../services/adminAuthService');
const { encrypt, decrypt } = require('../utils/cryptoTokens');
const twofa = require('../services/admin2faService');
const { audit } = require('../services/auditService');
const { roleGrants } = require('../lib/adminPermissions');
const { getClientIp } = require('../lib/clientIp');
const ipBlocklist = require('../lib/ipBlocklist');

const MAX_FAILED  = 5;
const LOCK_MS     = 15 * 60 * 1000; // 15 min
const PENDING_TTL = 5 * 60;         // 5 min for 2FA/enroll pending tokens
const PW_CHANGE_TTL = 10 * 60;      // 10 min for forced password-change tokens
const MIN_PASSWORD_LEN = 10;        // minimum length for a self-chosen password

const normalize = (s) => (s || '').toLowerCase().trim();

// Look the staff member up by username first, then email — both via parameterized
// .eq() (never string-interpolated) so the identifier can't inject into the filter.
const findStaff = async (identifier) => {
  let { data } = await supabaseAdmin.from('admin_users').select('*').eq('username', identifier).maybeSingle();
  if (!data) ({ data } = await supabaseAdmin.from('admin_users').select('*').eq('email', identifier).maybeSingle());
  return data || null;
};

// Resolve the role's permission array from the DB (fresh), falling back to the
// canonical lib definition if the role row is somehow missing.
const resolvePermissions = async (roleKey) => {
  const { data: role } = await supabaseAdmin.from('admin_roles').select('permissions').eq('key', roleKey).maybeSingle();
  if (role && Array.isArray(role.permissions)) return role.permissions;
  return roleGrants(roleKey);
};

// Build the full admin session response object — used by verify2fa and confirm2fa.
const fullSession = async (staff) => {
  const permissions = await resolvePermissions(staff.role_key);
  const token = jwtSign({
    type: 'admin',
    sub: staff.id,
    email: staff.email,
    username: staff.username,
    name: staff.name,
    role: staff.role_key,
    permissions,
  });
  return {
    token,
    type: 'admin',
    role: staff.role_key,
    name: staff.name,
    email: staff.email,
    username: staff.username,
    permissions,
  };
};

// POST /api/admin-auth/login   body: { username | email, password }
const adminLogin = async (req, res) => {
  try {
    const body = req.body || {};
    const identifier = normalize(body.identifier || body.username || body.email);
    const password   = body.password;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Username/email and password are required.' });
    }

    const staff = await findStaff(identifier);

    // Generic message on lookup failure — never reveal whether the account exists.
    if (!staff || !staff.is_active) {
      // IP-level brute-force tracker (complements the per-account lockout below):
      // catches an attacker spraying many usernames from one IP. Fire-and-forget.
      ipBlocklist.recordAdminLoginFailure(getClientIp(req)).catch(() => {});
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Lockout gate
    if (staff.locked_until && new Date(staff.locked_until).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(staff.locked_until).getTime() - Date.now()) / 60000);
      return res.status(429).json({ message: `Account locked. Try again in ${mins} minute(s).` });
    }

    const ok = await verifyPassword(password, staff.password_hash);
    if (!ok) {
      // A lock that has already elapsed must open a FRESH attempt window. We only
      // reach here after the gate above cleared, so a truthy locked_until now is
      // necessarily in the past — counting on top of the stale (already-at-MAX)
      // failed_attempts would re-lock on the first try and pin the account to one
      // attempt per LOCK_MS until a *successful* login finally resets it.
      const lockExpired = staff.locked_until && new Date(staff.locked_until).getTime() <= Date.now();
      const failed = (lockExpired ? 0 : (staff.failed_attempts || 0)) + 1;
      const updates = {
        failed_attempts: failed,
        locked_until: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MS).toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      await supabaseAdmin.from('admin_users').update(updates).eq('id', staff.id);
      ipBlocklist.recordAdminLoginFailure(getClientIp(req)).catch(() => {});
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Success — reset counters, stamp login.
    await supabaseAdmin.from('admin_users')
      .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
      .eq('id', staff.id);
    ipBlocklist.resetAdminLoginFailures(getClientIp(req));

    // FORCED PASSWORD CHANGE GATE: a creator-issued temp password is single-use.
    // Until the intended owner picks their own password we issue NEITHER a full
    // session NOR a 2FA/enroll token — this stops whoever logs in first with the
    // temp password from binding their own authenticator (the enrollment race).
    if (staff.must_set_password) {
      return res.json({
        must_set_password: true,
        password_change_token: jwtSign({ type: 'admin_pw_change', sub: staff.id }, PW_CHANGE_TTL),
      });
    }

    // SECOND FACTOR GATE: never issue a full session from the password step alone.
    if (staff.totp_enabled) {
      return res.json({
        twofa_required: true,
        pending_token: jwtSign({ type: 'admin_2fa', sub: staff.id }, PENDING_TTL),
      });
    }
    return res.json({
      enroll_required: true,
      pending_token: jwtSign({ type: 'admin_2fa_enroll', sub: staff.id }, PENDING_TTL),
    });
  } catch (err) {
    console.error('[adminLogin]', err.message);
    return res.status(500).json({ message: 'Internal error.' });
  }
};

// POST /api/admin-auth/2fa-setup  body: { pending_token }
// Step 1 of enrollment: generate a TOTP secret + QR code, store encrypted secret.
// totp_enabled stays false until confirm2fa succeeds.
const setup2fa = async (req, res) => {
  try {
    let p;
    try {
      p = verifyPending((req.body || {}).pending_token, 'admin_2fa_enroll');
    } catch (_) {
      return res.status(401).json({ message: 'Enrollment session expired. Log in again.' });
    }

    const { data: staff } = await supabaseAdmin
      .from('admin_users').select('id, email, is_active, must_set_password').eq('id', p.sub).maybeSingle();
    if (!staff || !staff.is_active) return res.status(401).json({ message: 'Invalid session.' });
    // Defense in depth: no enrollment may begin until the owner has set their own
    // password. (adminLogin won't mint an enroll token in this state, but a
    // replayed/stale one must not slip through either.)
    if (staff.must_set_password) return res.status(403).json({ message: 'Set your password before enrolling in 2FA.' });

    const { secret, otpauth } = twofa.newSecret(staff.email);
    // eslint-disable-next-line global-require
    const qrcode = require('qrcode');
    const qr_data_url = await qrcode.toDataURL(otpauth);

    // Store the encrypted secret; totp_enabled stays false until the first code confirms it.
    await supabaseAdmin.from('admin_users')
      .update({ totp_secret: encrypt(secret), updated_at: new Date().toISOString() })
      .eq('id', staff.id);

    return res.json({ qr_data_url, otpauth_uri: otpauth, secret });
  } catch (e) {
    console.error('[setup2fa]', e.message);
    return res.status(500).json({ message: 'Internal error.' });
  }
};

// POST /api/admin-auth/2fa-confirm  body: { pending_token, code }
// Step 2 of enrollment: verify the first code, enable 2FA, issue full session + recovery codes.
const confirm2fa = async (req, res) => {
  try {
    let p;
    try {
      p = verifyPending((req.body || {}).pending_token, 'admin_2fa_enroll');
    } catch (_) {
      return res.status(401).json({ message: 'Enrollment session expired. Log in again.' });
    }

    const { data: staff } = await supabaseAdmin
      .from('admin_users').select('*').eq('id', p.sub).maybeSingle();
    if (!staff || !staff.is_active) return res.status(401).json({ message: 'Invalid session.' });
    // Defense in depth: forbid enabling 2FA before the owner sets their password.
    if (staff.must_set_password) return res.status(403).json({ message: 'Set your password before enrolling in 2FA.' });
    if (!staff.totp_secret) return res.status(400).json({ message: 'Start enrollment first.' });

    const { valid, step } = twofa.verifyTokenStep((req.body || {}).code, decrypt(staff.totp_secret));
    if (!valid) {
      return res.status(400).json({ message: 'Invalid code. Try the current 6 digits.' });
    }
    // Replay guard: reject a code whose step was already consumed (e.g. on a prior
    // attempt), and stamp the new step so it can't be reused within the window.
    if (staff.last_totp_step != null && step <= staff.last_totp_step) {
      return res.status(400).json({ message: 'Code already used. Wait for the next code.' });
    }

    const codes  = twofa.generateRecoveryCodes(8);
    const hashes = await twofa.hashRecoveryCodes(codes);

    await supabaseAdmin.from('admin_users').update({
      totp_enabled:         true,
      totp_recovery_codes:  hashes,
      totp_enrolled_at:     new Date().toISOString(),
      last_totp_step:       step,
      failed_attempts:      0,
      locked_until:         null,
      last_login_at:        new Date().toISOString(),
      updated_at:           new Date().toISOString(),
    }).eq('id', staff.id);

    // Best-effort audit — must not break enrollment if req.admin is absent.
    try {
      await audit(req, { action: 'admin.2fa.enrolled', resource_type: 'admin_user', resource_id: staff.id });
    } catch (_) { /* swallowed */ }

    const session = await fullSession(staff);
    return res.json({ ...session, recovery_codes: codes });
  } catch (e) {
    console.error('[confirm2fa]', e.message);
    return res.status(500).json({ message: 'Internal error.' });
  }
};

// POST /api/admin-auth/2fa-verify  body: { pending_token, code }
// Second factor for accounts that already have totp_enabled=true.
// Accepts a TOTP code OR a recovery code (single-use, consumed on success).
const verify2fa = async (req, res) => {
  try {
    let p;
    try {
      p = verifyPending((req.body || {}).pending_token, 'admin_2fa');
    } catch (_) {
      return res.status(401).json({ message: '2FA session expired. Log in again.' });
    }

    const { data: staff } = await supabaseAdmin
      .from('admin_users').select('*').eq('id', p.sub).maybeSingle();
    if (!staff || !staff.is_active || !staff.totp_enabled) {
      return res.status(401).json({ message: 'Invalid session.' });
    }

    // Lockout check (shared counter with password attempts).
    if (staff.locked_until && new Date(staff.locked_until).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(staff.locked_until).getTime() - Date.now()) / 60000);
      return res.status(429).json({ message: `Locked. Try again in ${mins} minute(s).` });
    }

    const code = (req.body || {}).code;
    const totp = twofa.verifyTokenStep(code, decrypt(staff.totp_secret));
    // Replay guard: a TOTP code is only accepted if its step is strictly newer
    // than the last consumed one. A valid-but-replayed code is treated as a miss
    // (it then fails recovery matching too and counts as a failed attempt).
    const totpReplayed = totp.valid && staff.last_totp_step != null && totp.step <= staff.last_totp_step;
    let ok           = totp.valid && !totpReplayed;
    let usedRecovery = false;
    const totpStep   = ok ? totp.step : null;

    if (!ok) {
      const idx = await twofa.matchRecoveryCode(code, staff.totp_recovery_codes || []);
      if (idx >= 0) {
        ok = true;
        usedRecovery = true;
        // Consume the used recovery code immediately.
        const remaining = (staff.totp_recovery_codes || []).filter((_, i) => i !== idx);
        await supabaseAdmin.from('admin_users')
          .update({ totp_recovery_codes: remaining })
          .eq('id', staff.id);
        try {
          await audit(req, { action: 'admin.2fa.recovery_used', resource_type: 'admin_user', resource_id: staff.id });
        } catch (_) { /* swallowed */ }
      }
    }

    if (!ok) {
      // Same fresh-window rule as the password step: this counter is shared, and
      // once a lock elapses the stale value would otherwise re-lock on attempt #1.
      const lockExpired = staff.locked_until && new Date(staff.locked_until).getTime() <= Date.now();
      const failed  = (lockExpired ? 0 : (staff.failed_attempts || 0)) + 1;
      const updates = {
        failed_attempts: failed,
        locked_until: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MS).toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      await supabaseAdmin.from('admin_users').update(updates).eq('id', staff.id);
      try {
        await audit(req, { action: 'admin.2fa.failed', resource_type: 'admin_user', resource_id: staff.id });
      } catch (_) { /* swallowed */ }
      return res.status(401).json({ message: 'Invalid code.' });
    }

    // Success — reset failure counters, stamp login time. When a fresh TOTP code
    // was used, also persist its step so the same code can't be replayed.
    const successUpdate = { failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() };
    if (!usedRecovery && totpStep != null) successUpdate.last_totp_step = totpStep;
    await supabaseAdmin.from('admin_users')
      .update(successUpdate)
      .eq('id', staff.id);

    try {
      await audit(req, {
        action: usedRecovery ? 'admin.2fa.success_recovery' : 'admin.2fa.success',
        resource_type: 'admin_user',
        resource_id: staff.id,
      });
    } catch (_) { /* swallowed */ }

    return res.json(await fullSession(staff));
  } catch (e) {
    console.error('[verify2fa]', e.message);
    return res.status(500).json({ message: 'Internal error.' });
  }
};

// POST /api/admin-auth/change-password
//   body: { password_change_token?, current_password, new_password }
//   (or an admin Bearer session in the Authorization header instead of the token)
//
// Two callers:
//   1. Forced first-login change — the account has must_set_password=true and
//      login handed back a short-lived password_change_token (no session issued).
//   2. A logged-in admin voluntarily rotating their own password — authenticated
//      by their normal admin Bearer session.
// In both cases we re-verify the *current* password before accepting a new one,
// enforce a minimum length, then clear must_set_password so the next login can
// proceed to the normal 2FA enrollment/verify flow.
const changePassword = async (req, res) => {
  try {
    const body = req.body || {};

    // Resolve the acting staff id from EITHER a password-change token (body) OR a
    // normal admin Bearer session — never trust an id from the request body.
    let staffId = null;
    if (body.password_change_token) {
      try {
        staffId = verifyPending(body.password_change_token, 'admin_pw_change').sub;
      } catch (_) {
        return res.status(401).json({ message: 'Password-change session expired. Log in again.' });
      }
    } else {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required.' });
      }
      try {
        const payload = jwtVerify(authHeader.split(' ')[1]);
        if (payload.type !== 'admin') return res.status(403).json({ message: 'Admin access required.' });
        staffId = payload.sub;
      } catch (_) {
        return res.status(401).json({ message: 'Invalid or expired admin token.' });
      }
    }

    const currentPassword = body.current_password;
    const newPassword     = body.new_password;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'current_password and new_password are required.' });
    }
    if (String(newPassword).length < MIN_PASSWORD_LEN) {
      return res.status(400).json({ message: `New password must be at least ${MIN_PASSWORD_LEN} characters.` });
    }
    if (String(newPassword) === String(currentPassword)) {
      return res.status(400).json({ message: 'New password must be different from the current one.' });
    }

    const { data: staff } = await supabaseAdmin
      .from('admin_users').select('id, password_hash, is_active').eq('id', staffId).maybeSingle();
    if (!staff || !staff.is_active) return res.status(401).json({ message: 'Invalid session.' });

    const ok = await verifyPassword(currentPassword, staff.password_hash);
    if (!ok) {
      try {
        await audit(req, { action: 'admin.password.change_failed', resource_type: 'admin_user', resource_id: staff.id });
      } catch (_) { /* swallowed */ }
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const password_hash = await hashPassword(newPassword);
    await supabaseAdmin.from('admin_users').update({
      password_hash,
      must_set_password: false,
      failed_attempts:   0,
      locked_until:      null,
      updated_at:        new Date().toISOString(),
    }).eq('id', staff.id);

    try {
      await audit(req, { action: 'admin.password.changed', resource_type: 'admin_user', resource_id: staff.id });
    } catch (_) { /* swallowed */ }

    // No session is issued here — the user logs in again, which then drives the
    // normal 2FA enrollment/verification flow.
    return res.json({ message: 'Password updated. Please log in again.' });
  } catch (e) {
    console.error('[changePassword]', e.message);
    return res.status(500).json({ message: 'Internal error.' });
  }
};

// GET /api/admin-auth/me — echo the session identity + permissions (behind requireAdmin).
const adminMe = (req, res) => res.json({ admin: req.admin });

module.exports = { adminLogin, adminMe, setup2fa, confirm2fa, verify2fa, changePassword, jwtVerify };
