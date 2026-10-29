-- v3.27 — Revoke write privileges on public tables from browser-facing roles
-- ============================================================================
-- SECURITY (audit findings C1, C2, H2, H3 — June 2026)
--
-- ROOT CAUSE: the Supabase `anon` and `authenticated` roles retained
-- INSERT/UPDATE/DELETE grants on public-schema tables, and the RLS policies
-- permit self-row writes (e.g. profiles UPDATE USING auth.uid()=id,
-- bookings UPDATE USING auth.uid() IN (host_id,guest_id)). Because the anon key
-- ships in the client bundle and every logged-in user holds a real Supabase JWT,
-- a user could bypass the Express API entirely and write security-critical
-- columns directly via PostgREST:
--   * profiles.plan / plan_expires_at / is_verified  -> free plan upgrade, fake verify
--   * profiles.role / username                       -> identity / username-gate bypass
--   * bookings.payment_status / status / vendor_amount -> mark booking paid w/o paying
--   * payout_requests (INSERT)                        -> fabricated payout, attacker amount
--   * services / products (INSERT/UPDATE)             -> plan-cap & validation bypass
--
-- FIX: the application performs ALL database access via the Express server using
-- the service_role key, which BYPASSES RLS and is unaffected by these revokes.
-- The browser uses supabase-js only for GoTrue auth + storage uploads, neither of
-- which touches public-schema tables (verified: no client `.from('<table>')`).
-- We therefore revoke write privileges from anon + authenticated. SELECT is left
-- intact so no read path can break. Reversible via GRANT if ever required.
--
-- Applied live to prod (ayjhlwyzszykqtnaktpb) + staging (xwvciqkayammbvsidqig)
-- 2026-06-23 and verified (has_column_privilege -> false for the columns above).
-- ============================================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

-- Lock tables created by future migrations (run as the postgres role) too, so a
-- newly-added table doesn't silently re-open the write surface.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;
