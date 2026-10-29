-- v3.30 — Re-assert the anon/authenticated SELECT lock on profile secret columns
-- ============================================================================
-- SECURITY (audit L3 — source-control reproducibility)
--
-- The live databases already have anon/authenticated SELECT revoked on these
-- columns (the emergency fix for the historical anon-key token/PII read leak was
-- applied out-of-band and is NOT otherwise reproducible from repo migrations).
-- Committing it here ensures a fresh build (staging / DR / a new environment)
-- comes up locked instead of re-exposing Google tokens + OTP + PII via the
-- "Profiles are viewable by everyone" policy.
--
-- Idempotent (re-running REVOKE is a no-op). MUST run before v3.24 drops these
-- columns; once v3.24 has run the columns no longer exist and this is obsolete.
-- ============================================================================

REVOKE SELECT (
  google_access_token,
  google_refresh_token,
  otp_code,
  otp_expires_at,
  is_otp_verified
) ON public.profiles FROM anon, authenticated;
