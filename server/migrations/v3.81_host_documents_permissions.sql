-- v3.81 — split host document access out of kyc.view
--
-- Host 360 (v3.80) shipped a Documents tab that served BOTH the host's submitted
-- KYC identity documents and the commercial paperwork ops uploads against a host,
-- behind the single `kyc.view` permission. The support role holds kyc.view, so
-- support staff could read every host document. Those are two different needs, so
-- they are now two different grants: `documents.view` / `documents.manage`.
--
-- Login resolves permissions from THIS table first (adminAuthController
-- .resolvePermissions), falling back to lib/adminPermissions.js only when the row
-- is missing — so the lib change alone does not reach existing staff. This runs
-- the same grant into the DB.
--
-- Effect: operations gains both; support gains neither (the point); super is
-- wildcard '*' and is untouched. Takes effect on each staff member's NEXT login,
-- since the permission array is embedded in the admin JWT at sign-in.
--
-- Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).

-- Idempotent: appends only the permissions that are not already present.
update admin_roles
set permissions = (
      select jsonb_agg(distinct p)
      from jsonb_array_elements(permissions || '["documents.view","documents.manage"]'::jsonb) as p
    )
where key = 'operations';

-- Verify (expect operations = true, support = false):
--   select key,
--          permissions ? 'documents.view'   as can_view,
--          permissions ? 'documents.manage' as can_manage
--   from admin_roles where key in ('operations', 'support');
