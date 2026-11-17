-- ============================================================
-- v3.218 — analytics_events_size_bytes()
-- Companion to v3.217. Design §11.5 "size guard".
-- ------------------------------------------------------------
-- The ingest size guard reads a CACHED table-size figure, refreshed by
-- intel-rollup and intel-prune. It needs a way to ask Postgres how big
-- analytics_events actually is, and PostgREST cannot express
-- pg_total_relation_size — hence a function.
--
-- WHY IT IS NOT CALLED INLINE: measuring per beacon would make the guard the
-- very load it exists to prevent. It is sampled hourly by the rollup and daily
-- by the prune, and the cached value is what the ingest path consults.
--
-- SECURITY: SECURITY DEFINER, because pg_total_relation_size needs more
-- privilege than the caller has — but EXECUTE is granted to service_role ONLY,
-- per v3.186, which revoked anon/authenticated EXECUTE on every SECURITY
-- DEFINER function after the host_activation leak. A new function does not get
-- anon EXECUTE by default any more; this grant is explicit so the intent is on
-- the record rather than inherited.
--
-- It returns a size, nothing about any host, so it leaks nothing even if the
-- grant were ever widened by mistake.
-- ============================================================

CREATE OR REPLACE FUNCTION analytics_events_size_bytes()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(pg_total_relation_size('public.analytics_events'), 0)::bigint;
$$;

REVOKE ALL ON FUNCTION analytics_events_size_bytes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics_events_size_bytes() TO service_role;

COMMENT ON FUNCTION analytics_events_size_bytes() IS
  'Total bytes of analytics_events incl. indexes and toast. Sampled by intel-rollup/intel-prune into the ingest size guard; never called on the ingest path.';
