-- v3.14_onboarding_otp_sendcap.sql — per-account OTP send cap for onboarding. Idempotent.
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS send_count integer NOT NULL DEFAULT 0;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS first_send_at timestamptz;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS send_locked_until timestamptz;
