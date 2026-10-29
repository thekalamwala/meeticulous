-- ============================================================================
-- v2.4 — Admin RBAC + Audit foundation (Milestone 1)
--
-- Adds the staff/role/audit backbone for the admin platform. Staff accounts
-- live in a SEPARATE credential store (own bcrypt password_hash) — they are
-- NOT linked to auth.users, so a customer-auth breach can never touch admin
-- access. All three tables are service-role only (deny_all RLS), matching the
-- otp_codes precedent; every read/write goes through supabaseAdmin server-side.
--
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT). Role seed kept in sync with
-- server/lib/adminPermissions.js (single source of truth).
-- ============================================================================

-- ── Roles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_roles (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  permissions JSONB NOT NULL DEFAULT '[]',
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Staff accounts (separate credential store) ─────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT UNIQUE NOT NULL,
  username          TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  password_hash     TEXT,                       -- bcrypt; null while invite pending
  role_key          TEXT NOT NULL REFERENCES admin_roles(key),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  must_set_password BOOLEAN NOT NULL DEFAULT false,
  invite_token      TEXT,
  invite_expires_at TIMESTAMPTZ,
  failed_attempts   INTEGER NOT NULL DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  last_login_at     TIMESTAMPTZ,
  created_by        UUID,                        -- admin_users.id of creator (nullable for seed)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_users_role_idx ON admin_users(role_key);

-- ── Append-only audit log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID,
  admin_email   TEXT,
  admin_role    TEXT,
  action        TEXT NOT NULL,                   -- e.g. 'user.suspend'
  resource_type TEXT,                            -- e.g. 'profile'
  resource_id   TEXT,
  before        JSONB,
  after         JSONB,
  ip            TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_admin_idx    ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS admin_audit_resource_idx ON admin_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx  ON admin_audit_logs(created_at DESC);

-- ── RLS: deny all (service role bypasses; client never reaches these) ───────
ALTER TABLE admin_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deny_all ON admin_roles;
DROP POLICY IF EXISTS deny_all ON admin_users;
DROP POLICY IF EXISTS deny_all ON admin_audit_logs;
CREATE POLICY deny_all ON admin_roles      FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY deny_all ON admin_users      FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY deny_all ON admin_audit_logs FOR ALL USING (false) WITH CHECK (false);

-- ── Seed the six system roles (kept in sync with adminPermissions.js) ──────
INSERT INTO admin_roles (key, name, description, permissions, is_system) VALUES
  ('super', 'Super Admin', 'Unrestricted access to every module and action.',
   '["*"]', true),

  ('operations', 'Operations Admin', 'Runs day-to-day operations: users, professionals, bookings, support.',
   '["ops.view","users.view","users.edit","users.suspend","professionals.view","professionals.verify","professionals.feature","kyc.view","kyc.decide","bookings.view","bookings.edit","bookings.cancel","finance.view","payouts.view","commission.view","plans.view","coupons.view","analytics.view","notifications.view","badges.manage","announcements.manage","support.view","support.assign","disputes.view","disputes.decide","reviews.moderate","health.view","audit.view"]', true),

  ('support', 'Support Admin', 'Handles tickets, disputes, reviews and read-only customer context.',
   '["ops.view","users.view","professionals.view","kyc.view","bookings.view","bookings.cancel","finance.view","notifications.view","support.view","support.assign","disputes.view","disputes.decide","reviews.moderate"]', true),

  ('finance', 'Finance Admin', 'Owns money: transactions, refunds, payouts, commission.',
   '["ops.view","bookings.view","finance.view","finance.refund","payouts.view","payouts.approve","payouts.release","payouts.manual","commission.view","commission.edit","plans.view","coupons.view","analytics.view","audit.view"]', true),

  ('marketing', 'Marketing Admin', 'Owns plans, coupons, campaigns, content, SEO and branding.',
   '["ops.view","plans.view","plans.manage","coupons.view","coupons.manage","analytics.view","notifications.view","email.manage","whatsapp.manage","badges.manage","announcements.manage","cms.manage","seo.manage","branding.manage"]', true),

  ('developer', 'Developer Admin', 'Owns integrations, feature flags, platform health and audit.',
   '["ops.view","notifications.view","integrations.view","integrations.manage","flags.manage","health.view","audit.view"]', true)
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      permissions = EXCLUDED.permissions,
      is_system = EXCLUDED.is_system;
