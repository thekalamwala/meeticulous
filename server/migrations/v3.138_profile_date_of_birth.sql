-- v3.138 — birthday greetings: collect DOB + track the yearly send.
--
-- date_of_birth is PRIVATE — never returned on the public profile (getHostProfile uses
-- explicit column selects that omit it). Collected optionally on the host profile
-- (PUT /api/host/profile) and the guest profile (PUT /api/auth/me).
-- birthday_greeted_at makes the daily birthday cron idempotent: greet once per calendar
-- year even though the cron ticks several times a day. Covers hosts AND guests (both
-- are `profiles` rows). Additive + idempotent.
-- APPLIED 2026-08-30 on staging (xwvciqkayammbvsidqig) + prod (ayjhlwyzszykqtnaktpb).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth       DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday_greeted_at TIMESTAMPTZ;

-- Narrow the daily scan to profiles that actually have a DOB; month/day is matched in
-- JS (a to_char index expression isn't IMMUTABLE, so it can't be indexed directly).
CREATE INDEX IF NOT EXISTS idx_profiles_has_dob
  ON profiles (date_of_birth) WHERE date_of_birth IS NOT NULL;
