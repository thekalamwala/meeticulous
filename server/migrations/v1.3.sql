-- ============================================================
-- Meeticulous — v1.3 Migration
-- Run in Supabase SQL Editor before deploying v1.3
-- ============================================================

-- ── Fix: thumbnail_url on services (may not have been applied) ──
ALTER TABLE services ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- ── Grace period per service ─────────────────────────────────
-- How many minutes to block before/after a booking
-- e.g. 10 → booking 10:00-11:00 blocks 9:50-11:10
ALTER TABLE services ADD COLUMN IF NOT EXISTS grace_period_minutes INTEGER DEFAULT 10;

-- Backfill existing services with default grace period
UPDATE services SET grace_period_minutes = 10 WHERE grace_period_minutes IS NULL;

-- ── OTP type column ──────────────────────────────────────────
-- Distinguishes booking OTPs from password-reset OTPs
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'booking';

-- Index for efficient lookup by email + type
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_type ON otp_codes(email, type);

-- ── Admin user seed ──────────────────────────────────────────
-- IMPORTANT: Run this separately via Supabase Auth Admin API or Dashboard.
-- The admin user (credentials kept out of the repo) must be created manually
-- in Supabase Auth then given role 'superadmin' via:
--
--   UPDATE profiles SET role = 'superadmin' WHERE email = '<admin email>';
--
-- Or run the helper below AFTER the auth user has been created:
-- UPDATE profiles SET role = 'superadmin', name = 'Super Admin'
--   WHERE email = '<admin email>';
