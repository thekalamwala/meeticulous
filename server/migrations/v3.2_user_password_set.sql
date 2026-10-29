-- v3.2 — Track whether a user has chosen their own password
-- 1. profiles.password_set : true once the user sets a real password.
--
-- Guest profiles are created with a random throwaway password
-- (ensureGuestProfile), so "has a Supabase password" != "user knows it".
-- This flag is the honest signal: false → route through OTP and offer to set
-- one; true → phone+password login is allowed.
--
-- Safe to run multiple times. Additive only — no data destroyed.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_set BOOLEAN NOT NULL DEFAULT false;
