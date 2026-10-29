# GST Finance Module — Audit, Gap Analysis & Architecture

> **Status:** Planning doc. No feature code written yet. This is the deliverable of Phase 1 (audit),
> Phase 2 (gap analysis) and Phase 4 (architecture) from the build spec. **Approve this before any build.**
>
> **Scope decisions locked with the requester (2026-09-02):**
> 1. This session ships this document only — audit + gap analysis + architecture. No feature code.
> 2. **Output GST only.** The platform does not record its own input/purchase GST anywhere. ITC / purchase
>    register / ITC-reconciliation modules therefore have **no data source** and will be built as
>    config-ready stubs that clearly say "no input-GST data captured", never faked numbers.
> 3. **Single GSTIN** — one legal entity, one registration (Timewheel Internet Private Limited,
>    `21AAMCT8270C1ZF`, Odisha / state 21). The GSTIN filter is built but defaults to one.

---

## 0. TL;DR

- The platform already has a **reliable, single-calculation, snapshot-then-project** tax architecture.
  GST is computed once in `pricingEngine.js`, frozen onto the `bookings` / `subscription_payments` rows,
  and re-projected into (a) the immutable `invoices` legal record and (b) the double-entry ledger.
- **The GST module must be a derivation-and-reporting layer on top of the `invoices` table. It must NOT
  recompute tax and must NOT create a parallel tax database.** The `invoices` table is the one place that
  carries head-wise CGST/SGST/IGST + place of supply + integrity CHECKs, so it is the authoritative source
  for every GST report and drill-down.
- Real gaps are: **no GST summary / GSTR working reports, no credit/debit notes, no ITC data, no
  IST-aware period helper, no invoice↔ledger GST cross-check, no returns/export/issue-status persistence.**
- Several items **cannot be answered from code and need the CA** — chiefly credit-note treatment on
  refunds, and whether the service-price GST is genuinely out of platform scope. Flagged in §7.

---

## 1. Phase 1 — What exists today (audit findings)

### 1.1 Money & tax model (the one calculation authority)
- **`server/lib/pricingEngine.js`** — pure, the money-model spec is its header comment. Defaults
  (`pricingEngine.js:38-41`): `gstRate 0.18`, `tdsRate 0.01`, `tcsRate 0.01`. `calculateGst` adds GST on
  top of the platform fee; `calculateCommissionGst` **extracts** GST from an inclusive commission;
  `calculateTds`/TCS are 194-O / §52 withholdings.
- **Seller identity** — `server/config/sellerIdentity.js`: GSTIN `21AAMCT8270C1ZF`, PAN, CIN, state 21
  (Odisha), SAC **998314** for all three series, invoice-series prefixes. Env-overridable constants,
  **not a DB row**.
- **State / place-of-supply** — `server/services/stateService.js`: `isValidGstin`, `stateCodeFromGstin`,
  `resolvePlaceOfSupply` (GSTIN state → explicit code → typed name → seller state fallback),
  `validateBillingDetails`.

### 1.2 Three output-GST streams (there is no fourth)
| Series | Source | Who is billed | Taxable value | GST | Inclusive? |
|---|---|---|---|---|---|
| `BAS-SUB` | subscription | host → platform | `plan_price` | `gst_amount` | exclusive (added on top) |
| `BAS-BKG` | booking fee | guest → platform | `platform_fee_amount` | `platform_fee_gst` | exclusive |
| `BAS-COM` | commission | platform → host | `commission_taxable` | `commission_gst` | inclusive (extracted) |

The **service price itself is never taxed by the platform** — it flows through to `Vendor Payables (2000)`.
That is correct marketplace treatment (the host supplies the service to the guest; the host, not the
platform, owns any GST on the service). **Confirm with CA** (§7).

TDS/TCS are collected on the host's behalf and are govt pass-throughs (accounts 2300/2400), surfaced by the
existing **withholding report** (`withholdingReportService.js`, feeds 26Q + GSTR-8), not output GST.

### 1.3 The authoritative GST legal record — `invoices` (v3.67 + v3.118)
- `server/migrations/v3.67_gst_invoicing.sql` — `invoices` table with `taxable_value`, `cgst`, `sgst`,
  `igst`, `total`, `place_of_supply`, `sac_code`, `buyer_gstin`, `buyer_pan`, `buyer_state_code`,
  `seller_snapshot`, plus `gst_rate` (v3.118). `UNIQUE(source_type, source_id)` → one invoice per source.
- **Gap-free serial** via `create_invoice()` RPC (advisory-locked, idempotent — a duplicate source returns
  the existing row without burning a serial).
- **Integrity CHECKs (v3.118):** IGST mutually exclusive with CGST/SGST; `total ≈ taxable + cgst + sgst +
  igst` (±0.05). This makes each invoice row internally self-consistent — the reconciliation anchor.
- **Rendering:** `services/invoiceHtml.js` produces print-to-PDF HTML. **No PDF/Excel/ZIP library is
  installed** in either `package.json`. All current export is hand-rolled CSV/HTML.

### 1.4 Derived stores
- **Ledger** (`v2.8_financial_ledger.sql`, `ledgerAccounts.js`): double-entry, GST collapsed into a single
  `GST_PAYABLE (2100)` account — **no head-wise split, no POS**. TDS 2300 / TCS 2400. Posting via immutable
  RPC; five idempotent reconcilers heal missing entries (`ledgerReconciler`, `payoutReconciler`, etc.).
- **`financeAdminController.getSummary`** already derives a `gst_liability` figure = balance of account 2100.

### 1.5 Admin surface & permissions
- Admin routes in `client/src/App.jsx` (`/admin/finance/*`, `/admin/finance` ledger dashboard, journal,
  ledger). Finance pages under `client/src/pages/admin/`. API calls in `client/src/services/api.js:281-303`.
- Permissions: `server/lib/adminPermissions.js` — `finance.view/refund/manage`, `payouts.*`,
  `commission.view/edit`. **No `gst.*` / `tax.*` keys exist.** Tax export is currently gated on
  `commission.view`. Enforced by `requireAdmin(permission)` in `adminMiddleware.js`; permissions are baked
  into the admin JWT at login (change takes effect next login).
- Existing tax/period utilities to REUSE: `invoiceService.fiscalYearFor` / `fiscalYearLabel` (Indian FY
  Apr–Mar — **but UTC-based, see gap G6**), `withholdingReportService` (date-range + CSV pattern),
  `stateService.resolvePlaceOfSupply` / `computeTaxSplit`, the `runLocked` reconciler cron scaffold.

---

## 2. Phase 2 — Gap analysis

| # | Item | State |
|---|---|---|
| 1 | GST functionality that exists | Per-invoice CGST/SGST/IGST + POS; ledger GST-payable balance; withholding (TDS/TCS) CSV; FY util; POS resolver. |
| 2 | Data that exists | Every output-GST amount (snapshotted) + the head-wise split & POS on `invoices`. Buyer GSTIN inside `billing_details` JSONB. |
| 3 | What is missing | GST summary; GSTR-1/3B working; credit/debit notes; ITC/input side; issue/exception tracking; returns tracking; export history; GST audit log; CA pack; IST period helper; invoice↔ledger cross-check. |
| 4 | What can be reused | `invoices` as source of truth; `pricingEngine`/`stateService`/`invoiceService` (read-only); reconciler cron scaffold; `finance.*` permission model; `financeAdminController` patterns; `withholdingReportService` CSV pattern. |
| 5 | New DB needed | `gst_returns`, `gst_export_runs`, `gst_issue_status`, `gst_audit_log` (or reuse admin audit if one exists — TBD), `gst_settings` (optional; identity is config today). **Deferred/flagged:** `credit_notes`, ITC tables. |
| 6 | Calculations happening now | All in `pricingEngine` (once) → snapshot → invoice split + ledger. Reports do zero recompute today because reports don't exist. |
| 7 | Are existing GST calcs reliable? | **Yes.** Single calc site, immutable snapshot, invoice CHECK constraints, gap-free serial, idempotent reconcilers, unit tests pin the matrix (`gstMatrix.test.js` et al.). |
| 8 | Where tax values are stored | Amount origin: `bookings` / `subscription_payments` snapshot columns. Legal head-wise record + POS: `invoices`. Accounting total: ledger account 2100. |
| 9 | Can history be reconstructed? | **Yes for anything that has an invoice.** Risk: `generateInvoice()` is best-effort/never-throws, so a paid transaction can lack an invoice row → becomes exception class "transaction without invoice" (see §4 action center). Backfill uses the same idempotent RPC. |
| 10 | Discrepancy sources (Finance vs GST) | (a) invoice GST vs ledger GST never cross-checked; (b) refunds reverse GST in ledger but the invoice is never credit-noted → GST report and ledger diverge on refunds; (c) UTC vs IST period boundaries; (d) missing invoices; (e) missing buyer GSTIN. |

### Named gaps
- **G1 — No GST summary / GSTR working reports.** Only per-invoice + withholding CSV.
- **G2 — No credit/debit notes.** Refunds reduce `bookings.refunded_amount` and post a ledger REFUND
  entry, but the immutable invoice is never reversed. Under GST, an output-tax reduction on a refund
  normally needs a **credit note**. **This is a genuine compliance gap — CA decision required (§7).**
- **G3 — No ITC / input GST.** Confirmed out of system. ITC modules become honest stubs.
- **G4 — Ledger collapses GST heads.** Head-wise CGST/SGST/IGST for GSTR-3B must come from `invoices`,
  not the ledger. (Decision: invoices are authoritative — §3.)
- **G5 — Invoice↔ledger GST not cross-checked.** Build an internal reconciliation that compares
  Σ invoice GST vs account-2100 movement per period; surface deltas as exceptions.
- **G6 — FY/period util is UTC-based.** A transaction at, say, 31-Mar 23:30 IST lands in the wrong FY under
  UTC. Need an **IST-aware** period/month/quarter/FY range helper for all GST reporting.
- **G7 — POS only on invoices, not on the booking snapshot.** Reporting must read `invoices` for
  POS/head-split; bookings alone are insufficient.
- **G8 — Buyer GSTIN lives in `billing_details` JSONB**, sometimes absent → "missing GSTIN" data-quality
  exception, especially for host commission invoices that drive host ITC.

---

## 3. Phase 3 — Source of truth & data model decision

**Decision: the `invoices` table is the single authoritative source for all GST reporting.**

Reasoning: it is the only store with head-wise CGST/SGST/IGST + place of supply, it is immutable, it has
integrity CHECK constraints and a gap-free serial, and it is already downstream of the one calculation
authority. Every GST KPI, report, and CA-pack file is a **query over `invoices`**, joined back to its source
(`booking` / `subscription` / `commission`) and forward to the ledger for cross-check. The ledger's account
2100 is used only as a **control total**, never as a report source. Bookings/subscriptions are used only for
drill-down context, never recomputed.

**No parallel tax ledger.** New tables store only *workflow state that does not exist yet* — return status,
export history, exception resolution status, and a GST audit trail — never duplicated monetary values.

### Traceability chain (must hold in both directions)
```
Net GST liability  →  Output GST by head  →  invoice row  →  source (booking/subscription/commission)  →  payment
        ▲                                                                              │
        └───────────── control cross-check against ledger account 2100 ◄──────────────┘
```

### Proposed new tables (minimal)
- **`gst_returns`** — one row per (gstin, period, return_type ∈ {GSTR1, GSTR3B}). Columns: status
  (`not_started|preparing|needs_review|ready|filed`), prepared_by, filed_by, filed_at, arn, reconciliation
  status, snapshot_ref, updated_at. *"Filed" is only set by an explicit action with an ARN, never by
  rendering a report.*
- **`gst_export_runs`** — export/CA-pack history. Columns: name, period, type, gstin, generated_by,
  generated_at, record_count, taxable_total, gst_total, status, storage_path, params_hash. Immutable
  period packs are content-addressed by `params_hash` so identical requests reuse the stored pack.
- **`gst_issue_status`** — overlay for the action center. Exceptions are **computed on the fly** from data;
  this table stores only the mutable resolution state keyed by (issue_type, source_type, source_id):
  status (`open|under_review|resolved|ignored`), owner, note, updated_by, updated_at. No issue can vanish
  silently — an unresolved computed issue with no row defaults to `open`.
- **`gst_audit_log`** — who/what/when/old/new/reason for every tax-meaningful change (rate change, return
  status change, reconciliation toggle, export generated, issue status change). *First implementation task
  is to check whether a generic admin audit log already exists and reuse it; only add this table if not.*
- **`gst_settings`** *(optional, Phase later)* — promote seller identity + rate config from
  `sellerIdentity.js` into a DB row so Finance can view (not necessarily edit) it. Until then §15 settings
  is **read-only display** of the existing config.
- **Deferred, CA-gated:** `credit_notes` (G2). **Stub-only:** ITC tables (G3).

### Calculation timing & immutability
- Reports are **derived at read time** by indexed aggregation queries over `invoices` (server-side
  pagination + filtering). Large exports and CA packs are generated in the **background** (reuse the
  `runLocked` scaffold) and stored immutably; re-requesting the same closed period returns the stored pack.
- Historical reports must not change when current config changes — guaranteed because reports read the
  **snapshotted** invoice rows (rate/POS/heads frozen at mint time), never live config. Tested explicitly
  (§21 in spec).

---

## 4. Phase 4 — Proposed architecture & routes

### Backend (all under `finance.*`/new `gst.*` permissions)
- **`server/services/gst/gstQueryService.js`** — pure query/aggregation layer over `invoices` (+ joins).
  Every KPI and report funnels through here so there is exactly one place that defines "output GST for a
  period". Functions: `outputGstForPeriod`, `gstByHead`, `gstByRate`, `gstByPos`, `transactionRegister`,
  `salesInvoiceRegister`, `customerGstinReport`, `vendorGstinReport`, `gstr1Working`, `gstr3bWorking`.
- **`server/services/gst/gstPeriodService.js`** — **IST-aware** month/quarter/FY range helper (fixes G6),
  wrapping/replacing the UTC `fiscalYearFor`. One tested utility; everything else consumes it.
- **`server/services/gst/gstExceptionService.js`** — computes the action-center exceptions (missing/invalid
  GSTIN, missing invoice, duplicate, rate mismatch, missing POS, CGST/SGST-vs-IGST inconsistency, refund
  without credit note, transaction without invoice, invoice↔ledger delta) and overlays `gst_issue_status`.
- **`server/services/gst/gstReconcileService.js`** — internal reconciliation (invoice vs ledger control
  total per period) + the framework hook for a *future* external source (GST portal/GSP) — **no external
  integration built**, just the interface + `gst_reconciliation` view shape.
- **`server/services/gst/gstExportService.js`** — builds CSV (raw registers) + XLSX (working papers) + PDF
  (human summaries) + ZIP CA pack. **Requires new deps** (see §5). Background generation; writes
  `gst_export_runs`.
- **`server/services/gst/gstReturnsService.js`** — returns workflow state machine + audit.
- **`server/controllers/gstAdminController.js`** + **`server/routes/gstRoutes.js`** — REST surface below.
- **`server/services/gst/itcStub.js`** — returns explicit "no input-GST data captured" everywhere ITC is
  referenced, so the UI can render honest empty states.

### API surface (mounted `/admin/gst`, server-side paginated/filtered)
| Method + path | Purpose | Permission |
|---|---|---|
| GET `/admin/gst/overview` | KPI cards + health + liability breakdown | `gst.view` |
| GET `/admin/gst/transactions` | master GST ledger view (filter/sort/paginate) | `gst.view` |
| GET `/admin/gst/invoices` | sales/credit/debit/cancelled tabs | `gst.view` |
| GET `/admin/gst/invoices/:id` | invoice detail + tax breakdown + links | `gst.view` |
| GET `/admin/gst/issues` | action center (computed + overlay) | `gst.view` |
| POST `/admin/gst/issues/:key/status` | set status (audited) | `gst.manage` |
| GET `/admin/gst/reconciliation` | invoice↔ledger deltas | `gst.view` |
| GET `/admin/gst/itc` | **stub** — honest empty state | `gst.view` |
| GET `/admin/gst/returns` | periods + statuses | `gst.view` |
| POST `/admin/gst/returns/status` | advance status / mark filed + ARN (audited) | `gst.returns_prepare` (+ `gst.returns_file` to mark filed) |
| GET `/admin/gst/reports/:type` | on-demand report (JSON/CSV) | `gst.view` |
| POST `/admin/gst/exports` | generate export / CA pack (background) | `gst.export` |
| GET `/admin/gst/exports` | export history | `gst.view` |
| GET `/admin/gst/exports/:id/download` | download stored pack | `gst.export` |
| GET `/admin/gst/settings` | read-only identity/rate/series config | `gst.view` |

### Frontend (routes exactly as spec)
`/admin/gst` · `/transactions` · `/invoices` · `/reconciliation` · `/itc` · `/returns` · `/reports` ·
`/settings`. New pages under `client/src/pages/admin/gst/`, nav entry in `adminNav.js`, API calls added to
`api.js`. Reuse existing admin table/filter/badge components and design tokens (Plus Jakarta Sans / Poppins,
4px borders, rounded-xl). Every KPI is a link into the filtered transaction/invoice view (drill-down
everywhere). ITC/reconciliation-external render honest empty states, not fake percentages.

### Permissions (new keys in `adminPermissions.js`)
`gst.view`, `gst.manage`, `gst.reconcile`, `gst.returns_prepare`, `gst.returns_file`, `gst.export`,
`gst.settings` (single-dot `resource.action` convention enforced by the catalog test). Assign the read/manage set to `finance` and `super`; `operations` gets `gst.view` only.
**Migration note:** permissions are baked into the admin JWT at login → an admin logged in before the change
keeps the old set until re-login (same pattern as v3.81).

---

## 5. New dependencies (needed only when the export phase is built)
- **`exceljs`** — XLSX working papers. **`archiver`** — ZIP CA pack. PDF summaries: reuse the existing
  print-to-HTML approach first (no new dep); add a PDF lib only if a true PDF binary is required. CSV stays
  hand-rolled (reuse the `withholdingReportService.toCsv` pattern). No deps are added in the doc phase.

## 6. Reports & CA pack (labels are honest)
- Reports: GST Summary, GST Transaction Register, Sales Invoice Register, Credit/Debit Note Registers
  (empty until G2 resolved), CGST/SGST/IGST reports, Tax-Rate Summary (only rates actually configured —
  18% today), Place-of-Supply, Customer/Vendor GSTIN, ITC (stub), Reconciliation, **GSTR-1 Working** and
  **GSTR-3B Working**.
- **GSTR-1/3B outputs are labelled "working papers", not government filing files.** They will not claim to
  be the official GSTN JSON/format unless/until validated against the live spec with the CA.
- **CA pack** = ZIP with the numbered folder structure from spec §11; files present only where data exists
  (credit/debit/ITC files are included as clearly-labelled empty/"not-applicable" placeholders, not omitted
  silently). Monthly / Quarterly / Annual / Full-Accounting presets.

---

## 7. Open questions for the CA / GST professional (do not guess — flagged)
1. **Service-price GST scope.** Confirm the platform correctly does **not** charge/report GST on the host's
   service price (pure marketplace facilitation; host owns service GST). The whole module assumes this.
2. **Credit notes on refunds (G2).** When a booking is refunded, is a GST **credit note** required to reduce
   output tax, and against which invoice (the booking-fee `BAS-BKG` and/or commission `BAS-COM`)? Current
   system reverses GST in the ledger but issues no credit note. This changes whether refunds appear in
   GSTR-1 credit-note tables.
3. **Commission GST is inclusive vs booking-fee GST exclusive** — confirm both treatments and that the
   extracted commission GST is reported correctly.
4. **TDS/TCS in GST returns.** TCS (§52) feeds GSTR-8, TDS (194-O) feeds 26Q — confirm these stay in the
   withholding report and are *out* of the GSTR-1/3B working, to avoid double counting.
5. **Place-of-supply fallback.** When buyer GSTIN/state is absent, POS defaults to seller state (Odisha 21)
   → intra-state CGST+SGST. Confirm this default is acceptable for B2C, or whether it must be the buyer's
   actual state (would change the CGST/SGST vs IGST split for missing-data cases).
6. **Reverse charge / exempt / zero-rated** — confirm none apply to the platform's supplies (none modelled
   today).
7. **Single GSTIN sufficiency** — confirm the entity has no other state registration that would need
   per-GSTIN returns.

---

## 8. Proposed build phasing (each = its own PR, off `main`)
- **P0 (this doc)** — audit + gap + architecture. ← you are here.
- **P1 — Backend data/query layer:** `gstPeriodService` (IST), `gstQueryService`, exceptions, reconcile,
  permissions, migrations (`gst_returns`, `gst_export_runs`, `gst_issue_status`, audit), tests. No UI.
- **P2 — GST Overview + Transactions + Invoices pages** (read-only, full drill-down).
- **P3 — Reports + Reconciliation + Returns + ITC-stub pages.**
- **P4 — Exports + CA pack** (adds `exceljs`/`archiver`, background generation, export history).
- **P5 — Audit log surfacing + settings display + hardening + production-style audit.**
- **Deferred, CA-gated:** credit/debit notes (G2), external GSP reconciliation, ITC (needs an input-GST
  data source that does not exist yet).

## 9. Known limitations (stated, not hidden)
- ITC / purchase / ITC-reconciliation are **stubs** — no input-GST data exists in the platform.
- Credit/debit-note registers are **empty** until the refund→credit-note treatment is decided with the CA;
  until then refunds appear only in the ledger and as a reconciliation exception.
- GSTR-1/3B are **working papers**, not filing-ready government files.
- Reports depend on invoices existing; paid transactions missing an invoice surface as exceptions and need
  backfill, not silent omission.
- Settings is **read-only** until/unless `gst_settings` is introduced; seller identity stays in config.
- IST-vs-UTC period boundary is fixed by the new period helper for GST reports, but the legacy
  `fiscalYearFor` remains UTC elsewhere (out of scope to change platform-wide here).

## 10. Acceptance mapping
Every numbered acceptance criterion in the spec maps to a phase above; the "trace any GST amount back to its
source transaction and forward into its reporting" criterion is satisfied by the §3 bidirectional
traceability chain and the drill-down links on every KPI.
