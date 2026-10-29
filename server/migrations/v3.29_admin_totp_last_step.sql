-- ============================================================
-- v3.29 — Admin TOTP replay prevention: last_totp_step
--
-- Purpose: Record the most recent successfully-consumed TOTP time
--          step per admin so a captured 6-digit code can't be
--          replayed within the speakeasy ±1-step (≈90s) window.
--          The verify path rejects any code whose step is <= the
--          stored last_totp_step, then persists the new step.
--
-- Additive only. Safe to re-run — uses IF NOT EXISTS.
-- Server code uses the schema-fallback pattern, so it works
-- before and after this migration is applied.
-- Run this in Supabase SQL Editor.
-- ============================================================

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_totp_step bigint;

COMMENT ON COLUMN admin_users.last_totp_step IS
  'Last successfully-consumed TOTP time step (floor(unixtime/30)+delta). '
  'Codes with step <= this value are rejected to prevent replay.';

-- ─── Done ────────────────────────────────────────────────────
