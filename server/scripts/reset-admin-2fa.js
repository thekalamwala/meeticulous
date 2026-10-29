/**
 * reset-admin-2fa.js — break-glass: clear an admin's 2FA so they can re-enroll.
 * Usage: node scripts/reset-admin-2fa.js <username-or-email>
 * Requires server/.env (service-role key). Idempotent.
 */
'use strict';
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');

(async () => {
  const id = process.argv[2];
  if (!id) { console.error('Usage: node scripts/reset-admin-2fa.js <username-or-email>'); process.exit(1); }
  const patch = { totp_enabled: false, totp_secret: null, totp_recovery_codes: null, totp_enrolled_at: null, updated_at: new Date().toISOString() };
  let { data, error } = await supabaseAdmin.from('admin_users').update(patch).eq('username', id).select('id, username').maybeSingle();
  if (!data && !error) ({ data, error } = await supabaseAdmin.from('admin_users').update(patch).eq('email', id).select('id, username').maybeSingle());
  if (error) { console.error('Failed:', error.message); process.exit(1); }
  if (!data) { console.error('No admin found for:', id); process.exit(1); }
  console.log('2FA reset for admin:', data.username, '- they will re-enroll on next login.');
  process.exit(0);
})();
