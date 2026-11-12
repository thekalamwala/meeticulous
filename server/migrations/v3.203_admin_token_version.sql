-- v3.203 — Admin session revocation (security audit F-02)
--
-- Problem: the admin session JWT is stateless (8h TTL, permissions embedded at
-- login). Deactivating, demoting or password-resetting an admin did NOT
-- invalidate their live token — it kept full access for up to 8h, and a stolen
-- token could not be revoked at all.
--
-- Fix: a monotonically increasing per-admin token_version. It is stamped into
-- each session JWT (`tv`); adminMiddleware rejects a token whose version is
-- behind the DB. staffAdminController bumps it on deactivate / demote / reset.
--
-- SAFE TO DEPLOY BEFORE APPLYING: additive column (DEFAULT 0) and the middleware
-- FAILS OPEN — a missing column / DB error / a token with no `tv` all ALLOW the
-- request, so this can never lock admins out; worst case it simply doesn't revoke
-- yet. Apply to BOTH DBs, then the code-side schema fallback becomes a no-op.

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

-- Atomic increment, called by the server (service_role) when invalidating an
-- admin's sessions. Locked to service_role only — never anon/authenticated
-- (matches the v3.186 RPC lockdown posture; new functions must not be browser-callable).
CREATE OR REPLACE FUNCTION public.increment_admin_token_version(p_id uuid)
RETURNS integer
LANGUAGE sql
AS $$
  UPDATE public.admin_users
     SET token_version = token_version + 1,
         updated_at    = now()
   WHERE id = p_id
  RETURNING token_version;
$$;

REVOKE ALL ON FUNCTION public.increment_admin_token_version(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_admin_token_version(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.increment_admin_token_version(uuid) FROM authenticated;
