-- v3.170 — LinkedIn account verification (host "LinkedIn Verified" badge).
-- A logged-in host links their LinkedIn identity via Supabase linkIdentity();
-- the server confirms the linked identity (source of truth) and stamps these
-- columns, then awards the manual "LinkedIn Verified" badge.
-- Additive + schema-fallback safe: authController.verifyLinkedin degrades to
-- badge-only if these columns are not yet applied.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS linkedin_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS linkedin_sub         TEXT;

COMMENT ON COLUMN profiles.linkedin_verified_at IS 'When the host verified LinkedIn ownership (Supabase linkedin_oidc identity link). NULL = not verified.';
COMMENT ON COLUMN profiles.linkedin_sub         IS 'LinkedIn OIDC subject id from the linked identity (audit / de-dupe).';
