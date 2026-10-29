-- v3.49 — pin sync_host_role search_path (audit P3-2)
--
-- The sync_host_role trigger (BEFORE INSERT/UPDATE on profiles, computes
-- role/is_host) was missing an explicit search_path — flagged by the Supabase
-- function_search_path_mutable advisor. Pin it (matches the hardening applied to
-- the v3.23 functions). Low severity (not SECURITY DEFINER) but it runs on every
-- profiles write, so pin it for hygiene / advisor-clean.

ALTER FUNCTION public.sync_host_role() SET search_path = public, pg_temp;
