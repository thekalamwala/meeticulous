-- v3.69 — Drop dead permissive anon INSERT policies on bookings + product_purchases
-- ============================================================================
-- SECURITY (hardening follow-up to v3.27)
--
-- BACKGROUND: two tables still carry `FOR INSERT WITH CHECK (true)` policies that
-- predate the API-only access model:
--   * bookings          -> "Anyone can create bookings"          (config/schema.sql)
--   * product_purchases -> "Anyone can insert product purchases"  (v1.6_catchup.sql)
--
-- These are DEAD on the running DBs: v3.27 blanket-revoked INSERT/UPDATE/DELETE
-- from anon + authenticated, and Postgres checks the table privilege BEFORE the
-- RLS policy, so an anon-key insert fails with `permission denied` before the
-- `WITH CHECK (true)` is ever evaluated. All real writes use the service_role key
-- (which bypasses RLS), so these policies protect nothing and grant nothing.
--
-- RISK THEY LEAVE: the revoke lives only in v3.27, applied out-of-band. The
-- schema-of-record (config/schema.sql relies on Supabase default grants; the
-- staging_schema.sql pg_dump still emits GRANT ALL ... TO anon). A rebuild-from-
-- schema that skips v3.27 would re-open the FULL anon insert path — bypassing the
-- OTP grant gate, per-host quota, and the server-side pricing snapshot.
--
-- FIX: drop the permissive policies outright, and re-assert the v3.27 revoke
-- (idempotent) so this migration is self-sufficient in any replay ordering.
-- No behaviour change: nothing legitimately inserts via anon/authenticated.
--
-- Apply on BOTH DBs (prod ayjhlwyzszykqtnaktpb, staging xwvciqkayammbvsidqig)
-- via the Supabase SQL Editor, then verify (see tail of file).
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can create bookings" ON bookings;
DROP POLICY IF EXISTS "Anyone can insert product purchases" ON product_purchases;

-- Re-assert v3.27 (idempotent) so a schema replay that reaches this migration is
-- safe even if v3.27 was skipped. Repeating REVOKE on already-revoked privileges
-- is a no-op. SELECT is deliberately left intact so no read path breaks.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;

-- ── Verify (run manually after applying, expect the commented results) ──
-- SELECT has_table_privilege('anon','bookings','INSERT')          AS bookings_anon_insert,          -- f
--        has_table_privilege('anon','product_purchases','INSERT') AS product_purchases_anon_insert;  -- f
-- SELECT tablename, policyname FROM pg_policies
--   WHERE tablename IN ('bookings','product_purchases') AND cmd = 'INSERT';  -- 0 rows
