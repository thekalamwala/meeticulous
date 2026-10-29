-- v3.140 — revoke public EXECUTE on merge_lead_rows (audit F5).
--
-- merge_lead_rows(p_survivor uuid, p_loser uuid) is a SECURITY DEFINER function
-- that reparents seven child tables and DELETEs a leads row, running as the
-- definer (bypassing RLS). It shipped in v3.130 without a REVOKE, so EXECUTE was
-- left granted to PUBLIC / anon / authenticated — the ONLY definer function in the
-- database still callable with the public anon key. Every other definer function
-- was locked to service_role by v3.100.
--
-- Exploitation needs two lead UUIDs (unguessable), so this is a latent hole rather
-- than an open door — but an unguessable id is not an authorization boundary, the
-- operation is destructive and irreversible, and the function is only ever called
-- server-side (leadService.upsertLead via supabaseAdmin / service_role, which keeps
-- EXECUTE through the superuser bypass). Lock it to the same posture as every other
-- definer function.
--
-- Idempotent (REVOKE is safe to re-run). Apply on BOTH prod (ayjhlwyzszykqtnaktpb)
-- and staging (xwvciqkayammbvsidqig).

REVOKE ALL ON FUNCTION public.merge_lead_rows(uuid, uuid) FROM PUBLIC, anon, authenticated;
