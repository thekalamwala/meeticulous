# Studio Client CRM ("Host 360") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Dispatch a fresh subagent per task, review between tasks. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Reconstruction note (2026-07-15):** the original 07-14 spec file was never committed and was lost. This doc was rebuilt from the locked design (memory `studio-crm-plan`) + the `build-studio-crm` scheduled-task SKILL + live-codebase verification. Where it names an export/pattern, that anchor was checked against the current tree. Prefer the live codebase over this doc on any conflict, and note deviations in the PR.

**Goal:** Give Studio (`professional`) hosts a per-client CRM — one card per real person who has booked them, with booking history, private notes, uploaded files, and light attributes/tags — fulfilling the five Studio features already SOLD in the pricing table (`client/src/data/plans.js:132-137`: Booking history, Client records, Client history, Client notes, Recurring clients).

**Architecture:** A **client is DERIVED**, not a new identity. `crmService` aggregates a host's paid `bookings` in-Node, grouped by a normalized `customerKey` (phone `p:<10digits>`, else email `e:<lower-email>`). History and reviews are read LIVE from `bookings`/`reviews` — never copied. A thin `crm_customers` row (UUID handle + `attributes jsonb`) hangs private notes (`crm_notes`) and files (`crm_files`, private bucket `customer-files`) off that key. Studio-gated by a new `requireCrm` middleware + `crm` feature flag. Notes are **plaintext + RLS/service-role lock** (founder-confirmed security decision A — NOT field-encrypted).

**Tech Stack:** Node/Express, Supabase (PostgREST + RLS), multer memory-storage → private Storage bucket, React (Vite), Jest (server, `server/tests/unit/`), Vitest (client).

## Global Constraints

- **Client identity = `customerKey(booking)`** → `p:<10digits>` when a valid Indian phone exists, else `e:<lowercased email>`, else skip (no key = not a CRM client). Same normalization the notifications/settlement code already uses conceptually; centralize it in ONE util so list, detail, notes, and files all agree.
- **In-Node aggregation, known ceiling ~5k bookings/host.** `// ponytail: in-Node groupBy, add an aggregation RPC (Phase 8) if any host crosses ~5k bookings.` No materialized view now.
- **Nothing duplicated.** `crm_customers` stores ONLY host-authored data (attributes/tags) + the stable UUID handle. Name/phone/email/history/reviews are read live from `bookings`/`reviews` on every request. A booking edit must never require a CRM write.
- **Studio-only, fails closed.** `requireCrm` reads `req.vendorPlanData.limits.crm` (`-1` = allowed). Starter/Creator = `0` → `403 { upgrade_required:true }`. On any error, deny (matches `planMiddleware` fail-closed pattern).
- **Every endpoint is host-scoped.** Every query filters `.eq('host_id', req.user.id)`. Never trust a `host_id` from the body/query. Respect the past `supabase-anon-api-exposure` incident: CRM tables get RLS ENABLED with NO policies (service-role only; anon/auth can never read).
- **No PII in URLs.** Routes address clients by the UUID `crm_customers.id` (the handle), never by phone/email. The `customerKey` stays server-side.
- **Files:** private bucket `customer-files`, multer memory-storage, **2MB cap**, magic-byte sniff against an allowlist (pdf/jpg/png/webp) — reject on mismatch even if the extension/mimetype claims otherwise. Download only via **60s signed URLs** (`SIGNED_URL_TTL_SECONDS = 60`, mirror `productController`). Store only the storage key, never a public URL.
- **Migrations run manually on BOTH DBs** (staging Tokyo `STAGING_PROJECT_REF` FIRST, then prod Mumbai `PROD_PROJECT_REF`); keep code-side destructure fallback until confirmed applied. Migration file `v3.76_crm.sql` (v3.75 + v3.77 exist; 76 is the free slot reserved for CRM).
- **Server tests:** `server/tests/unit/*.test.js`, jest (`describe`/`test`/`expect`, `require('../../...')`). **Client tests:** Vitest, NO jest-dom — assert with `.getAttribute()` / `.textContent`.
- Preserve existing behaviour; do not rename routes/columns. Auth middleware is `{ protect, requireHost }` from `server/middleware/authMiddleware.js`. Plan resolution is `req.vendorPlan` / `req.vendorPlanData` via `attachPlan` (`planMiddleware`); Studio slug = `professional`.
- **Phases 1-5 = v1** (already built by the 2026-07-15 scheduled run). **Phase 6** = Host-360 enrichments + walk-in cash bookings (this addendum). **Do NOT build Phase 8 fast-follows:** custom-fields UI, note encryption (option B), aggregation RPC, and the v1-gap-review backlog.

---

## PHASE 1 — Foundation (data + gate)

### Task 1: Migration — CRM tables, RLS, limits.crm, private bucket

**Files:**
- Create: `server/migrations/v3.76_crm.sql`

**Interfaces:**
- Produces: tables `crm_customers`, `crm_notes`, `crm_files` (all RLS-on, no policies); `subscription_plans.limits.crm` set (starter 0, creator 0, professional -1); private bucket `customer-files`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- v3.76_crm.sql — Studio Client CRM. Thin host-authored layer over derived clients.
-- Clients themselves are DERIVED from bookings in-Node; these tables hold ONLY
-- host-authored data keyed by a stable customer_key. Idempotent.
-- Apply on BOTH DBs (staging Tokyo FIRST, then prod Mumbai).

-- One row per (host, normalized customer key). The UUID id is the public handle
-- used in URLs; customer_key ('p:<digits>' | 'e:<email>') stays server-side.
CREATE TABLE IF NOT EXISTS crm_customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_key TEXT NOT NULL,                 -- 'p:9876543210' | 'e:jane@x.com'
  attributes   JSONB NOT NULL DEFAULT '{}',   -- host tags / light custom fields (UI deferred)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (host_id, customer_key)
);

CREATE TABLE IF NOT EXISTS crm_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  host_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,                  -- PLAINTEXT (security decision A)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  host_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_key  TEXT NOT NULL,                 -- key in private 'customer-files' bucket
  file_name    TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  size_bytes   INT  NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_host      ON crm_customers(host_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_customer      ON crm_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_files_customer      ON crm_files(customer_id);

-- RLS ENABLED, NO POLICIES = service-role only. anon/auth can never read/write.
-- (Respects supabase-anon-api-exposure: the app reaches these ONLY via supabaseAdmin.)
ALTER TABLE crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_files     ENABLE ROW LEVEL SECURITY;

-- Plan limit: -1 unlimited (Studio), 0 = not included.
UPDATE subscription_plans SET limits = jsonb_set(COALESCE(limits,'{}'), '{crm}', '-1') WHERE slug = 'professional';
UPDATE subscription_plans SET limits = jsonb_set(COALESCE(limits,'{}'), '{crm}', '0')  WHERE slug IN ('starter','creator');
```

- [ ] **Step 2: Apply on BOTH DBs via Supabase MCP** — staging Tokyo (`STAGING_PROJECT_REF`) FIRST, then prod Mumbai (`PROD_PROJECT_REF`). Then create the **private** Storage bucket `customer-files` on both (Storage → New bucket → public OFF). Run `get_advisors` (security) on both after applying.

- [ ] **Step 3: Verify** — on BOTH DBs:
  `SELECT slug, limits->>'crm' FROM subscription_plans ORDER BY slug;` → `creator=0, professional=-1, starter=0`. Confirm the three tables exist with `rowsecurity = true` and zero policies.

---

### Task 2: `customerKey` util — the single source of client identity

**Files:**
- Create: `server/utils/customerKey.js`
- Create: `server/tests/unit/customerKey.test.js`

**Interfaces:**
- Exports: `customerKey({ phone, email }) -> 'p:<10digits>' | 'e:<lower-email>' | null` and `displayFromKey(key) -> { type, value }`.

- [ ] **Step 1 (TDD): Write the test first.**
  - `{ phone: '+91 98765 43210' }` → `'p:9876543210'`.
  - `{ phone: '98765-43210' }` → `'p:9876543210'`.
  - phone missing/invalid + `{ email: 'Jane@X.COM ' }` → `'e:jane@x.com'`.
  - phone valid AND email present → phone WINS (`p:` prefix).
  - neither present / junk phone + no email → `null`.

- [ ] **Step 2: Implement.** Strip non-digits from phone; keep last 10; accept only if exactly 10 digits remain. Else lowercase+trim email if it contains `@`. Else `null`. `// ponytail: last-10-digits is the naive India-only rule; widen if intl guests appear.`

---

### Task 3: `requireCrm` gate + `crm` feature flag

**Files:**
- Edit: `server/middleware/planMiddleware.js` (add `requireCrm`, export it)
- Edit: `server/config/featureRegistry.js` (add `crm` row under a "Clients" category, scope `vendor`)
- Create: `server/tests/unit/requireCrm.test.js`

**Interfaces:**
- Produces: `requireCrm(req,res,next)` — allows when `limits.crm === -1`, else `blockResponse` 403.

- [ ] **Step 1 (TDD):** Studio (`limits.crm:-1`) → `next()`; starter (`0`/absent) → 403 with `upgrade_required:true`; thrown error → fail closed (403/503, never open).

- [ ] **Step 2: Implement `requireCrm`** mirroring `checkProductLimit`'s shape:
```js
// Studio-only Client CRM gate. limits.crm: -1 = included, 0/absent = blocked.
const requireCrm = async (req, res, next) => {
  try {
    const plan = req.vendorPlan || 'starter';
    const planData = req.vendorPlanData || await planService.getPlan(plan);
    const limit = planData.limits?.crm ?? 0;
    if (limit === -1) return next();
    return blockResponse(res, {
      message: 'The Client CRM is a Studio feature. Upgrade to manage client records.',
      plan, limit,
    });
  } catch (err) {
    console.error('requireCrm error:', err.message);        // fail CLOSED
    return res.status(503).json({ message: 'Could not verify your plan. Please try again.' });
  }
};
```
Add `requireCrm` to `module.exports`. Add featureRegistry row: `{ key: 'crm', label: 'Client CRM', category: 'Clients', scope: 'vendor', description: 'Studio client records, notes & files. Off = Clients section hidden and API blocked.' }`.

---

## PHASE 2 — Read (derived clients + history)

### Task 4: `crmService` — aggregate bookings into clients

**Files:**
- Create: `server/services/crmService.js`
- Create: `server/tests/unit/crmService.test.js`

**Interfaces:**
- Exports:
  - `listClients(hostId, { q, page, pageSize }) -> { clients:[{ id?, customer_key, name, phone, email, bookings_count, last_booking_at, total_spent, is_recurring }], total }`
  - `getClient(hostId, customerId) -> { customer, history, reviews } | null`
  - `ensureCustomer(hostId, customerKey) -> crm_customers row` (idempotent upsert on `(host_id, customer_key)`; used before writing a note/file/attribute)

- [ ] **Step 1 (TDD):** With a mocked `supabaseAdmin` returning bookings for two distinct keys + one repeat:
  - two clients returned; the repeated key has `bookings_count:2`, `is_recurring:true`.
  - `total_spent` sums only PAID bookings; cancelled excluded.
  - `q` filters by name/phone/email substring (case-insensitive) in-Node.
  - existing `crm_customers` rows are joined so a client that has notes carries its UUID `id`.

- [ ] **Step 2: Implement.** Fetch paid bookings for the host (`.eq('host_id',hostId)`, select guest name/phone/email/amount/status/created_at). Group by `customerKey`. Skip rows whose key is `null`. Merge in `crm_customers` (host's rows) by `customer_key` so known clients carry their handle. Sort by `last_booking_at` desc. `is_recurring = bookings_count > 1`. Paginate in-Node. `// ponytail: naive in-Node groupBy; ceiling ~5k bookings/host.`
  - `getClient`: look up `crm_customers` by `id` + `host_id` → get its `customer_key` → re-derive that one client's aggregate + pull live `bookings` (full history, incl. cancelled, newest first) and `reviews` for those booking ids. Return `null` if the customer row isn't the host's.

---

### Task 5: CRM read routes + controller

**Files:**
- Create: `server/controllers/crmController.js`
- Create: `server/routes/crmRoutes.js`
- Edit: `server/server.js` (mount `app.use('/api/crm', require('./routes/crmRoutes'))`)
- Create: `server/tests/integration/crm.read.test.js`

**Interfaces:**
- `GET /api/crm/customers?q=&page=` → `{ clients, total, page, pageSize }`
- `GET /api/crm/customers/:id` → `{ customer, history, reviews }` (404 if not this host's)
- `GET /api/crm/customers.csv?q=` → text/csv export (fulfills the "Data export" pricing row)

- [ ] **Step 1: Wire routes** — every route: `router.get('/customers', protect, requireHost, attachPlan, requireCrm, listCustomers)` (and same guard chain for detail + csv). `attachPlan` MUST run before `requireCrm`.

- [ ] **Step 2 (TDD, integration):**
  - starter host → `GET /api/crm/customers` = **403 `upgrade_required:true`** (the must-hold check).
  - Studio host → 200 with clients array.
  - Studio host requesting another host's customer id → 404 (host-scope isolation).
  - CSV export returns `Content-Type: text/csv` and one row per client.

- [ ] **Step 3: Controller** — thin: call `crmService`, pass `req.user.id` as hostId ALWAYS (never body). CSV: build in-Node from `listClients` with a large pageSize; escape commas/quotes.

---

## PHASE 3 — Write (notes + attributes)

### Task 6: Client notes CRUD

**Files:**
- Edit: `server/controllers/crmController.js`, `server/routes/crmRoutes.js`
- Create: `server/tests/integration/crm.notes.test.js`

**Interfaces:**
- `POST /api/crm/customers/:id/notes` `{ body }` → created note (calls `ensureCustomer` first so a note can be added to a derived-but-not-yet-persisted client).
- `GET  /api/crm/customers/:id/notes` → notes newest-first.
- `DELETE /api/crm/customers/:id/notes/:noteId` → 204.

- [ ] **Step 1 (TDD):** note create requires non-empty `body` (400 if blank); every note write/read/delete filters BOTH `customer_id` and `.eq('host_id', req.user.id)`; deleting a note that isn't the host's → 404; starter → 403 (gate).

- [ ] **Step 2: Implement.** Body stored plaintext (decision A). Trim; reject empty; cap length (e.g. 5000 chars). `ensureCustomer` resolves/creates the `crm_customers` row from the `:id` handle's key.

---

### Task 7: Client attributes / tags upsert

**Files:**
- Edit: `server/controllers/crmController.js`, `server/routes/crmRoutes.js`
- Create: `server/tests/integration/crm.attributes.test.js`

**Interfaces:**
- `PATCH /api/crm/customers/:id/attributes` `{ tags?: string[], notesSummary?: string, ... }` → merges into `crm_customers.attributes` jsonb, bumps `updated_at`.

- [ ] **Step 1 (TDD):** merge (not replace) attributes; host-scoped; `tags` normalized to a de-duped trimmed array; oversized payload rejected (cap keys/size). Starter → 403.

- [ ] **Step 2: Implement.** Shallow-merge into existing `attributes`. `// ponytail: schemaless jsonb — the custom-fields UI is Phase 8; storage is here so the UI is a later add-on, not a migration.`

---

## PHASE 4 — Files

### Task 8: File upload → private bucket, magic-byte sniff

**Files:**
- Edit: `server/controllers/crmController.js`, `server/routes/crmRoutes.js`
- Create: `server/utils/sniffFileType.js` + `server/tests/unit/sniffFileType.test.js`

**Interfaces:**
- `POST /api/crm/customers/:id/files` (multipart, field `file`) → created `crm_files` row (no URL).
- `sniffFileType(buffer) -> 'pdf'|'jpg'|'png'|'webp'|null` (header magic bytes; NOT the client mimetype).

- [ ] **Step 1 (TDD, sniff):** real PDF header `%PDF` → `'pdf'`; JPEG `FF D8 FF` → `'jpg'`; PNG `89 50 4E 47` → `'png'`; WEBP `RIFF....WEBP` → `'webp'`; a `.pdf`-named buffer with JPEG bytes → still `'jpg'` (content wins); random bytes → `null`. `// ponytail: hand-rolled magic-byte check over 4 types — no new file-type dep for a 4-type allowlist.`

- [ ] **Step 2: Implement upload.** multer `memoryStorage`, `limits: { fileSize: 2*1024*1024 }` (2MB — KEEP this cap), field `file`. Run `sniffFileType(req.file.buffer)`; reject `null` with 400. Upload to `customer-files` at key `crm/${hostId}/${customerId}/${uuid}.${ext}`. Store `storage_key` + real mime + size in `crm_files`. `ensureCustomer` first. Host-scoped.

---

### Task 9: File list + 60s signed download + delete

**Files:**
- Edit: `server/controllers/crmController.js`, `server/routes/crmRoutes.js`
- Create: `server/tests/integration/crm.files.test.js`

**Interfaces:**
- `GET    /api/crm/customers/:id/files` → files metadata (no URLs).
- `GET    /api/crm/files/:fileId/url` → `{ url }` a 60s signed URL (generated on demand).
- `DELETE /api/crm/files/:fileId` → removes storage object + row (204).

- [ ] **Step 1 (TDD):** signed URL route host-scoped (another host's fileId → 404, no URL leaked); `createSignedUrl(key, 60)`; delete removes BOTH the storage object and the row; starter → 403.

- [ ] **Step 2: Implement.** `SIGNED_URL_TTL_SECONDS = 60` (mirror `productController`). Never store or return a public URL; mint per request. Delete calls `storage.remove([key])` then deletes the row.

---

## PHASE 5 — Client UI + verify

### Task 10: API client + Clients list page + gated sidebar link

**Files:**
- Edit: `client/src/services/api.js` (add `crm` methods)
- Create: `client/src/pages/dashboard/Clients.jsx`
- Edit: dashboard router + sidebar (add "Clients" link, hidden for non-Studio via existing plan/`FeatureGate` mechanism)
- Create: `client/src/pages/dashboard/__tests__/Clients.test.jsx`

- [ ] **Step 1:** `api.crm.listClients/getClient/notes/files/...`. Route `/dashboard/clients`. Sidebar link gated so non-Studio hosts don't see it (reuse the plan-gating already used for Studio-only items — grep how Products/analytics links are gated; do NOT invent a new gate).
- [ ] **Step 2 (TDD, Vitest, NO jest-dom):** list renders client rows from a mocked `api.crm.listClients`; empty state renders; a search box calls the API with `q`. Assert via `.textContent`/`.getAttribute()`.
- [ ] **Step 3:** Use existing design tokens/components (cards, table primitives in `dashboard/ui/`). No new colors. 4px borders, `rounded-xl` only where already used, Plus Jakarta Sans headings / Poppins body.

---

### Task 11: Client detail page — profile + history + notes + files

**Files:**
- Create: `client/src/pages/dashboard/ClientDetail.jsx`
- Create: `client/src/pages/dashboard/__tests__/ClientDetail.test.jsx`

- [ ] **Step 1:** Route `/dashboard/clients/:id`. Sections: header (name/phone/email/tags, `is_recurring` badge, `total_spent`), booking-history timeline (live), notes (add/list/delete), files (upload/list/download via on-demand signed URL/delete). Download click → `GET .../url` → open the short-lived URL.
- [ ] **Step 2 (TDD):** renders history + notes from mocked API; adding a note calls `POST`; deleting calls `DELETE`; file download click fetches a fresh signed URL. `.textContent`/`.getAttribute()` only.
- [ ] **Step 3:** Reuse existing components; match dashboard styling.

---

### Task 12: Verify + ship

- [ ] `cd server && npm test` — new unit + integration suites green, **no regressions**.
- [ ] `cd client && npm run build` — succeeds. **Watch the lucide missing-import landmine** (an unresolved icon import silently breaks the build; a wrong one has broken all `/for` pages before). If you add icons, verify each import resolves.
- [ ] Manual must-holds:
  - starter-plan host → `GET /api/crm/customers` returns **403 `upgrade_required:true`**.
  - non-Studio host → sidebar "Clients" link is **hidden**.
  - Studio host → list + detail render; a note persists; a 2MB+ file is rejected; a `.pdf` with non-PDF bytes is rejected; a download URL 404s after ~60s.
- [ ] **Open a PR from `feat/studio-crm` (do NOT merge — founder review).** PR body: summarize the module; list the 5 Studio features fulfilled (`plans.js:132-137`); state the security model (RLS-no-policy service-role-only, host-scoped every endpoint, private bucket + 60s signed URLs + magic-byte sniff + 2MB cap, UUID handles / no PII in URLs, gate fails closed); note **client notes are plaintext (decision A)**; note which DBs the migration was applied to; flag any deviation from this plan where the live codebase differed.

---

## PHASE 6 — "Host 360" enrichments + walk-in cash bookings

> Added 2026-07-15 after v1 scope review. All of Phase 6 is **Studio (`professional`) and above** — same `requireCrm` gate as Phases 1-5; Supreme bypasses via its existing god-tier gate-bypass. Starter/Creator → 403 upgrade prompt on every endpoint AND the "+ Manual booking" button is hidden.
>
> Most of this is **derivable from data you already store** — no new columns except the walk-in `source` marker. Build order: Task 13 (insights, cheap) → 14 (rebook) → 15 (timeline notes) → 16 (walk-in, the only schema touch).

### Task 13: Client insights — LTV rank, lapsed, no-show, first/last-seen

**Files:**
- Edit: `server/services/crmService.js` (extend the per-client aggregate)
- Edit: `server/controllers/crmController.js`, `server/routes/crmRoutes.js` (new list views)
- Edit: `client/src/pages/dashboard/Clients.jsx`, `ClientDetail.jsx`
- Edit: `server/tests/unit/crmService.test.js`

**Interfaces:** extend each client aggregate with `first_booked_at`, `last_booking_at`, `next_upcoming_at`, `no_show_count`, `cancel_count`, `ltv` (= existing `total_spent`). New read views:
- `GET /api/crm/customers?sort=ltv` → clients ranked by spend (powers a "Top clients" view).
- `GET /api/crm/customers?filter=lapsed` → clients with ≥N past bookings whose `last_booking_at` is older than the lapse window (default 60 days) and no upcoming booking. Win-back list.

- [ ] **Step 1 (TDD):** aggregate emits `first_booked_at` (min), `next_upcoming_at` (min of future non-cancelled), `no_show_count`/`cancel_count` from booking status; `sort=ltv` orders desc; `filter=lapsed` returns only clients past the window with no upcoming and `bookings_count >= 2`. All derived in-Node from bookings already fetched — **no new query per client.**
- [ ] **Step 2: UI** — Clients list gains a sort toggle (Recent / Top spend) + a "Lapsed" filter chip. Client card/detail shows "Client since {first_booked_at}", last-seen, next-upcoming, and a no-show badge when `no_show_count > 0`. Reuse existing tokens; no new colors. `// ponytail: lapse window hardcoded 60d; make it a host setting only if asked.`

### Task 14: Rebook for client

**Files:**
- Edit: `client/src/pages/dashboard/ClientDetail.jsx`
- Edit: `server/controllers/crmController.js` (only if a prefill endpoint is needed — prefer a client-side link)

**Interfaces:** a "Rebook" action on a client → opens the host's existing booking/checkout flow prefilled with this client's name/phone/email + last service. Reuse the rebook-nudge / existing booking-create path — do NOT build a second booking pipeline.

- [ ] **Step 1:** grep the existing rebook-nudge implementation; route "Rebook" to the same prefilled URL/flow with the client's contact + `service_id` of their most recent booking.
- [ ] **Step 2 (TDD):** clicking Rebook navigates to the booking flow with the expected prefilled params (assert the href/params). `.getAttribute()` only.

### Task 15: Timeline notes — pin a note to a specific booking

**Files:**
- Edit: `server/migrations/v3.76_crm.sql` (add nullable `crm_notes.booking_id UUID`)
- Edit: `server/controllers/crmController.js`, `server/routes/crmRoutes.js`, `client/src/pages/dashboard/ClientDetail.jsx`
- Edit: `server/tests/integration/crm.notes.test.js`

**Interfaces:** `POST /api/crm/customers/:id/notes` accepts optional `booking_id`. A note with `booking_id` renders inline on that booking in the history timeline; a note without it stays in the general notes list (unchanged behaviour).

- [ ] **Step 1: Migration** — `ALTER TABLE crm_notes ADD COLUMN IF NOT EXISTS booking_id UUID;` (nullable, no FK constraint needed — it references a booking id the host owns; validate ownership in the controller). Fold into `v3.76_crm.sql` if not yet applied; else a small `v3.76a` addendum applied to BOTH DBs.
- [ ] **Step 2 (TDD):** a note posted with a `booking_id` the host doesn't own → 404/403; a valid one attaches; the timeline groups booking-pinned notes under their booking. Host-scoped as always.

### Task 16: Walk-in / manual cash booking (the only schema-touching item)

**Files:**
- Edit: `server/migrations/v3.76_crm.sql` (add `bookings.source TEXT DEFAULT 'platform'`)
- Create: manual-booking controller action + route (host bookings surface, Studio-gated)
- Edit: platform-side aggregations to EXCLUDE `source = 'manual_cash'`
- Edit: `client/src/pages/dashboard/*` bookings view — "+ Manual booking" button (Studio-gated)
- Create: `server/tests/integration/crm.manualBooking.test.js`

**Decisions (LOCKED 2026-07-15):**
- **Model:** a walk-in is an **offline cash booking**, `source: 'manual_cash'`. Host revenue = YES; platform = NO. A standalone client (no booking) was rejected — it can't carry the revenue the host wants counted.
- **Entry point:** the host's **bookings page** via "+ Manual booking" (NOT from the CRM client card). Studio-only; button hidden + endpoint 403 for non-Studio.
- **Required fields:** name + (**phone OR email**, ≥1 required for identity/dedup) + `service_id` + amount + date. No contact → rejected (would orphan the client, never linking to future online bookings).
- **Silent:** skip ALL of notify/reminder/WhatsApp/email-confirm, Google Calendar sync, invoice generation, Razorpay, and review-request. It already happened; it's a record.
- **Private to host only.**

**Interfaces:** `POST /api/crm/manual-booking` (or reuse the host bookings route with a `manual: true` guard) `{ name, phone?, email?, service_id, amount, date }` → inserts a `bookings` row with `source:'manual_cash'`, status = a completed/past state, no payment linkage. The client then appears in CRM automatically via the normal `customerKey` derivation.

- [ ] **Step 1: Migration** — `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'platform';` on BOTH DBs. Existing rows default `'platform'` (no behaviour change).
- [ ] **Step 2: EXCLUDE from platform math (CRITICAL).** Audit every platform-side booking aggregation and add `.neq('source','manual_cash')` (or SQL `AND source <> 'manual_cash'`):
  - GMV / revenue dashboards (`/admin/revenue-breakdown`, super-dashboard cards)
  - commission (`commission_applied` paths)
  - settlement / payout (`computeSettlementBalance`)
  - invoices (never generate for manual_cash)
  - `checkBookingReceiveLimit` (manual_cash must NOT count toward `bookings_per_year`)
  - public profile booking/review counts
  Conversely, host-facing revenue/insights + CRM aggregates INCLUDE it. **Grep for every `.from('bookings')` count/sum and classify each as host-side (include) or platform-side (exclude).** This is the highest-risk task — a missed platform aggregation lets cash pollute GMV/commission.
- [ ] **Step 3 (TDD):**
  - non-Studio host → `POST /api/crm/manual-booking` = 403 `upgrade_required`.
  - no phone AND no email → 400.
  - happy path → booking row has `source:'manual_cash'`, NO invoice/payment/notification side-effects fired (assert the notify/invoice hooks were not called), and the client surfaces in `GET /api/crm/customers`.
  - a manual_cash booking is EXCLUDED from a platform GMV/settlement query and INCLUDED in the host's own revenue + the client's LTV.
  - manual_cash does NOT decrement `bookings_per_year`.
- [ ] **Step 4: UI** — "+ Manual booking" on the host bookings page, Studio-gated (hidden otherwise). Simple form (name, phone/email, service, amount, date). Editable/deletable by the host (their own data, no platform money moved).

### Phase 6 verify (added to Task 12's checklist)

- [ ] Platform GMV / commission / settlement / payout / `bookings_per_year` / public counts all EXCLUDE `manual_cash` (spot-check each with a seeded manual_cash booking).
- [ ] Host revenue view + client LTV INCLUDE it.
- [ ] "+ Manual booking" hidden for non-Studio; endpoint 403s.
- [ ] Lapsed/Top-spend views + timeline-pinned notes render for a Studio host.

---

## Security model (must-holds, consolidated)

1. **RLS enabled, zero policies** on all three CRM tables → reachable ONLY via `supabaseAdmin` (service role). anon/auth key can never read a note. (Directly answers the `supabase-anon-api-exposure` incident.)
2. **Host isolation:** every query filters `.eq('host_id', req.user.id)`; the host id comes from the auth token, never from the request. Cross-host id → 404, never a leak.
3. **Studio gate fails closed:** `requireCrm` denies on error and on absent limit.
4. **Files:** private `customer-files` bucket; 2MB cap; magic-byte sniff (content over mimetype); download only via freshly-minted 60s signed URLs; store keys, never URLs.
5. **No PII in URLs:** clients addressed by `crm_customers.id` (UUID); `customer_key` never leaves the server.
6. **Notes plaintext (decision A):** protected by RLS + service-role lock, not field encryption. Encryption is the Phase 8 option-B upgrade path if the founder later requires it.

## Deferred to Phase 8 (do NOT build now)

- Custom-fields UI (storage exists in `attributes`).
- Note encryption (option B).
- Aggregation RPC to replace in-Node groupBy (only if a host crosses ~5k bookings).
- Follow-up reminders, segments/saved filters, duplicate-merge, intake forms, bulk broadcast, client portal (from the v1 gap review — not yet scoped).

> **Walk-in / manual cash booking is NO LONGER deferred** — it is Phase 6, Task 16.

See `staging-prod-pipeline-and-db-inversion` for the dual-DB rule (Tokyo = staging, Mumbai = prod).
