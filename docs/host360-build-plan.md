# Host 360° — v1 Build Plan

Admin operational command-center for a single host. Aggregation layer, not a new system of record.
Route: `/admin/host360` (list) + `/admin/host360/:hostId` (detail). Super-admin surface.
Host-facing CRM (`/dashboard/clients`, previously internally "Host 360") is renamed **Customers**.

## Locked scope
- New tables (3): `account_managers`, `host_admin_notes`, `host_documents` + `profiles.account_manager_id`.
- Account Manager = the "Assigned Team Member". CRUD folded into AdminStaff.
- No per-host team members (host is single-user).
- No impersonation. No refund. No last_login/last_activity.
- Documents reuse the private `kyc` bucket.
- Quick actions v1: View Profile, Suspend/Reactivate, Change Plan/Extend Trial, Generate Invoice,
  Add Internal Note, Assign Account Manager, Send Email (single host). No WhatsApp.
- All writes audited via `audit(req,{...})`.

## Phase 0 — Rename host CRM → Customers
- `client/src/App.jsx` ClientsList/ClientDetail labels + any "Host 360" string.
- Host CRM page titles/sidebar → "Customers". DB/`crm_*` untouched.

## Phase 1 — Migration `v3.80_host360.sql` (both DBs)
- `account_managers(id, name, email, phone, is_active, created_at, updated_at)`
- `profiles.account_manager_id uuid null references account_managers(id) on delete set null`
- `host_admin_notes(id, host_id->profiles, admin_id, admin_email, body, created_at, updated_at)`
- `host_documents(id, host_id->profiles, uploaded_by, storage_key, file_name, mime_type, size_bytes, doc_type, created_at)`
- All RLS enabled, no policies (service-role only). Indexes on host_id/created_at + account_manager_id.
- Documents reuse `kyc` bucket, keys namespaced `host-docs/<hostId>/...`.

## Phase 2 — Server: `host360Controller.js` + `host360Routes.js` (mount `/api/admin/host360`)
Aggregator reusing existing services. Routes gated by requireAdmin(perm). Endpoints:
list, :id header/overview, usage, billing, timeline (UNION), customers, support, documents,
notes CRUD, actions (suspend/plan/invoice/assign-am/email), account-managers CRUD.
Timeline UNION: admin_audit_logs(resource=profile) + plan_purchases + bookings + ledger_entries
+ email_logs(recipient_user_id) + scheduled_followups + profiles timestamps.

## Phase 3 — Client: Host360List + Host360Detail (+ 7 tabs, no team-members)
Reuse components/admin/ui primitives + --adm-* tokens. Lazy tabs. Route in App.jsx under AdminWrapper,
PATH_LABELS entry, DEPT_LINKS card (operation+support), menu perm users.view. sessionCan gating.

## Phase 4 — Account Managers in AdminStaff
CRUD account_managers; assign-AM control in Host360 header + list row action.

## Effort ~8-9 days nominal; compressed build session.
Deferred: comms history, security tab, WhatsApp, AI Health/Churn/Quality widgets.
