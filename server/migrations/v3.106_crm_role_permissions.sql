-- ============================================================
-- v3.106 — Grant leads.* CRM permissions to marketing + operations roles.
--
-- Permissions are resolved from admin_roles.permissions (DB) at login and
-- embedded in the admin JWT (adminAuthController.resolvePermissions), so the
-- code catalog in lib/adminPermissions.js is NOT enough on its own — the DB
-- role rows must carry the new perms too. `super` is the wildcard ['*'] and
-- needs no change.
--
-- Takes effect on each affected admin's NEXT login (perms are baked into the
-- JWT at sign-in). Idempotent: DISTINCT dedups, so re-running is a no-op.
--
-- Run on STAGING (Tokyo) first, then PROD (Mumbai).
-- ============================================================

UPDATE admin_roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT elem)
  FROM jsonb_array_elements(
    permissions || '["leads.view","leads.manage"]'::jsonb
  ) AS elem
)
WHERE key IN ('marketing', 'operations')
  AND permissions IS NOT NULL
  AND NOT (permissions @> '["*"]'::jsonb);  -- never touch a wildcard role
