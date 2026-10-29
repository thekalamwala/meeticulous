-- v3.1 — One account per phone number (end-user login hardening)
-- 1. profiles_phone_unique_idx : partial unique index on profiles.phone
--
-- Partial: only non-blank phones are constrained. Profiles without a phone
-- (NULL or empty/whitespace) are excluded, so the many accountless-of-phone
-- rows never collide with each other.
--
-- Safe to run multiple times. Additive only — no data destroyed.

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND btrim(phone) <> '';
