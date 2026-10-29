-- v3.13_admin_2fa.sql — Admin 2FA (TOTP). Idempotent.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_secret text;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_recovery_codes jsonb;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_enrolled_at timestamptz;
