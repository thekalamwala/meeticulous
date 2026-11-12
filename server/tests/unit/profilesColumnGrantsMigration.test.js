/**
 * Static guard for v3.205 (profiles column-grant lockdown).
 * The anon/authenticated roles must not be able to SELECT any PII / billing /
 * security-internal column of public.profiles via the publishable anon key.
 * Parses the migration SQL (no DB needed) so the invariant is enforced in CI.
 */
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(
  path.join(__dirname, '../../migrations/v3.205_profiles_column_grants.sql'),
  'utf8',
);

// Columns that must NEVER be readable by anon/authenticated.
const SENSITIVE = [
  'email', 'phone', 'whatsapp_number', 'date_of_birth', 'admin_notes',
  'billing_details', 'google_id', 'linkedin_sub', 'razorpay_subscription_id',
  'subscription_status', 'current_period_end', 'billing_cadence',
  'plan', 'plan_expires_at', 'is_banned', 'password_set',
  'failed_login_count', 'login_locked_until', 'sessions_valid_after',
  'account_manager_id', 'role',
];

// The single GRANT SELECT (...) column list, lowercased.
const grantedCols = (() => {
  const m = sql.match(/GRANT\s+SELECT\s*\(([\s\S]*?)\)\s*ON\s+public\.profiles/i);
  if (!m) return null;
  return m[1].split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
})();

describe('v3.205 profiles column-grant lockdown', () => {
  test('revokes the table-wide SELECT grant from anon and authenticated', () => {
    expect(sql).toMatch(
      /REVOKE\s+SELECT\s+ON\s+public\.profiles\s+FROM\s+anon,\s*authenticated;/i,
    );
  });

  test('re-grants SELECT on an explicit column list (not the whole table)', () => {
    expect(grantedCols).not.toBeNull();
    expect(grantedCols.length).toBeGreaterThan(0);
  });

  test.each(SENSITIVE)('does not grant SELECT on sensitive column: %s', (col) => {
    expect(grantedCols).not.toContain(col);
  });

  test('keeps public display columns readable (name, username, profile_image)', () => {
    for (const col of ['name', 'username', 'profile_image']) {
      expect(grantedCols).toContain(col);
    }
  });
});
