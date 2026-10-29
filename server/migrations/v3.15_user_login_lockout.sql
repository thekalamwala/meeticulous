-- v3.15_user_login_lockout.sql — per-account login lockout for users/vendors. Idempotent.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_locked_until timestamptz;
