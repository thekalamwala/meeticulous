-- ============================================================
-- v3.206 — Lock down anon/authenticated WRITE access to public tables
-- (project audit, 2026-11-12). Companion to v3.205 (profiles column SELECT)
-- and v3.186 (functions + views).
-- ------------------------------------------------------------
-- VULN (confirmed live 2026-11-12): several tables carried permissive RLS write
-- policies for roles {anon, authenticated} AND the matching table write grants,
-- so ANY signed-in user could write straight through the publishable anon key
-- (shipped in the client bundle), bypassing the Express server + its checks:
--   * profiles  "Users can update own profile" (no column limit, no WITH CHECK)
--               → set own plan / plan_expires_at / is_verified / is_banned / role;
--   * bookings  "Participants can update bookings"
--               → set payment_status / status / vendor_amount / settlement fields;
--   * payout_requests → insert a request for any amount (skips balance + KYC);
--   * reviews   → insert a review for any host with no booking;
--   * services / products / availability → write, skipping plan limits + validation.
-- No trigger guards any of these columns.
--
-- WHY SAFE: the browser uses supabase-js for AUTH + REALTIME only and never writes
-- a table through PostgREST. Every write in the product goes through the Express
-- API with the service_role key, which bypasses grants + RLS. So removing
-- anon/authenticated WRITE access changes nothing for the app. (SELECT is left as
-- is — v3.205 already scoped the one real read exposure, profiles columns.)
--
-- REVERSIBLE: this only REVOKEs grants and sets a default-privilege. To roll back,
-- re-GRANT the writes. The permissive write POLICIES are deliberately NOT dropped
-- here (so rollback needs no policy re-creation); with no grant behind them they
-- are unreachable. They can be dropped in a later hygiene migration.
--
-- APPLY TO the Meeticulous DB (spquowzrefozmrzoszkf). Idempotent.
-- ============================================================

-- 1. Revoke write on every CURRENT public table from the public API roles.
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 2. Future tables created by postgres in public: no automatic anon/auth write.
--    A table the browser must write directly (none today) would need an explicit
--    GRANT in its own migration — fail-safe, matching v3.186 for functions.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated;
