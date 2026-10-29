/**
 * staffAdminController.js — Admin staff & role management (Super Admin only).
 *
 * Backs the M1 Staff page: list/create/update/deactivate staff and read the
 * role catalog. Staff are rows in the separate `admin_users` credential store.
 * Every mutation is audited. Guards prevent an admin from locking the platform
 * out of itself (no self-deactivate, always keep one active super).
 */

const crypto = require('crypto');
const { safeError } = require('../utils/httpError');
const { supabaseAdmin } = require('../config/supabase');
const { hashPassword } = require('../services/adminAuthService');
const { isValidRole } = require('../lib/adminPermissions');
const { audit } = require('../services/auditService');

const PUBLIC_COLUMNS =
  'id, email, username, name, role_key, crm_team, is_active, must_set_password, last_login_at, created_at, updated_at';

// CRM pipeline team (P3 handoffs). null = not on a CRM team.
const CRM_TEAMS = ['sales', 'relations', 'marketing'];

const cleanUsername = (u) => (u || '').toLowerCase().trim().replace(/[^a-z0-9._-]/g, '');
const cleanEmail    = (e) => (e || '').toLowerCase().trim();
const isEmail       = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Generate a readable one-time temp password when the creator doesn't supply one.
const genTempPassword = () =>
  'Sloth-' + crypto.randomBytes(4).toString('hex') + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

const countActiveSupers = async (excludeId) => {
  let q = supabaseAdmin.from('admin_users')
    .select('id', { count: 'exact', head: true })
    .eq('role_key', 'super').eq('is_active', true);
  if (excludeId) q = q.neq('id', excludeId);
  const { count } = await q;
  return count || 0;
};

// GET /api/admin/roles
const listRoles = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_roles')
      .select('key, name, description, permissions, is_system')
      .order('key', { ascending: true });
    if (error) return safeError(res, error);
    res.json({ roles: data || [] });
  } catch (e) { safeError(res, e); }
};

// GET /api/admin/staff
const listStaff = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select(PUBLIC_COLUMNS)
      .order('created_at', { ascending: true });
    if (error) return safeError(res, error);
    res.json({ staff: data || [] });
  } catch (e) { safeError(res, e); }
};

// GET /api/admin/staff/:id  — includes that staff member's recent audit trail
const getStaff = async (req, res) => {
  try {
    const { data: staff, error } = await supabaseAdmin
      .from('admin_users').select(PUBLIC_COLUMNS).eq('id', req.params.id).maybeSingle();
    if (error || !staff) return res.status(404).json({ message: 'Staff member not found.' });

    const { data: activity } = await supabaseAdmin
      .from('admin_audit_logs')
      .select('action, resource_type, resource_id, created_at')
      .eq('admin_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(20);

    res.json({ staff, activity: activity || [] });
  } catch (e) { safeError(res, e); }
};

// POST /api/admin/staff   body: { email, username, name, role_key, password? }
const createStaff = async (req, res) => {
  try {
    const email    = cleanEmail(req.body.email);
    const username = cleanUsername(req.body.username);
    const name     = (req.body.name || '').trim();
    const roleKey  = (req.body.role_key || '').trim();

    if (!email || !username || !name || !roleKey)
      return res.status(400).json({ message: 'email, username, name and role_key are required.' });
    if (!isEmail(email)) return res.status(400).json({ message: 'Invalid email address.' });
    if (username.length < 3) return res.status(400).json({ message: 'Username must be at least 3 characters.' });
    if (!isValidRole(roleKey)) return res.status(400).json({ message: `Unknown role: ${roleKey}` });

    // Uniqueness pre-checks (DB also enforces UNIQUE — this gives a clean message).
    // Two parameterized .eq() lookups rather than one interpolated .or(): the
    // loose isEmail regex permits commas/parentheses, which would otherwise inject
    // into the PostgREST filter string.
    const [{ data: emailClash }, { data: usernameClash }] = await Promise.all([
      supabaseAdmin.from('admin_users').select('id').eq('email', email).maybeSingle(),
      supabaseAdmin.from('admin_users').select('id').eq('username', username).maybeSingle(),
    ]);
    if (emailClash || usernameClash)
      return res.status(409).json({ message: 'Email or username already in use.' });

    const tempPassword = req.body.password && String(req.body.password).length >= 8
      ? String(req.body.password)
      : genTempPassword();
    const password_hash = await hashPassword(tempPassword);

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .insert({
        email, username, name, role_key: roleKey,
        password_hash, must_set_password: true,
        created_by: req.admin?.id || null,
      })
      .select(PUBLIC_COLUMNS)
      .single();
    if (error) return safeError(res, error);

    await audit(req, { action: 'staff.create', resource_type: 'admin_user', resource_id: data.id,
      after: { email, username, role_key: roleKey } });

    // Return the temp password ONCE so the creator can hand it over. It is never
    // stored in plaintext and never logged.
    res.status(201).json({ staff: data, temp_password: tempPassword });
  } catch (e) { safeError(res, e); }
};

// PUT /api/admin/staff/:id   body: { name?, role_key? }
const updateStaff = async (req, res) => {
  try {
    const { data: before, error: e0 } = await supabaseAdmin
      .from('admin_users').select(PUBLIC_COLUMNS).eq('id', req.params.id).maybeSingle();
    if (e0 || !before) return res.status(404).json({ message: 'Staff member not found.' });

    const updates = { updated_at: new Date().toISOString() };
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body.role_key !== undefined) {
      if (!isValidRole(req.body.role_key)) return res.status(400).json({ message: `Unknown role: ${req.body.role_key}` });
      // Guard: don't demote the last active super.
      if (before.role_key === 'super' && req.body.role_key !== 'super' && before.is_active) {
        if ((await countActiveSupers(before.id)) === 0)
          return res.status(400).json({ message: 'Cannot demote the last active Super Admin.' });
      }
      updates.role_key = req.body.role_key;
    }
    if (req.body.crm_team !== undefined) {
      const t = req.body.crm_team === null || req.body.crm_team === '' ? null : String(req.body.crm_team).trim();
      if (t !== null && !CRM_TEAMS.includes(t)) return res.status(400).json({ message: `Unknown CRM team: ${t}` });
      updates.crm_team = t;
    }

    const { data, error } = await supabaseAdmin
      .from('admin_users').update(updates).eq('id', req.params.id).select(PUBLIC_COLUMNS).single();
    if (error) return safeError(res, error);

    await audit(req, { action: 'staff.update', resource_type: 'admin_user', resource_id: data.id,
      before: { name: before.name, role_key: before.role_key }, after: { name: data.name, role_key: data.role_key } });
    res.json({ staff: data });
  } catch (e) { safeError(res, e); }
};

// PATCH /api/admin/staff/:id/status   body: { is_active }
const setStaffActive = async (req, res) => {
  try {
    const isActive = req.body.is_active === true || req.body.is_active === 'true';
    const { data: before, error: e0 } = await supabaseAdmin
      .from('admin_users').select(PUBLIC_COLUMNS).eq('id', req.params.id).maybeSingle();
    if (e0 || !before) return res.status(404).json({ message: 'Staff member not found.' });

    if (!isActive) {
      if (req.admin?.id === before.id)
        return res.status(400).json({ message: 'You cannot deactivate your own account.' });
      if (before.role_key === 'super' && before.is_active && (await countActiveSupers(before.id)) === 0)
        return res.status(400).json({ message: 'Cannot deactivate the last active Super Admin.' });
    }

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select(PUBLIC_COLUMNS).single();
    if (error) return safeError(res, error);

    await audit(req, { action: isActive ? 'staff.activate' : 'staff.deactivate',
      resource_type: 'admin_user', resource_id: data.id });
    res.json({ staff: data });
  } catch (e) { safeError(res, e); }
};

// POST /api/admin/staff/:id/reset-password   body: { password? }
const resetStaffPassword = async (req, res) => {
  try {
    const { data: staff, error: e0 } = await supabaseAdmin
      .from('admin_users').select('id, username').eq('id', req.params.id).maybeSingle();
    if (e0 || !staff) return res.status(404).json({ message: 'Staff member not found.' });

    const newPassword = req.body.password && String(req.body.password).length >= 8
      ? String(req.body.password)
      : genTempPassword();
    const password_hash = await hashPassword(newPassword);

    const { error } = await supabaseAdmin
      .from('admin_users')
      .update({ password_hash, must_set_password: true, failed_attempts: 0, locked_until: null,
        updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    if (error) return safeError(res, error);

    await audit(req, { action: 'staff.reset_password', resource_type: 'admin_user', resource_id: staff.id });
    res.json({ message: 'Password reset.', temp_password: newPassword });
  } catch (e) { safeError(res, e); }
};

module.exports = { listRoles, listStaff, getStaff, createStaff, updateStaff, setStaffActive, resetStaffPassword };
