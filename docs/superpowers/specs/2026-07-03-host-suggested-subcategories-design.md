# Host-Suggested Subcategories — Design

**Date:** 2026-07-03
**Status:** Approved (design) — pending implementation plan
**Scope:** Let hosts suggest new service subcategories for professions that opt in; admins approve/reject. Curated professions stay locked.

## Background

The taxonomy has two levels:

- **Profession** — `categories` table (74 active). Maps to `profiles.primary_category`. Already has a suggestion→approval flow (`status`: active/disabled/pending/rejected, `suggested_by`), managed on `/admin/professions`.
- **Subcategory** — `service_categories` table (profession-scoped by `primary_category`; ~1416 rows after the 2026-07-03 backfill). Hosts pick one for each service via `services.category` (slug). Today this table is **admin-CRUD only** — no host input, no approval workflow. Columns: `id, primary_category, name, slug, display_order, is_active, description, icon, created_at, updated_at`.

Goal: allow hosts to propose subcategories, but only for professions the admin has explicitly opened — so the curated 74 stay clean while newly added/host-suggested professions can grow organically.

Out of scope (this spec): notifying hosts on approve/reject (deferred), a third taxonomy level, editing existing subcategory names by hosts.

## Data Model

One migration, applied to **both** DBs (prod Mumbai `ayjhlwyzszykqtnaktpb`, staging Tokyo `xwvciqkayammbvsidqig`).

```sql
-- Per-profession opt-in gate. OFF by default protects the curated 74.
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS allow_subcategory_suggestions BOOLEAN NOT NULL DEFAULT false;

-- Subcategory lifecycle. Existing rows backfill to 'active'.
ALTER TABLE service_categories
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',   -- active | pending | rejected
  ADD COLUMN IF NOT EXISTS suggested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Existing curated rows are already active (default). New host suggestions
-- insert status='pending', is_active=false, suggested_by=<host>.
```

Notes:
- Keep the existing `is_active` flag. Effective visibility = `is_active = true AND status = 'active'`. A pending row is `is_active=false, status='pending'`. Approve sets both to active; reject sets `status='rejected'` (stays `is_active=false`).
- Uniqueness stays `(primary_category, slug)` as enforced today by `uniqueSlug()` in `serviceCategoryController.js`. A host suggestion that collides with an existing slug (any status) is rejected at the API with a clear message.

## Backend

All in `server/controllers/serviceCategoryController.js` + `serviceCategoryRoutes.js` unless noted.

### 1. Read filters (leak prevention)
Public read (`listPublic`, `GET /api/service-categories?primary=`) and any host-facing category fetch must add `status = 'active'` alongside the existing `is_active` filter, so pending/rejected never appear on live pages, the onboarding picker, or the service form's normal list.

`listAdmin` (`GET /api/admin/service-categories`) returns **all** statuses (admin needs to see pending). Add `status` + `suggested_by` (+ suggester name) to its payload.

### 2. Host suggest endpoint
`POST /api/service-categories/suggest` — authenticated host.
Body: `{ primary_category, name }`.
Guards, in order:
1. Auth = host.
2. `categories.allow_subcategory_suggestions = true` for `primary_category`, else `403` "This profession isn't accepting suggestions."
3. Host actually belongs to that profession (`profiles.primary_category === primary_category`), else `403`.
4. `name` length/sanity; slugify via existing `slugify()`.
5. Slug not already present for that profession (any status), else `409` "Already exists."
Insert `{ primary_category, name, slug, status:'pending', is_active:false, suggested_by:<host.id>, display_order: <max+1> }`. Return the pending row.

Rate/abuse: cap pending suggestions per host per profession (e.g. 5 open) to prevent spam — return `429` past the cap.

### 3. Admin approve / reject
Reuse `PUT /api/admin/service-categories/:id` (`updateAdmin`). Accept `status` in the whitelist:
- Approve → `status='active', is_active=true`.
- Reject → `status='rejected', is_active=false`.
Bust public caches on approve (public pages embed the list). Audit-log the action.

### 4. Toggle endpoint
Set `categories.allow_subcategory_suggestions`. Reuse the existing category update path (`adminUpdateCategory` / `PUT /admin/categories/:id`) — add the boolean to its whitelist. No new route.

## Frontend

### Host — service form (`client/src/pages/services/ServiceForm.jsx`)
The subcategory picker already loads `listServiceCategories(primary)`. When the host's profession has `allow_subcategory_suggestions = true`, append a **"+ Suggest new subcategory"** action under the dropdown. It opens a small modal (name input) → `POST /service-categories/suggest` → toast "Sent for approval." The host's service keeps its current/none subcategory; the pending item does **not** appear in their pickable list until approved. (The profession's `allow_*` flag can ride along on the category list response or a lightweight profile field to avoid an extra call.)

### Admin — `/admin/services/categories` (`AdminServiceCategories.jsx`)
- **Pending queue** section (mirrors the professions page pattern in `AdminCategories.jsx`): each pending row shows name, profession, suggested-by, with **Approve** / **Reject** buttons (call the existing update endpoint with `status`).
- **Per-profession toggle**: an "Allow host suggestions" switch. Placement: simplest on the professions admin (`/admin/professions`, `AdminCategories.jsx`) as a column/control per profession, since that page already lists professions. Alternatively surface it in the service-categories page's profession filter header. Decide during planning; leaning on the professions page.

## Data Flow

```
Host (service form)
  └─ POST /service-categories/suggest {primary_category, name}
       ├─ guard: profession opted in + host in profession + unique slug
       └─ INSERT service_categories status=pending, is_active=false, suggested_by
Admin (/admin/services/categories → Pending queue)
  ├─ Approve → PUT /admin/service-categories/:id {status:'active'} (+is_active=true) → cache bust
  └─ Reject  → PUT /admin/service-categories/:id {status:'rejected'}
Public / onboarding / service form list
  └─ GET service-categories filters is_active=true AND status='active' (pending never leaks)
```

## Error Handling
- Suggest on a locked profession → 403, toast "Not accepting suggestions right now."
- Duplicate slug → 409, toast "That subcategory already exists."
- Over the open-suggestion cap → 429, toast "You have too many pending suggestions."
- Approve/reject on a non-pending row → idempotent no-op (still returns 200 with current state).

## Testing
- **Unit (server):** suggest endpoint guards (locked profession, wrong profession, duplicate slug, cap); read filters exclude pending/rejected; approve/reject transitions set both flags correctly.
- **Unit (client):** service form shows the suggest action only when the flag is on; admin pending queue renders + calls update with the right status.
- **Migration:** verify on both DBs — existing rows all `status='active'`, new columns present, default `allow_subcategory_suggestions=false`.
- **Manual:** open a test profession, suggest as a host, approve as admin, confirm it appears in the picker; reject flow; confirm curated professions show no suggest action.

## Rollout
1. Apply migration to staging → prod (both DBs), keep code-side status filter defensive until confirmed.
2. Ship backend (filters + suggest + toggle) behind the existing patterns.
3. Ship frontend.
4. Flip `allow_subcategory_suggestions = true` only on chosen new professions. Curated 74 stay off.

## Decisions (from brainstorming)
- "Subcategory" = `service_categories` (no new level).
- Gate = **explicit per-profession admin toggle**, default off.
- Suggest UX = in the **service form**, usable **only after approval**.
- Host notification on approve/reject = **skipped for MVP**.
