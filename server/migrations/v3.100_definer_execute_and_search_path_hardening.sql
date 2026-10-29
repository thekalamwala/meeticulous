-- v3.100_definer_execute_and_search_path_hardening.sql
--
-- Pre-launch security hardening for Postgres functions. Sourced from the live
-- Supabase security advisor (prod ayjhlwyzszykqtnaktpb) on 2026-08-19.
--
-- Two classes of finding, both DB-side only (no application behaviour changes —
-- every function below is invoked exclusively by the server via the service_role
-- key, by a trigger, or by the nightly recompute cron; NONE are called by the
-- browser/anon client, verified by grepping client/src for .rpc()).
--
-- 1) SECURITY DEFINER functions executable by anon/authenticated via PostgREST
--    /rest/v1/rpc/<fn>. A DEFINER function runs with the owner's privileges, so
--    exposing it to anon lets anyone trigger it directly. Live prod drifted from
--    the intent in v3.91 (which revoked increment_invite_visit from anon) — the
--    grant came back (a later CREATE OR REPLACE reset it, restoring the default
--    PUBLIC EXECUTE). Re-assert the revokes and cover the score functions too.
--      * recompute_all_service_scores()  — full-table recompute → anon-triggerable DoS
--      * compute_service_score(uuid)      — internal scoring helper
--      * trg_recompute_service_score()    — trigger function, never call directly
--      * increment_invite_visit(text)     — anon could inflate invite visit counters
--
-- 2) Mutable (unpinned) search_path on functions. For SECURITY DEFINER functions
--    this is a privilege-escalation vector (search_path hijack); for the rest it
--    is defence-in-depth. Pin to a fixed, safe search_path. Behaviour is preserved
--    because every body references public objects, which stay resolvable via public.
--
-- Idempotent: REVOKE and ALTER FUNCTION ... SET are safe to re-run.
-- Apply on BOTH prod (ayjhlwyzszykqtnaktpb) and staging (xwvciqkayammbvsidqig).

BEGIN;

-- 1) Lock down anon/authenticated EXECUTE on server-only DEFINER functions.
--    service_role (used by supabaseAdmin) keeps EXECUTE via superuser bypass.
REVOKE ALL ON FUNCTION public.recompute_all_service_scores()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_service_score(uuid)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_recompute_service_score()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_invite_visit(text)        FROM PUBLIC, anon, authenticated;

-- 2) Pin search_path on every advisor-flagged mutable-search_path function.
ALTER FUNCTION public.create_invoice(text, text, text, text, uuid, text, text, text, text, text, text, text, jsonb, numeric, numeric, numeric, numeric, numeric, text, text)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.booking_grace_range(timestamptz, timestamptz, integer)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.search_kb_chunks(text, integer)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.match_kb_chunks(vector, integer)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.match_semantic_cache(vector, real)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.bump_cache_hit(uuid)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.increment_invite_visit(text)
  SET search_path = pg_catalog, public;

COMMIT;

-- Deferred / NOT auto-applied (documented for the audit, needs a maintenance window
-- or a dashboard toggle — do NOT run blindly):
--   * extension_in_public: btree_gist and vector live in schema public. Moving them
--     (ALTER EXTENSION ... SET SCHEMA extensions) can break dependent GiST indexes
--     and vector columns. Low severity; schedule during a maintenance window.
--   * auth_leaked_password_protection: enable in Supabase Dashboard →
--     Authentication → Policies (HaveIBeenPwned check). Not expressible as SQL.
