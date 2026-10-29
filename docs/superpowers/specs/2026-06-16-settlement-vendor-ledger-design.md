# Settlement Engine P2 — Accurate Vendor Balance (Design)

_Date: 2026-06-16 · Phase: Financial Ledger P2 (first increment) · Status: approved_

## Context

P1 shipped the double-entry ledger. A **manual payout flow** already exists
(v3.9): `payout_requests` (`pending → approved → paid | rejected`),
`AdminPayouts.jsx`, and a `SETTLEMENT` ledger relief (`payoutEntry`: DR Vendor
Payables 2000 → CR Bank 1000) posted when a payout is marked paid.

The gap this increment closes is **balance correctness**. Today
`vendorController.getPayoutBalance` / `requestPayout` compute "earned" as the
`vendor_amount` of **every** `payment_status='paid'` booking:

```js
.eq('payment_status', 'paid')   // counts uncompleted AND cancelled bookings
```

Three defects:
1. **Withdraw before delivery** — a paid-but-not-completed booking counts as
   earned, so a vendor can cash out for a service not yet delivered.
2. **Cancelled bookings still count** — a paid-then-cancelled booking stays
   withdrawable (no refund reversal until P3).
3. **Ignores P1 infrastructure** — `bookings.settlement_status`
   (`pending_completion` / `eligible_for_settlement` / `cancelled` /
   `not_eligible`) and `completed_at` exist precisely for this but are unused.

## Goal (scope of THIS increment)

Make the vendor balance accurate, gated on **service completion + a clearing
window**. Backend correctness + minimal client display. No new pages.

**Decided in brainstorming:**
- Withdrawable trigger: **completion + clearing window** (dispute/refund buffer).
- Clearing window default: **7 days** (T+7), admin-configurable.
- Surfaces: **corrected balance numbers only** (existing Payouts page). No
  vendor ledger statement page, no admin per-vendor ledger view this increment.

**Explicitly out of scope (later P2 increments / phases):** holds, weekly
batches, two-person principle, automated Razorpay (RazorpayX) disbursement,
vendor/admin ledger statement UIs, reconciliation tooling (P4), refunds (P3).

## Approach

**Approach A (chosen): derive withdrawable from `bookings`; ledger stays the
accounting source of truth.** Rewrite the balance calc with the
completion+window gate; add one config key. No new tables.

Rejected **Approach B** (a materialized `settlement_items` table maintained by
trigger/cron): more infrastructure that only pays off once holds/batches exist;
premature at current scale.

**Why bookings, not the ledger, for "withdrawable":** the ledger credits Vendor
Payables (2000) at **payment** time, and a cancelled paid booking keeps its
ORDER_PAYMENT credit until P3 refunds reverse it. So raw ledger 2000 overstates
what's truly owed. The `bookings` filter (settlement_status + completed_at +
window, cancelled excluded) is authoritative for **eligibility**; the ledger
remains authoritative for **accounting**. The two intentionally differ;
reconciliation tooling is P4.

## Components

### 1. Config — clearing window
- New `platform_settings` key `settlement_clearing_days`, default `7`.
- Read via `server/services/platformConfig.js` (existing 60s-cache pattern,
  `clearCache()` on admin settings save). Robust parse → integer ≥ 0; fall back
  to 7 on missing/invalid.
- No admin UI required this increment (DB-editable). May expose later.

### 2. `settlementService.js` (new) — `computeSettlementBalance(hostId)`
Single source of truth for both endpoints. One read of the host's bookings
(`vendor_amount, settlement_status, completed_at, payment_status`) + one read of
`payout_requests` (`amount, status`). Pure aggregation:

- `windowMs = settlement_clearing_days * 86_400_000`; `cutoff = now − windowMs`.
- `matured` = Σ `vendor_amount` where `settlement_status='eligible_for_settlement'`
  AND `completed_at IS NOT NULL` AND `completed_at ≤ cutoff`.
- `clearing` = same predicate but `completed_at > cutoff` (completed, still
  maturing).
- `pendingCompletion` = Σ `vendor_amount` where `payment_status='paid'` AND
  `settlement_status='pending_completion'` (paid, service not done).
- Bookings with `settlement_status IN ('cancelled','not_eligible')` are
  **excluded** entirely.
- Payouts: `claimed` = Σ amount where status ∈ {pending, approved, paid};
  `inflight` = Σ {pending, approved}; `paidOut` = Σ {paid}.
- `available = max(0, matured − claimed)`.
- `lifetimeEarned = matured + clearing + pendingCompletion` (informational; total
  the vendor will eventually be owed for non-cancelled bookings).
- Returns, all rounded to 2 dp:
  `{ available, clearing, pendingCompletion, inflight, paidOut, lifetimeEarned }`.

**Conservative gate:** a booking with `status='completed'` but
`settlement_status` not advanced (and null `completed_at`) is NOT counted as
matured/clearing — it falls under neither predicate. Acceptable (such rows today
are ₹0 test data). A one-time heal to stamp legacy completed bookings is a
possible follow-up, not part of this increment.

### 3. `getPayoutBalance` (rewrite)
Delegates to `computeSettlementBalance` and returns the full breakdown
(`available, clearing, pendingCompletion, inflight, paidOut, lifetimeEarned`)
instead of the current `{available, pending, totalWithdrawn, totalEarned}`.

### 4. `requestPayout` (rewrite)
- Recompute `available` via `computeSettlementBalance` (not the all-paid sum).
- Keep ₹100 minimum.
- Reject if `amount > available` with the available figure in the message.
- Insert `payout_requests` row unchanged otherwise.

### 5. Client `Payouts.jsx`
- Render the new breakdown: **Available** (withdrawable now) as the headline,
  plus secondary lines **Clearing** (`₹X — available {clearing_days} days after
  completion`) and **Pending completion** (`₹Y — after the service is completed`).
- Withdraw form still gated to `available`.
- No new route/page.

## Data flow

```
completeBooking (P1)  ──stamps──▶ bookings.settlement_status='eligible_for_settlement'
                                  bookings.completed_at = now
                                          │
getPayoutBalance / requestPayout ─────────┼─▶ computeSettlementBalance(hostId)
                                          │      reads bookings + payout_requests
                                          │      applies window gate
                                          ▼
                              { available, clearing, pendingCompletion, ... }
                                          │
payout paid (existing v3.9) ──────────────┴─▶ payoutEntry: DR 2000 / CR 1000 (SETTLEMENT)
```

## Error handling
- `platformConfig` read failure → default window 7, never throw.
- Both endpoints keep the existing `safeError` wrapper.
- `computeSettlementBalance` treats missing/null numeric fields as 0; never
  throws on data shape.
- Negative `available` clamped to 0.

## Testing (TDD)
Unit tests for `computeSettlementBalance` (mock the two table reads):
1. Only matured eligible bookings → counted in `available`.
2. Eligible but within window → `clearing`, NOT `available`.
3. `pending_completion` paid → `pendingCompletion`, NOT `available`.
4. Cancelled / not_eligible → excluded from every bucket.
5. Payouts (pending/approved/paid) reduce `available`; `paidOut`/`inflight`
   reported correctly.
6. `available` never negative (over-claimed edge).
7. Window boundary: `completed_at` exactly at cutoff → matured (≤ cutoff).
8. Configurable window honored (e.g. 0 days → eligible counts immediately).

`requestPayout`: rejects amount > available; rejects < ₹100; accepts valid.
Existing payout/ledger tests must stay green.

## Migration
- `vX_settlement_clearing_config.sql` — insert `settlement_clearing_days=7` into
  `platform_settings` if absent (idempotent). (Migration number assigned at
  implementation time against the current max.)

## Success criteria
- A paid-but-not-completed booking contributes to `pendingCompletion`, never
  `available`.
- A completed booking within 7 days is in `clearing`; after 7 days, `available`.
- A cancelled paid booking contributes to nothing.
- `requestPayout` cannot exceed `available`.
- Window length changes when the config value changes.
- Server + client test suites green; builds clean.
