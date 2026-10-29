# CRM Lists — cold contact pool (manual promotion)

**Date:** 2026-09-11
**Branch:** `feat/crm-lists`
**Status:** design approved (Option B, cold-as-status), pending spec review → implementation plan

---

## 1. Problem

Founder has bulk cold contact data (name, phone, email, website, business, …) from
scraping/exports. Today the only way in is the generic admin importer
(`/import/commit`, [adminCrmController.js:318](../../../server/controllers/adminCrmController.js)),
which drops raw rows into `leads` **instantly and permanently** — every imported cold
prospect lands *in the sales pipeline*. The Topmate import (#990) did exactly this:
~123 cold, un-opted-in prospects now sit in the pipeline alongside real, engaged leads.

That is backwards. The pipeline should hold contacts the founder has chosen to work. Cold
data should live in a holding area you can cold-email *from*, and a contact should enter
the pipeline only when the founder **moves it there by hand**.

## 2. Goal

- **Lists** = named cold pools. Store bulk data here. Cold-email from here.
- **Pipeline** (`/admin/sales`) = contacts the founder promoted.
- **Promote**: change a contact's state from **List** → **New**. Manual only, no automation.
- **Demote**: pipeline → cold (back to origin list), manual. One-time backfill demotes the
  existing Topmate leads.
- Reuse the existing identity / dedupe / send / opt-out / lifecycle machinery — build no
  parallel stack.

## 3. Model — cold is a lifecycle state (`status='list'`)

Two states, per the founder's model: **List** (cold) and **New** (entered pipeline).
Promote = `status` `list → new`; the contact stays in its list until the founder moves it.

Rejected a separate cold store: cold email needs identity, dedupe, opt-out, unsubscribe,
suppression and send-logging, all built around `leads` + `campaigns` + `sendGate`. A
separate store rebuilds that whole stack and forces dedupe across two stores.

So cold contacts **are** `leads`, distinguished by a new `status` value **`list`** — lowest
rank, sitting *outside* the four Sales pipelines (Presale/Relations/Marketing/Exit) and
rendered as a **plain table, never a kanban board**. This rides the existing `changeStatus` +
`lifecycleRules` machinery: promote/demote are ordinary status changes, logged and
handed-off for free — the same way `do_not_contact` already lives as an orthogonal status.

`leads.list_id` groups cold contacts by which list they came from. It survives promote and
demote, so a demoted lead returns to its origin list.

No separate `in_pipeline` flag: "in the pipeline?" = `status <> 'list'`.

## 4. Schema (migration `v3.155_crm_lists.sql` — next free number, verify at apply time; additive, idempotent)

```sql
CREATE TABLE IF NOT EXISTS public.lead_lists (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  source         text,                       -- 'topmate' | 'instagram' | 'linkedin' | 'manual' | …
  consent_basis  text,                       -- 'b2b_legitimate_interest' | 'opt_in' | … (send audit)
  description    text,
  created_by     text,                       -- admin actor
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_lists ENABLE ROW LEVEL SECURITY;  -- service-role only (no policy)

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS list_id uuid REFERENCES public.lead_lists(id);

-- Add the cold state to the status CHECK (widen; keep every existing value from v3.126).
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check CHECK (status IN (
  'list',                                    -- NEW: cold pool (in a lead_list, not in the pipeline)
  'new','contacted','replied','qualified','demo',
  'paid','activated','won','sloth',
  'retained','ambassador','enterprised','champion',
  'not_reachable','not_interested','disqualified','lost','churned',
  'do_not_contact',
  'demo_scheduled','trial'                   -- retired transitional (unchanged)
));

-- Lists view: cold rows by list.
CREATE INDEX IF NOT EXISTS idx_leads_cold ON public.leads (list_id) WHERE status = 'list';
```

**No behavior change on apply:** no existing row has `status='list'`, so nothing moves
until cold rows are imported or the Topmate backfill runs.

`lifecycleRules.js` (code, same PR) gains the state in **one place**:
- `pipelineOf('list') = 'lists'` (a board outside the Sales pipelines)
- lowest `RANK`
- **`NO_AUTO`** — the every-15-min `lifecycleEngine` cron must never auto-advance a cold
  lead. Manual `changeStatus` still moves it (that's promotion).

Run on **staging (Tokyo `xwvciqkayammbvsidqig`) → prod (Mumbai `ayjhlwyzszykqtnaktpb`)**.
Keep the code-side schema fallback (destructure-safe) until confirmed on both.

List counts (cold / promoted) are **derived by query**, not stored — no drift.
`ponytail:` add a cached count only if the Lists index page measurably slows.

## 5. Excluding cold from the pipeline (the risk surface)

Cold = `status='list'`, outside the four Sales pipelines (shown as a flat table, not a
board). Every consumer that treats "the pipeline" as all-of-`leads` must exclude it:

- **lifecycleEngine** cron — `NO_AUTO` covers it; confirm no raw status scan bypasses that.
- **board / `listLeads`** ([leadService.js:389](../../../server/services/crm/leadService.js)) —
  Sales board groups by `pipelineOf`; the `lists` pipeline shows **only** on the Lists
  screen, excluded from the Sales board.
- **reportService** — pipeline metrics / LTV must exclude `status='list'`.
- **followUpService / deskService** — no auto follow-up tasks / desk queue for `status='list'`.

Because the state is centralized in `lifecycleRules` (`pipelineOf`, `RANK`, `NO_AUTO`,
board sets), most consumers inherit the exclusion from one edit. **Task:** audit every
`from('leads')` scan across the 18 reader files, confirm each filters by pipeline via
`lifecycleRules` or explicitly excludes `status='list'`. Per-lead reads and the send path
(`messageService` / `sequenceService` / `touchGovernor`) are stage-agnostic — leave them.

## 6. Import (upgrade the generic path; #990 untouched)

- `/import/preview` — unchanged (validate rows).
- `/import/commit` — now **requires a target list** (`list_id`, or `list_name`+`source` to
  create one inline). Every **new** lead is created `status='list'`, `list_id=<list>`,
  `source=<list.source>`, via existing `upsertLead` (free dedupe/identity/merge). Generic
  import **no longer enters the pipeline.**
- **Merge safety:** the "never regress pipeline on re-sync" rule
  ([leadService.js:72](../../../server/services/crm/leadService.js)) already skips `status`
  on merge, so re-importing a contact who is already promoted will **not** drag them back to
  `list`. Import sets `status='list'` **only when creating** a lead (upsertLead accepts an
  initial status for new rows, or the commit sets it immediately after create).
- **#990 Topmate CLI script stays as-is** — a hand-run power tool with dataset-specific
  classification. It is pointed at a "Topmate" list (`list_id`, `status='list'`) instead of
  dropping into the pipeline: a small edit to its `upsertLead` opts, not a rewrite.

**Upload format (v1 = CSV, fixed columns, no mapping UI — §11).** CSV, UTF-8, comma-delimited,
RFC-4180 quoting; parsed client-side → rows JSON (the shape `/import` already takes) with the
reused dep-free `parseCSV` from #990 ([importTopmateLeads.js:33](../../../server/scripts/importTopmateLeads.js)).
`.xlsx` upload deferred (§11 — Excel → *Save As CSV* for now). Row 1 = headers, matched
**case-insensitively**; one contact per row.

| Header | Required | → lead field |
|---|---|---|
| `email` | one of email/phone | `email` (dedupe key) |
| `phone` | one of email/phone | `phone` (dedupe key) |
| `name` | – | `name` |
| `whatsapp` | – | `whatsapp_phone` (blank → `phone`) |
| `business` | – | `business_name` |
| `profession` | – | `profession` |
| `website` | – | `website` |
| `linkedin` | – | `linkedin` |
| `instagram` | – | `instagram` |
| `city` | – | `city` |
| `tags` | – | `tags` (`,` or `|` split) |

- **Socials:** `website` / `linkedin` / `instagram` are real `leads` columns (filterable,
  usable in sends). Other socials (`twitter`/`x`, `youtube`, `facebook`, any `*_url`) →
  `attributes` jsonb.
- **Unknown columns → stashed in `attributes` (jsonb)** so raw data is never lost.
- A row with **neither email nor phone is skipped** (can't dedupe / can't contact).
- Duplicate email/phone (in-file or vs an existing lead) → **merged into one lead**.

## 7. Cold send (reuse, build nothing)

Cold email from a list uses the **existing campaign engine** (`campaignAdminController`,
`sendGate`, `touchGovernor`): the campaign audience is the filter
`status='list' AND list_id=<list>`. That inherits, for free:
- opt-out / do-not-contact / email opt-out gates
- mandatory unsubscribe (HMAC, v3.7) in the email layout
- quiet hours (09–20 IST), governor cap (1/48h per subject)
- the `crm_admin_sends` master kill-switch (fail-closed)

`list.consent_basis` is recorded for audit (cold B2B = legitimate-interest + visible
unsubscribe + suppression). **Landmine:** a large cold blast overflows the Resend daily
cap → silently dropped; `email_logs` is the truth, `campaign_recipients.status` lies. Batch
cold sends and re-drive failed rows.

## 8. Promote / Demote (manual only)

- **Promote (List → pipeline):** the founder sets the contact's state to **New**. It is an
  ordinary `changeStatus('list' → 'new')` — logged + handed-off. No automation.
- **Demote (pipeline → List):** `changeStatus(<current> → 'list')`, keeps `list_id`
  (fallback "Ungrouped" list if null). Does not otherwise rewrite history.
  **Blocked when status ∈ MONEY/CONVERTED** (reuse the `lifecycleRules` sets) — a
  paying/converted customer must never fall into the cold pool.

## 9. Topmate backfill (one-time, after gate code is live)

Order matters: **deploy the exclusion (§5) first**, then backfill — otherwise `status='list'`
rows still surface on an un-gated board.

```sql
INSERT INTO lead_lists (name, source, consent_basis, created_by)
  VALUES ('Topmate — cold', 'topmate', 'b2b_legitimate_interest', 'backfill')
  RETURNING id;  -- :topmate_list

UPDATE leads
   SET status = 'list', list_id = :topmate_list, updated_at = now()
 WHERE attributes->>'source_dataset' = 'topmate'
   AND status NOT IN (/* MONEY/CONVERTED set — never demote a paying customer */);
```

## 10. UI

- **`/admin/sales/lists`** — index of lists (name, source, cold count, promoted count,
  created). "New list" + "Import CSV → list".
- **List detail** — a **plain data table** (no board, no columns/drag), one row per cold
  contact: `☐ · Name · Business · Email · Phone · Links · Tags · Added`. The **Links** cell
  shows small click-through icons (website / linkedin / instagram) only when present; full
  socials + attributes in the row detail. Rows are checkbox-selectable;
  bulk **Promote → New** and **Send cold campaign** actions on the selection. Filter/search
  across the fields. Reuse the `SalesLeads.jsx` table + `TagChip` + bulk bar (the table
  parts only — not the kanban board).
- **Pipeline board** (`/admin/sales/leads`) — excludes `status='list'`; add a per-lead
  **Demote to list** action.

Design tokens / components per project rules (reuse `SalesLeads`, no new color/borders).

## 11. Out of scope (YAGNI — add when it hurts)

- **Auto-promotion** (on reply/action) — explicitly not wanted. Promotion is manual.
- **Auto-demote on going quiet** — manual demote + the Topmate backfill cover the need.
- **`.xlsx` upload** — v1 is CSV-only (reuses #990's dep-free parser). Add SheetJS (`xlsx`)
  when *Save As CSV* friction actually bites.
- **Column-mapping UI** (drag CSV header → field). v1 = fixed columns; add mapping when a
  messy CSV actually blocks an import.
- **Enrichment / profession inference** in the generic importer — that is #990's job for its
  dataset; the generic path stays dumb.
- **Per-list send analytics** beyond the existing campaign stats.

## 12. Testing

- `leadService` unit: promote = `changeStatus('list'→'new')` logs + moves; demote sets
  `status='list'`, keeps `list_id`; **demote blocked on MONEY/CONVERTED status**.
- `lifecycleRules` unit: `pipelineOf('list')='lists'`, lowest RANK, in `NO_AUTO`.
- import: `/import/commit` creates new rows `status='list'`; a merge into an existing
  promoted lead does **not** regress `status`.
- exclusion: a `status='list'` lead does not appear in `listLeads` default board results nor
  in `reportService` pipeline counts.
- Server `npm test`; client `npm run build` + `npx vitest run` before any client PR
  (deploy gate = full client vitest).

## 13. Rollout order

1. Ship migration (both DBs) + `lifecycleRules` `list` state + exclusion audit +
   promote/demote + Lists UI + import upgrade. No existing row is `list`, so the pipeline is
   identical until step 3.
2. Verify on staging (a cold test list does not leak onto the Sales board).
3. Run the Topmate backfill (prod) — the ~123 cold prospects move to the "Topmate — cold"
   list, out of the pipeline. Paying ones stay.
