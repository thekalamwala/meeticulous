# Financial Ledger — Phase 1 (Ledger Core) Design

**Date:** 2026-06-13
**Source PRD:** PRD_Marketplace_Financial_Ledger.md v2.0 (full system; this spec covers Phase 1 only)
**Status:** Approved in brainstorming; pending spec review

---

## 1. Context & Decomposition

The PRD describes a full double-entry accounting and settlement system. It maps to the
admin-platform M2 (Finance) milestone. It is too large for one plan, so it is decomposed
into five phases, each with its own spec → plan → build cycle:

| Phase | Scope |
|---|---|
| **P1 (this spec)** | Ledger core: chart of accounts, journal entries/lines, ledger entries, immutable financial snapshot, posting on payment events, backfill, admin finance dashboard |
| P2 | Settlement engine: eligibility, weekly batches, holds, vendor ledger, settlement UI |
| P3 | Refunds: window rules, refund accounting, settlement-hold integration |
| P4 | Reconciliation (3-level), financial periods + closing, reports + CSV/Excel exports |
| P5 | Razorpay Subscriptions (recurring mandate) migration + remaining subscription accounting |

## 2. Decisions Made (with the user, 2026-06-13)

1. **Phased P1→P5** — each phase ships independently with tests.
2. **Commission GST adopted (PRD model).** 18% GST on commission, vendor-borne.
   New vendor payable: `service_price − commission − commission_gst − razorpay_fee − razorpay_tax`.
   Changes live vendor payouts for Free-plan bookings going forward. Historical bookings keep
   their original snapshots.
3. **booking = order item.** No `orders`/`order_items` tables yet. All financial tables carry
   an `order_item_id` column which today stores `bookings.id`. When a cart/multi-vendor order
   structure exists later, the ledger schema needs no change (PRD §6 satisfied).
4. **Backfill history.** A one-time idempotent script replays historical paid bookings and
   subscription purchases into the journal (source_type `BACKFILL`, original dates), truthful
   to what was actually charged at the time (i.e. no commission GST on old bookings).
5. **Posting architecture: Hybrid RPC.** Pure JS builds journal templates (unit-testable like
   pricingEngine); ONE Postgres function `post_journal_entry(jsonb)` performs the atomic,
   balance-validated, race-free insert.
6. **Subscription GST charged in P1.** Plan purchases now charge `plan_price × 1.18`
   (₹999 plan → ₹1,178.82 total; ₹179.82 GST liability). GST is on top, never embedded
   (PRD §5.2). Plans/checkout UI shows the GST line. The recurring-mandate mechanism itself
   stays one-time-annual until P5.

## 3. Current State (verified in code)

- Money math lives in `server/lib/pricingEngine.js` (v2.2, pure, config-injectable).
  Current model: customer pays `service_price + platform_fee(₹10) + 18% GST on fee`;
  vendor payout = `price − commission − razorpay_fee_actual`; commission % from
  `subscription_plans.commission_percentage` (Free 5%, paid 0%). **No commission GST.**
- `paymentController.verifyPayment` fetches the captured payment and stores
  `payment.fee / 100` (paise → ₹) into `bookings.razorpay_fee_actual`. Razorpay's `fee`
  **includes** tax; `payment.tax` is available but not stored separately today.
- Booking snapshot columns (v2.2, live): `platform_fee_amount`, `platform_fee_gst`,
  `commission_applied`, `razorpay_fee_actual`, `customer_total`, `gst_rate`, `vendor_amount`.
- `bookings` has **no** `paid_at`/`completed_at` timestamps — completion is
  `status='completed'` + `updated_at` only.
- Subscriptions: one-time annual Razorpay order (365 days), price from `subscription_plans`,
  no GST charged, no per-payment record table.
- Admin RBAC live (v2.4): 45-perm catalog in `server/lib/adminPermissions.js`, finance role
  exists, `requireAdmin(perm)` middleware, `auditService.audit()` on mutations.
- Vendor payout-request flow exists (`vendorController`) — manual admin processing.
  **Untouched in P1**; replaced by settlement batches in P2.

## 4. Money Model v3 (P1)

### Order payments (bookings)

```
Customer pays      = service_price + platform_fee(₹10, admin-set) + 18% GST on platform fee   (UNCHANGED)
commission         = plan.commission_percentage % × service_price                              (UNCHANGED)
commission_gst     = 18% × commission                                                          (NEW, vendor-borne)
razorpay_fee       = actual fee excl tax  (payment.fee − payment.tax, paise → ₹)               (SPLIT, was merged)
razorpay_tax       = actual tax            (payment.tax, paise → ₹)                            (NEW column)
vendor_payable     = service_price − commission − commission_gst − razorpay_fee − razorpay_tax
```

Vendor deduction for the gateway is the same total as today (`payment.fee` already included
tax); it is now stored as two fields per PRD §19. PRD worked examples are the acceptance
fixtures: Free ₹1,000 → vendor ₹917.40; Paid ₹1,000 → vendor ₹976.40 (with 2% fee + 18% tax).

GST collected (platform-fee GST + commission GST + subscription GST) is a **liability**,
never revenue. Net Revenue formula per PRD §22.

### Subscription payments

```
total_charged = plan_price + 18% × plan_price        (NEW — GST now charged on top)
Razorpay fee + tax on subscription payments are PLATFORM expenses (not passed to vendor).
Revenue recognized immediately at paid_at.
```

`pricingEngine.js` gains `calculateCommissionGst()` and an updated `computeBreakdown()`
returning `commissionGst`, `vendorPayout` per the new formula, and a
`computeSubscriptionBreakdown({ planPrice, gstRate })` helper. GST rate read from existing
`platform_settings.platform_fee_gst_rate` (0.18) and snapshotted per record.

## 5. Schema — migration `v2.8_financial_ledger.sql` (additive)

All financial amounts `NUMERIC(12,2)` (aggregates `NUMERIC(14,2)`), timestamps UTC,
all FKs indexed, RLS deny-all on every new table (service-role only).

### chart_of_accounts
`id uuid PK, code text UNIQUE (e.g. '1000'), name, type CHECK IN (ASSET, LIABILITY, REVENUE, EXPENSE), active bool, created_at`.
Seeded with PRD §8: Bank, Razorpay Receivable | Vendor Payables, GST Payable, Refund Liability |
Platform Fee Revenue, Commission Revenue, Subscription Revenue | Razorpay Charges (Orders),
Razorpay Charges (Subscriptions), Settlement Charges, Refund Losses.

### journal_entries
`id uuid PK, journal_number text UNIQUE (JNL-YYYY-NNNNNN from a DB sequence), journal_date date,
source_type CHECK IN (ORDER_PAYMENT, SUBSCRIPTION_PAYMENT, SETTLEMENT, REFUND, ADJUSTMENT, REVERSAL, BANK_TRANSFER, BACKFILL),
source_id uuid, description text, created_by uuid NULL (admin_users.id or NULL=system), created_at`.
**UNIQUE (source_type, source_id)** — idempotency key (one entry per event).
No UPDATE/DELETE granted; immutability also enforced at app layer (PRD §28).

### journal_lines
`id uuid PK, journal_entry_id FK, account_id FK, debit NUMERIC(12,2) DEFAULT 0, credit NUMERIC(12,2) DEFAULT 0,
CHECK (debit = 0 OR credit = 0) AND (debit > 0 OR credit > 0), vendor_id uuid NULL, order_id uuid NULL,
order_item_id uuid NULL (= bookings.id today), subscription_payment_id uuid NULL, created_at`.
Indexes: journal_entry_id, account_id, vendor_id, order_item_id.

### ledger_entries (PRD §10)
`id, created_at, account_id FK, order_id NULL, order_item_id NULL, vendor_id NULL,
subscription_payment_id NULL, journal_entry_id FK, ledger_type CHECK (DEBIT/CREDIT), debit, credit,
balance_after_account NUMERIC(14,2)`.
Written ONLY by the RPC. Indexes: account_id + created_at, order_item_id, vendor_id, journal_entry_id.

### account_balances
`account_id PK FK, balance NUMERIC(14,2), updated_at`. One row per account, seeded 0.
Locked `FOR UPDATE` inside the RPC — running balances cannot race across instances.

### subscription_payments (PRD §5.4)
`id uuid PK, vendor_id FK, plan_type text, plan_price, gst_amount, total_charged,
razorpay_fee, razorpay_tax, razorpay_payment_id, razorpay_order_id,
paid_at timestamptz, revenue_recognized_at timestamptz,
billing_period_start date, billing_period_end date, status text, created_at`.
(`razorpay_subscription_id` column included now, NULL until P5.)

### bookings — new columns
`paid_at timestamptz, completed_at timestamptz, revenue_recognized_at timestamptz, settled_at timestamptz,
commission_gst NUMERIC(12,2) DEFAULT 0, razorpay_tax_actual NUMERIC(12,2) DEFAULT 0,
commission_percentage NUMERIC(5,2), vendor_plan_type text,
settlement_status text DEFAULT 'pending_completion', revenue_recognition_status text DEFAULT 'pending'`.
Backfill `paid_at`/`completed_at` from `updated_at` heuristics where possible during migration
(best-effort; documented in backfill script).

### RPC `post_journal_entry(p jsonb) RETURNS uuid` (SECURITY DEFINER)
1. If `(source_type, source_id)` already exists → return existing id (idempotent no-op).
2. Validate Σdebit = Σcredit (exception otherwise), ≥ 2 lines.
3. Insert journal_entries + journal_lines.
4. Per line: lock `account_balances` row, apply debit/credit sign by account type
   (ASSET/EXPENSE: debit +, credit −; LIABILITY/REVENUE: credit +, debit −),
   insert ledger_entries row with `balance_after_account`.
5. All in one function = one transaction.

## 6. Posting Flow

New module `server/services/ledger/`:

- **`journalTemplates.js`** — pure builders, no DB. One per PRD §11 template:
  `orderPaymentEntry(snapshot)` (free-plan and paid-plan variants), `subscriptionPaymentEntry(payment)`,
  `bankTransferEntry({amount, reference})`, `adjustmentEntry(lines)`, `reversalEntry(originalEntry)`.
  Every builder output must balance; unit tests assert exact amounts on PRD worked examples.
- **`postingService.js`** — `post(sourceType, sourceId, builderOutput, meta)` → RPC call.
  The ONLY write path to ledger tables from JS.

Trigger points:

1. **Booking payment** — `paymentController.verifyPayment`: after fee fetch, finalize snapshot
   (incl `commission_gst`, fee/tax split, `paid_at`, `commission_percentage`, `vendor_plan_type`),
   then post ORDER_PAYMENT. Posting failure does NOT fail the payment response (payment already
   captured); it logs loudly and the self-heal cron recovers it.
2. **Booking completion** — `bookingController` complete handler: stamp `completed_at`,
   `revenue_recognized_at`, `revenue_recognition_status='recognized'`,
   `settlement_status='eligible_for_settlement'`. **No new journal entry** — commission revenue
   was credited at payment (PRD §11.1); recognition is tracked as dates/status on the booking.
   Revenue reports filter on `revenue_recognized_at`; GST/cash reports on `journal_date`.
3. **Subscription purchase** — plan-purchase verify path: charge `total_charged` (incl GST),
   insert `subscription_payments` row, post SUBSCRIPTION_PAYMENT (with platform-borne
   Razorpay fee+tax lines per PRD §11.3).
4. **Razorpay → bank transfer** — manual admin form in P1 (amount + settlement reference) →
   BANK_TRANSFER entry (DR Bank / CR Razorpay Receivable). Automated reconciliation is P4.

**Self-heal cron** (hourly, pattern of badge engine): find paid bookings and subscription_payments
rows with no matching journal entry → rebuild snapshot template → repost (idempotency key makes
this safe). Surfaces count in ops attention queue (`/admin/ops/summary`).

**Cancellations in P1:** a paid booking cancelled before any refund system exists (P3) keeps its
ORDER_PAYMENT entry; `settlement_status='cancelled'` excludes it from future settlement (P2).
Money movements for refunds are out of scope until P3; admins can use ADJUSTMENT entries if a
manual refund happens before P3 ships.

## 7. Backfill — `server/scripts/backfillLedger.js`

- Idempotent (relies on the unique source key; re-run safe). `--dry-run` mode prints the plan.
- Replays in chronological order:
  1. Historical paid bookings → ORDER_PAYMENT-shaped entries with source_type `BACKFILL`,
     `journal_date` = best-known paid date, amounts from the **existing v2.2 snapshots**
     (no commission GST — truthful to what was charged).
  2. Historical subscription purchases (from profiles/plan purchase records) → BACKFILL entries,
     gst_amount 0 (none was charged), with `subscription_payments` rows created retroactively.
  3. Already-paid-out vendor payouts (existing payout records) → BACKFILL settlement-shaped
     entries (DR Vendor Payables / CR Bank) so the Vendor Payables balance equals actual
     outstanding, not all-time.
- After run: assert Σ(account_balances) internal consistency (total debits = credits) and print
  a closing summary for manual sanity-check against known revenue (₹-level dataset is tiny).

## 8. Admin API — `/api/admin/finance/*` (new `financeAdminController`)

| Route | Perm | Notes |
|---|---|---|
| `GET /summary` | finance.view | PRD §23 metrics from `account_balances` + indexed SUMs; no full-table in-memory aggregation |
| `GET /journals` | finance.view | keyset pagination (created_at,id), filters: source_type, date range, vendor_id |
| `GET /journals/:id` | finance.view | entry + lines + account names |
| `GET /ledger/:accountId` | finance.view | ledger rows w/ running balance, keyset-paginated |
| `GET /accounts` | finance.view | chart of accounts + current balances |
| `POST /adjustment` | finance.manage | balanced lines required; `audit()` logged |
| `POST /reversal` | finance.manage | mirrors an existing entry; `audit()` logged |
| `POST /bank-transfer` | finance.manage | amount + settlement_reference; `audit()` logged |

Permission names reuse the existing finance permissions in `lib/adminPermissions.js`
(verify exact keys during planning; add `finance.ledger.*` only if catalog lacks fits).

## 9. Admin UI (new FINANCE sidebar section, existing brand style, recharts)

- **`AdminFinanceDashboard.jsx`** (`/admin/finance`) — metric cards: Gross Collections,
  Outstanding Vendor Payables, Platform Fee Revenue, Commission Revenue, Subscription Revenue,
  GST Liability, Razorpay Charges (Orders/Subs), Net Revenue, Available Business Cash;
  revenue-by-month bar chart (recharts).
- **`AdminJournal.jsx`** (`/admin/finance/journal`) — entries table (journal_number, date,
  source, description, amount), expandable line detail, filters, manual-entry modal
  (adjustment / reversal / bank transfer) gated by finance.manage.
- **`AdminLedger.jsx`** (`/admin/finance/ledger`) — account picker → ledger rows with running
  balance column.
- UX rules (ui-ux-pro-max pass): tabular numerals for all money columns, `Intl.NumberFormat('en-IN')`
  ₹ formatting, skeleton loaders, meaningful empty states, server-side pagination controls,
  4.5:1 contrast, SVG icons only, 44px touch targets.
- **Vendor-facing changes:** Earnings page adds a "Commission GST" deduction line item;
  Plans/checkout shows "+ 18% GST" line and the new total before Razorpay opens.

## 10. Out of Scope (P1)

Settlement batches + eligibility runs (P2) · refund windows/accounting (P3) ·
3-level reconciliation, financial periods, period closing, reports + exports (P4) ·
Razorpay Subscriptions recurring mandate (P5) · Razorpay webhook ingestion ·
multi-vendor orders/cart. Existing vendor payout-request flow remains as-is until P2.

## 11. Testing & Verification

- **pricingEngine v3 unit tests** — rewritten suite incl PRD fixtures (₹917.40 / ₹976.40 /
  ₹1,178.82) and edge cases (0 price, 0% commission, rounding).
- **journalTemplates unit tests** — every template balances; exact line amounts per PRD §11.
- **postingService tests** — RPC called with built payload; idempotent duplicate handling;
  failure logged not thrown into payment path.
- **financeAdminController tests** — permission gating (finance vs ops 403), pagination,
  filter correctness, adjustment must balance.
- **Backfill** — dry-run test against fixture data; idempotency (run twice = same state).
- **Client tests** — 3 new admin pages render, metric formatting, manual-entry modal validation.
- **Live verification** — migration applied via Supabase MCP; one real test booking + one plan
  purchase e2e; RPC balance check; gstack browser QA pass over the three finance pages
  (screenshots as evidence).

## 12. Risks / Notes

- Posting after payment capture is not atomic with Razorpay — mitigated by idempotency +
  self-heal cron (same risk profile as today's fee-fetch fallback).
- Commission GST changes Free-plan vendor take-home from the ship date; comms to vendors is a
  product decision outside this spec.
- `payment.fee` semantics (fee inclusive of tax) re-verified against the live Razorpay response
  during implementation before relying on the split.
- Migration ordering: v2.8 is additive; schema-fallback pattern (used across the codebase) not
  needed since code ships after migration is applied via MCP in the same rollout.
