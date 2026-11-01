# Financial Ledger P1 (Ledger Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Double-entry accounting ledger: chart of accounts, journal/ledger tables, atomic posting RPC, money-model v3 (commission GST + subscription GST + fee/tax split), posting on payment events, self-heal cron, backfill, and an admin Finance dashboard.

**Architecture:** Pure JS builds balanced journal templates (`server/services/ledger/`); ONE Postgres SECURITY DEFINER function `post_journal_entry(jsonb)` performs the atomic, balance-validated, race-free insert with running balances. Controllers post non-fatally after payment capture; an hourly reconciler cron self-heals missed postings (idempotency via UNIQUE (source_type, source_id)).

**Tech Stack:** Node/Express, Supabase (PostgreSQL + RPC), Razorpay, React 18 + Tailwind, Jest + Vitest.

**Spec:** `docs/superpowers/specs/2026-06-13-financial-ledger-p1-design.md`

**Deviation from spec §6 (documented):** The PRD §11.1 template debits Razorpay Receivable GROSS and never relieves the gateway fee, so the receivable would permanently overstate by fees and Level-2/3 reconciliation could never match. The order-payment template here posts gross + relief in ONE entry (8 lines, same accounts debited and credited for gateway charges), leaving: receivable = net cash Razorpay will remit, Razorpay Charges (Orders) net 0 (vendor-borne) but with gross visibility on the debit side, and vendor payable exactly per PRD (₹917.40 fixture).

**Conventions for every task:**
- Run server tests from `server/`: `npm test -- --runTestsByPath tests/unit/<file> --silent`
- Run client tests from `client/`: `npm test -- run src/...`
- Commit after each green step. Never edit ledger rows by hand.
- Migration is applied to live Supabase via the Supabase MCP `apply_migration` tool BEFORE server code that depends on it is deployed/run.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `server/migrations/v2.8_financial_ledger.sql` | Create | All P1 schema + seeds + RPC |
| `server/lib/pricingEngine.js` | Modify | Money math v3 (commission GST, subscription breakdown) |
| `server/lib/ledgerAccounts.js` | Create | Account code constants (shared JS ↔ SQL seed) |
| `server/services/ledger/journalTemplates.js` | Create | Pure balanced journal builders |
| `server/services/ledger/postingService.js` | Create | Only JS write-path to the ledger (RPC call) |
| `server/services/ledger/ledgerReconciler.js` | Create | Self-heal: repost missed entries |
| `server/scripts/backfillLedger.js` | Create | One-time idempotent history replay |
| `server/controllers/bookingController.js` | Modify | Snapshot v3 fields at creation; completion stamps |
| `server/controllers/paymentController.js` | Modify | Fee/tax split, paid_at, posting hooks, subscription GST |
| `server/lib/adminPermissions.js` | Modify | + `finance.manage` |
| `server/controllers/financeAdminController.js` | Create | Summary, journals, ledger, accounts, manual entries |
| `server/routes/adminRoutes.js` | Modify | `/admin/finance/*` routes |
| `server/server.js` | Modify | Hourly reconciler interval |
| `client/src/services/api.js` | Modify | adminFinance* helpers |
| `client/src/pages/admin/AdminFinanceDashboard.jsx` | Create | Metric cards + monthly revenue chart |
| `client/src/pages/admin/AdminJournal.jsx` | Create | Journal browser + manual entry modal |
| `client/src/pages/admin/AdminLedger.jsx` | Create | Per-account ledger viewer |
| `client/src/App.jsx` | Modify | 3 new admin routes |
| `client/src/components/common/AdminLayout.jsx` | Modify | FINANCE nav items |
| `client/src/pages/UpgradePlan.jsx` | Modify | "+18% GST" display |
| Tests | Create | `server/tests/unit/{pricingEngineV3,journalTemplates,postingService,ledgerReconciler,financeAdminController}.test.js`, `client/src/pages/admin/__tests__/AdminFinance.test.jsx` |

---

### Task 1: Migration `v2.8_financial_ledger.sql`

**Files:**
- Create: `server/migrations/v2.8_financial_ledger.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- v2.8_financial_ledger.sql — P1 Ledger Core (PRD: Marketplace Financial Ledger)
-- Additive only. Apply via Supabase MCP. RLS deny-all (service-role only).
-- Spec: docs/superpowers/specs/2026-06-13-financial-ledger-p1-design.md

-- ── 1. Chart of accounts ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  type       text NOT NULL CHECK (type IN ('ASSET','LIABILITY','REVENUE','EXPENSE')),
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO chart_of_accounts (code, name, type) VALUES
  ('1000','Bank','ASSET'),
  ('1100','Razorpay Receivable','ASSET'),
  ('2000','Vendor Payables','LIABILITY'),
  ('2100','GST Payable','LIABILITY'),
  ('2200','Refund Liability','LIABILITY'),
  ('4000','Platform Fee Revenue','REVENUE'),
  ('4100','Commission Revenue','REVENUE'),
  ('4200','Subscription Revenue','REVENUE'),
  ('5000','Razorpay Charges (Orders)','EXPENSE'),
  ('5100','Razorpay Charges (Subscriptions)','EXPENSE'),
  ('5200','Settlement Charges','EXPENSE'),
  ('5300','Refund Losses','EXPENSE')
ON CONFLICT (code) DO NOTHING;

-- ── 2. Journal number sequence ────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS journal_number_seq START 1;

-- ── 3. Journal entries ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_number text NOT NULL UNIQUE,
  journal_date   date NOT NULL DEFAULT CURRENT_DATE,
  source_type    text NOT NULL CHECK (source_type IN
    ('ORDER_PAYMENT','SUBSCRIPTION_PAYMENT','SETTLEMENT','REFUND',
     'ADJUSTMENT','REVERSAL','BANK_TRANSFER','BACKFILL','BACKFILL_SETTLEMENT')),
  source_id      uuid NOT NULL,
  description    text,
  created_by     uuid,                       -- admin_users.id; NULL = system
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)            -- idempotency key
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date   ON journal_entries (journal_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries (source_type, source_id);

-- ── 4. Journal lines ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_lines (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id        uuid NOT NULL REFERENCES journal_entries(id),
  account_id              uuid NOT NULL REFERENCES chart_of_accounts(id),
  debit                   numeric(12,2) NOT NULL DEFAULT 0 CHECK (debit  >= 0),
  credit                  numeric(12,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  vendor_id               uuid,
  order_id                uuid,            -- future cart structure; NULL today
  order_item_id           uuid,            -- = bookings.id today
  subscription_payment_id uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry      ON journal_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account    ON journal_lines (account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_vendor     ON journal_lines (vendor_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_order_item ON journal_lines (order_item_id);

-- ── 5. Ledger entries (written ONLY by the RPC) ───────────────
CREATE TABLE IF NOT EXISTS ledger_entries (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  account_id              uuid NOT NULL REFERENCES chart_of_accounts(id),
  order_id                uuid,
  order_item_id           uuid,
  vendor_id               uuid,
  subscription_payment_id uuid,
  journal_entry_id        uuid NOT NULL REFERENCES journal_entries(id),
  ledger_type             text NOT NULL CHECK (ledger_type IN ('DEBIT','CREDIT')),
  debit                   numeric(12,2) NOT NULL DEFAULT 0,
  credit                  numeric(12,2) NOT NULL DEFAULT 0,
  balance_after_account   numeric(14,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_account_time ON ledger_entries (account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_order_item   ON ledger_entries (order_item_id);
CREATE INDEX IF NOT EXISTS idx_ledger_vendor       ON ledger_entries (vendor_id);
CREATE INDEX IF NOT EXISTS idx_ledger_journal      ON ledger_entries (journal_entry_id);

-- ── 6. Running balances (one row per account, locked in RPC) ──
CREATE TABLE IF NOT EXISTS account_balances (
  account_id uuid PRIMARY KEY REFERENCES chart_of_accounts(id),
  balance    numeric(14,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO account_balances (account_id, balance)
  SELECT id, 0 FROM chart_of_accounts
ON CONFLICT (account_id) DO NOTHING;

-- ── 7. Subscription payments (PRD §5.4) ───────────────────────
CREATE TABLE IF NOT EXISTS subscription_payments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id                uuid NOT NULL,
  plan_type                text NOT NULL,
  plan_price               numeric(12,2) NOT NULL,
  gst_amount               numeric(12,2) NOT NULL DEFAULT 0,
  total_charged            numeric(12,2) NOT NULL,
  razorpay_fee             numeric(12,2) NOT NULL DEFAULT 0,
  razorpay_tax             numeric(12,2) NOT NULL DEFAULT 0,
  razorpay_payment_id      text,
  razorpay_order_id        text,
  razorpay_subscription_id text,           -- NULL until P5 (recurring mandate)
  paid_at                  timestamptz NOT NULL DEFAULT now(),
  revenue_recognized_at    timestamptz NOT NULL DEFAULT now(),
  billing_period_start     date,
  billing_period_end       date,
  status                   text NOT NULL DEFAULT 'paid',
  created_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subpay_vendor ON subscription_payments (vendor_id);
CREATE INDEX IF NOT EXISTS idx_subpay_paid   ON subscription_payments (paid_at);

-- ── 8. Booking snapshot/recognition columns ───────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_at                    timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at               timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS revenue_recognized_at      timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS settled_at                 timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS commission_gst             numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS razorpay_tax_actual        numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS commission_percentage      numeric(5,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vendor_plan_type           text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS settlement_status          text NOT NULL DEFAULT 'pending_completion';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS revenue_recognition_status text NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_bookings_settlement_status ON bookings (settlement_status);
CREATE INDEX IF NOT EXISTS idx_bookings_paid_at           ON bookings (paid_at);

-- ── 9. RLS deny-all on every new table ────────────────────────
ALTER TABLE chart_of_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
-- No policies created = deny all to anon/authenticated; service role bypasses.

-- ── 10. Atomic posting RPC ────────────────────────────────────
CREATE OR REPLACE FUNCTION post_journal_entry(p jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_existing      uuid;
  v_entry_id      uuid;
  v_journal_no    text;
  v_total_debit   numeric(14,2) := 0;
  v_total_credit  numeric(14,2) := 0;
  v_line          jsonb;
  v_acct_id       uuid;
  v_acct_type     text;
  v_debit         numeric(12,2);
  v_credit        numeric(12,2);
  v_signed        numeric(14,2);
  v_new_balance   numeric(14,2);
BEGIN
  IF p->>'source_type' IS NULL OR p->>'source_id' IS NULL THEN
    RAISE EXCEPTION 'source_type and source_id are required';
  END IF;

  -- Idempotent: one entry per (source_type, source_id)
  SELECT id INTO v_existing FROM journal_entries
   WHERE source_type = p->>'source_type' AND source_id = (p->>'source_id')::uuid;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  IF p->'lines' IS NULL OR jsonb_array_length(p->'lines') < 2 THEN
    RAISE EXCEPTION 'journal entry needs at least 2 lines';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p->'lines') LOOP
    v_total_debit  := v_total_debit  + COALESCE((v_line->>'debit')::numeric,  0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::numeric, 0);
  END LOOP;
  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'journal entry does not balance: debits=% credits=%', v_total_debit, v_total_credit;
  END IF;

  v_journal_no := 'JNL-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('journal_number_seq')::text, 6, '0');

  INSERT INTO journal_entries (journal_number, journal_date, source_type, source_id, description, created_by)
  VALUES (
    v_journal_no,
    COALESCE((p->>'journal_date')::date, CURRENT_DATE),
    p->>'source_type',
    (p->>'source_id')::uuid,
    p->>'description',
    (p->>'created_by')::uuid
  ) RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p->'lines') LOOP
    SELECT id, type INTO v_acct_id, v_acct_type
      FROM chart_of_accounts WHERE code = v_line->>'account_code';
    IF v_acct_id IS NULL THEN
      RAISE EXCEPTION 'unknown account code %', v_line->>'account_code';
    END IF;

    v_debit  := COALESCE((v_line->>'debit')::numeric,  0);
    v_credit := COALESCE((v_line->>'credit')::numeric, 0);
    IF (v_debit > 0 AND v_credit > 0) OR (v_debit = 0 AND v_credit = 0) THEN
      RAISE EXCEPTION 'each line must have exactly one of debit/credit > 0';
    END IF;

    INSERT INTO journal_lines
      (journal_entry_id, account_id, debit, credit, vendor_id, order_id, order_item_id, subscription_payment_id)
    VALUES
      (v_entry_id, v_acct_id, v_debit, v_credit,
       NULLIF(v_line->>'vendor_id','')::uuid,
       NULLIF(v_line->>'order_id','')::uuid,
       NULLIF(v_line->>'order_item_id','')::uuid,
       NULLIF(v_line->>'subscription_payment_id','')::uuid);

    -- Normal balance sign: ASSET/EXPENSE grow on debit; LIABILITY/REVENUE on credit.
    IF v_acct_type IN ('ASSET','EXPENSE') THEN
      v_signed := v_debit - v_credit;
    ELSE
      v_signed := v_credit - v_debit;
    END IF;

    -- Row lock serialises concurrent postings per account (no balance races).
    UPDATE account_balances
       SET balance = balance + v_signed, updated_at = now()
     WHERE account_id = v_acct_id
     RETURNING balance INTO v_new_balance;

    INSERT INTO ledger_entries
      (account_id, order_id, order_item_id, vendor_id, subscription_payment_id,
       journal_entry_id, ledger_type, debit, credit, balance_after_account)
    VALUES
      (v_acct_id,
       NULLIF(v_line->>'order_id','')::uuid,
       NULLIF(v_line->>'order_item_id','')::uuid,
       NULLIF(v_line->>'vendor_id','')::uuid,
       NULLIF(v_line->>'subscription_payment_id','')::uuid,
       v_entry_id,
       CASE WHEN v_debit > 0 THEN 'DEBIT' ELSE 'CREDIT' END,
       v_debit, v_credit, v_new_balance);
  END LOOP;

  RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION post_journal_entry(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION post_journal_entry(jsonb) FROM anon, authenticated;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use MCP tool `apply_migration` with name `v2_8_financial_ledger` and the file content. (Do NOT run via SQL editor copy-paste; MCP keeps the migration list.)

- [ ] **Step 3: Verify**

Via MCP `execute_sql`:
```sql
SELECT count(*) FROM chart_of_accounts;                 -- expect 12
SELECT count(*) FROM account_balances;                  -- expect 12
SELECT post_journal_entry('{"source_type":"ADJUSTMENT","source_id":"00000000-0000-0000-0000-000000000001","description":"smoke test","lines":[{"account_code":"1000","debit":1.00,"credit":0},{"account_code":"4000","debit":0,"credit":1.00}]}'::jsonb);
SELECT balance FROM account_balances ab JOIN chart_of_accounts c ON c.id=ab.account_id WHERE c.code='1000';  -- 1.00
-- idempotency: same call again returns the SAME uuid, balance stays 1.00
-- then reverse the smoke test:
SELECT post_journal_entry('{"source_type":"REVERSAL","source_id":"00000000-0000-0000-0000-000000000001","description":"smoke test reversal","lines":[{"account_code":"1000","debit":0,"credit":1.00},{"account_code":"4000","debit":1.00,"credit":0}]}'::jsonb);
-- balances back to 0
```

- [ ] **Step 4: Commit**

```bash
git add server/migrations/v2.8_financial_ledger.sql
git commit -m "feat(ledger): v2.8 migration — chart of accounts, journal/ledger tables, atomic posting RPC"
```

---

### Task 2: pricingEngine v3

**Files:**
- Modify: `server/lib/pricingEngine.js`
- Test: `server/tests/unit/pricingEngine.test.js` (extend existing suite)

- [ ] **Step 1: Write failing tests** — append to `server/tests/unit/pricingEngine.test.js`:

```js
describe('v3 — commission GST + subscription breakdown (PRD fixtures)', () => {
  const { calculateCommissionGst, calculateVendorPayout, computeBreakdown, computeSubscriptionBreakdown } = require('../../lib/pricingEngine');

  test('commission GST is 18% of commission', () => {
    expect(calculateCommissionGst(50)).toBe(9);
    expect(calculateCommissionGst(0)).toBe(0);
    expect(calculateCommissionGst(33.33)).toBe(6.0); // 5.9994 → 6.00
  });

  test('PRD §3.1 Free plan ₹1000: payout 917.40', () => {
    // commission 50, commission GST 9, razorpay fee 20 + tax 3.60
    expect(calculateVendorPayout(1000, 50, 9, 23.6)).toBe(917.4);
  });

  test('PRD §3.2 Paid plan ₹1000: payout 976.40', () => {
    expect(calculateVendorPayout(1000, 0, 0, 23.6)).toBe(976.4);
  });

  test('computeBreakdown returns commissionGst and v3 payout', () => {
    const b = computeBreakdown({ servicePrice: 1000, commissionPercentage: 5, platformFee: 10, gstRate: 0.18, razorpayFee: 23.6 });
    expect(b.commission).toBe(50);
    expect(b.commissionGst).toBe(9);
    expect(b.vendorPayout).toBe(917.4);
    expect(b.customerTotal).toBe(1011.8);
    expect(b.platformRevenue).toBe(60); // fee 10 + commission 50 (GST excluded)
  });

  test('PRD §5.2 subscription ₹999 → GST 179.82, total 1178.82', () => {
    const s = computeSubscriptionBreakdown({ planPrice: 999, gstRate: 0.18 });
    expect(s.gstAmount).toBe(179.82);
    expect(s.totalCharged).toBe(1178.82);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`calculateCommissionGst is not a function`)

```bash
cd server && npm test -- --runTestsByPath tests/unit/pricingEngine.test.js --silent
```

- [ ] **Step 3: Implement.** In `server/lib/pricingEngine.js`:

Add after `calculateCommission`:

```js
// ─── GST on the commission (vendor-borne; platform's GST on its service) ─────
/**
 * @param {number} commission  commission amount (₹)
 * @param {object} [opts]      { gstRate } override (default 18%)
 * @returns {number} commission GST in ₹
 */
function calculateCommissionGst(commission, opts = {}) {
  assertNonNegative(commission, 'commission');
  const rate = opts.gstRate != null ? Number(opts.gstRate) : DEFAULTS.gstRate;
  assertNonNegative(rate, 'gstRate');
  return round2(commission * rate);
}
```

Replace `calculateVendorPayout` (v3 signature — commissionGst is the new 3rd arg):

```js
// ─── Vendor payout (commission GST + Razorpay fee always vendor-borne) ───────
/**
 * @param {number} servicePrice   service amount
 * @param {number} commission     platform commission (₹)
 * @param {number} [commissionGst] 18% GST on the commission (₹), vendor-borne
 * @param {number} [razorpayFee]  ACTUAL Razorpay fee+tax total (₹), vendor-borne
 * @returns {number} net amount the vendor receives in ₹
 */
function calculateVendorPayout(servicePrice, commission, commissionGst = 0, razorpayFee = 0) {
  assertNonNegative(servicePrice, 'servicePrice');
  assertNonNegative(commission, 'commission');
  assertNonNegative(commissionGst, 'commissionGst');
  assertNonNegative(razorpayFee, 'razorpayFee');
  return round2(servicePrice - commission - commissionGst - razorpayFee);
}
```

Update `computeBreakdown` body:

```js
function computeBreakdown({ servicePrice, commissionPercentage, platformFee, gstRate, razorpayFee = 0 }) {
  const fee = calculatePlatformFee(servicePrice, { platformFee });
  const gst = calculateGst(fee, { gstRate });
  const commission = calculateCommission(servicePrice, commissionPercentage);
  const commissionGst = calculateCommissionGst(commission, { gstRate });
  const vendorPayout = calculateVendorPayout(servicePrice, commission, commissionGst, razorpayFee);
  const customerTotal = calculateCustomerTotal(servicePrice, fee, gst);
  return {
    servicePrice: round2(servicePrice),
    platformFee: fee,
    gst,
    commission,
    commissionGst,
    razorpayFee: round2(razorpayFee),
    customerTotal,
    vendorPayout,
    // Platform keeps commission + platform fee. All GST is pass-through liability.
    platformRevenue: round2(commission + fee),
  };
}
```

Add before `module.exports`:

```js
// ─── Subscription breakdown (GST charged ON TOP of plan price — PRD §5.2) ────
function computeSubscriptionBreakdown({ planPrice, gstRate }) {
  assertNonNegative(planPrice, 'planPrice');
  const rate = gstRate != null ? Number(gstRate) : DEFAULTS.gstRate;
  assertNonNegative(rate, 'gstRate');
  const gstAmount = round2(planPrice * rate);
  return {
    planPrice: round2(planPrice),
    gstAmount,
    totalCharged: round2(planPrice + gstAmount),
  };
}
```

Export both new functions in `module.exports`.

**Also update the v2.2 doc-comment block at the top** to describe v3 (commission GST line + subscription GST).

- [ ] **Step 4: Fix older tests in the same file.** Existing tests call `calculateVendorPayout(price, commission, razorpayFee)` (3rd arg = fee). Update those call sites to the v3 signature `(price, commission, 0, razorpayFee)` and update any expected `vendorPayout` in old `computeBreakdown` cases where commission > 0 (payout drops by 18% of commission; e.g. Free ₹100 case: payout was 92.66 with commission 5 → now `100 − 5 − 0.90 − 2.34 = 91.76`).

- [ ] **Step 5: Run full pricing suite — expect PASS**

```bash
cd server && npm test -- --runTestsByPath tests/unit/pricingEngine.test.js --silent
```

- [ ] **Step 6: Commit**

```bash
git add server/lib/pricingEngine.js server/tests/unit/pricingEngine.test.js
git commit -m "feat(pricing): v3 money model — commission GST (vendor-borne) + subscription GST breakdown"
```

---

### Task 3: Account constants + journal templates

**Files:**
- Create: `server/lib/ledgerAccounts.js`
- Create: `server/services/ledger/journalTemplates.js`
- Test: `server/tests/unit/journalTemplates.test.js`

- [ ] **Step 1: Create `server/lib/ledgerAccounts.js`**

```js
/**
 * ledgerAccounts.js — account CODE constants, mirrors the v2.8 seed.
 * Codes (not uuids) cross the JS↔SQL boundary; the RPC resolves code → id.
 */
'use strict';

const ACCOUNTS = Object.freeze({
  BANK:                 '1000',
  RAZORPAY_RECEIVABLE:  '1100',
  VENDOR_PAYABLES:      '2000',
  GST_PAYABLE:          '2100',
  REFUND_LIABILITY:     '2200',
  PLATFORM_FEE_REVENUE: '4000',
  COMMISSION_REVENUE:   '4100',
  SUBSCRIPTION_REVENUE: '4200',
  RZP_CHARGES_ORDERS:   '5000',
  RZP_CHARGES_SUBS:     '5100',
  SETTLEMENT_CHARGES:   '5200',
  REFUND_LOSSES:        '5300',
});

module.exports = { ACCOUNTS };
```

- [ ] **Step 2: Write failing tests** — `server/tests/unit/journalTemplates.test.js`:

```js
const {
  orderPaymentEntry, subscriptionPaymentEntry, bankTransferEntry, reversalEntry,
} = require('../../services/ledger/journalTemplates');
const { ACCOUNTS } = require('../../lib/ledgerAccounts');

const sum = (lines, side) => Math.round(lines.reduce((s, l) => s + (l[side] || 0), 0) * 100) / 100;
const lineFor = (lines, code, side) => lines.find((l) => l.account_code === code && l[side] > 0);

describe('orderPaymentEntry', () => {
  // PRD §3.1 fixture: Free plan ₹1000, fee ₹10, fee GST ₹1.80,
  // commission ₹50, commission GST ₹9, razorpay 20 + 3.60
  const snapshot = {
    booking_id: 'b1', host_id: 'v1',
    service_price: 1000, platform_fee_amount: 10, platform_fee_gst: 1.8,
    commission_applied: 50, commission_gst: 9,
    razorpay_fee_actual: 20, razorpay_tax_actual: 3.6,
    vendor_amount: 917.4, customer_total: 1011.8,
  };

  test('balances and carries PRD amounts (free plan)', () => {
    const { lines, description } = orderPaymentEntry(snapshot);
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit').debit).toBe(1011.8);
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit').credit).toBe(23.6); // gateway relief
    expect(lineFor(lines, ACCOUNTS.VENDOR_PAYABLES, 'credit').credit).toBe(917.4);
    expect(lineFor(lines, ACCOUNTS.PLATFORM_FEE_REVENUE, 'credit').credit).toBe(10);
    expect(lineFor(lines, ACCOUNTS.GST_PAYABLE, 'credit').credit).toBe(10.8); // 1.80 + 9
    expect(lineFor(lines, ACCOUNTS.COMMISSION_REVENUE, 'credit').credit).toBe(50);
    expect(lineFor(lines, ACCOUNTS.RZP_CHARGES_ORDERS, 'debit').debit).toBe(23.6);
    expect(lineFor(lines, ACCOUNTS.RZP_CHARGES_ORDERS, 'credit').credit).toBe(23.6); // vendor-borne, nets 0
    expect(description).toContain('b1');
    // every line tagged for the vendor ledger
    expect(lines.every((l) => l.order_item_id === 'b1')).toBe(true);
  });

  test('paid plan omits commission lines', () => {
    const { lines } = orderPaymentEntry({ ...snapshot, commission_applied: 0, commission_gst: 0, vendor_amount: 976.4 });
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lines.find((l) => l.account_code === ACCOUNTS.COMMISSION_REVENUE)).toBeUndefined();
    expect(lineFor(lines, ACCOUNTS.VENDOR_PAYABLES, 'credit').credit).toBe(976.4);
    expect(lineFor(lines, ACCOUNTS.GST_PAYABLE, 'credit').credit).toBe(1.8);
  });

  test('zero gateway fee (fee unknown at capture) omits charge lines and stays balanced', () => {
    const { lines } = orderPaymentEntry({ ...snapshot, razorpay_fee_actual: 0, razorpay_tax_actual: 0, vendor_amount: 941 });
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lines.find((l) => l.account_code === ACCOUNTS.RZP_CHARGES_ORDERS)).toBeUndefined();
  });
});

describe('subscriptionPaymentEntry', () => {
  test('PRD §5.2/§11.3: ₹999 + GST, platform-borne gateway fee', () => {
    const { lines } = subscriptionPaymentEntry({
      id: 's1', vendor_id: 'v1', plan_price: 999, gst_amount: 179.82,
      total_charged: 1178.82, razorpay_fee: 23.58, razorpay_tax: 4.24,
    });
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit').debit).toBe(1178.82);
    expect(lineFor(lines, ACCOUNTS.SUBSCRIPTION_REVENUE, 'credit').credit).toBe(999);
    expect(lineFor(lines, ACCOUNTS.GST_PAYABLE, 'credit').credit).toBe(179.82);
    expect(lineFor(lines, ACCOUNTS.RZP_CHARGES_SUBS, 'debit').debit).toBe(27.82); // platform expense stays
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit').credit).toBe(27.82);
  });
});

describe('bankTransferEntry', () => {
  test('DR Bank / CR Receivable', () => {
    const { lines } = bankTransferEntry({ amount: 5000, reference: 'setl_x' });
    expect(lines).toHaveLength(2);
    expect(lineFor(lines, ACCOUNTS.BANK, 'debit').debit).toBe(5000);
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit').credit).toBe(5000);
  });
});

describe('reversalEntry', () => {
  test('swaps debits and credits of original lines', () => {
    const original = [
      { account_code: ACCOUNTS.BANK, debit: 100, credit: 0 },
      { account_code: ACCOUNTS.RAZORPAY_RECEIVABLE, debit: 0, credit: 100 },
    ];
    const { lines } = reversalEntry({ journal_number: 'JNL-2026-000001', lines: original });
    expect(lineFor(lines, ACCOUNTS.BANK, 'credit').credit).toBe(100);
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit').debit).toBe(100);
  });
});
```

- [ ] **Step 3: Run — expect FAIL** (module not found)

- [ ] **Step 4: Create `server/services/ledger/journalTemplates.js`**

```js
/**
 * journalTemplates.js — pure builders of balanced journal lines.
 * No DB, no side effects. Output shape consumed by postingService:
 *   { description, lines: [{ account_code, debit, credit, vendor_id?, order_item_id?, subscription_payment_id? }] }
 *
 * Order-payment template (deviation from PRD §11.1, documented in the plan):
 * gross receivable + same-entry gateway-fee relief, so Razorpay Receivable
 * always equals the net cash Razorpay will remit, gateway charges are visible
 * on the 5000 debit side, and the expense nets 0 (vendor bears the fee).
 */
'use strict';

const { ACCOUNTS } = require('../../lib/ledgerAccounts');
const { round2 } = require('../../lib/pricingEngine');

const line = (account_code, side, amount, tags = {}) => ({
  account_code,
  debit:  side === 'debit'  ? round2(amount) : 0,
  credit: side === 'credit' ? round2(amount) : 0,
  ...tags,
});

/** ORDER_PAYMENT — from the booking's immutable snapshot (v2.8 columns). */
function orderPaymentEntry(snapshot) {
  const tags = { vendor_id: snapshot.host_id, order_item_id: snapshot.booking_id };
  const gatewayTotal = round2(Number(snapshot.razorpay_fee_actual || 0) + Number(snapshot.razorpay_tax_actual || 0));
  const gstTotal = round2(Number(snapshot.platform_fee_gst || 0) + Number(snapshot.commission_gst || 0));

  const lines = [
    line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit', snapshot.customer_total, tags),
    line(ACCOUNTS.VENDOR_PAYABLES, 'credit', snapshot.vendor_amount, tags),
  ];
  if (Number(snapshot.platform_fee_amount) > 0) {
    lines.push(line(ACCOUNTS.PLATFORM_FEE_REVENUE, 'credit', snapshot.platform_fee_amount, tags));
  }
  if (gstTotal > 0) lines.push(line(ACCOUNTS.GST_PAYABLE, 'credit', gstTotal, tags));
  if (Number(snapshot.commission_applied) > 0) {
    lines.push(line(ACCOUNTS.COMMISSION_REVENUE, 'credit', snapshot.commission_applied, tags));
  }
  if (gatewayTotal > 0) {
    // Gateway deducts its fee from the remittance (relieve receivable)…
    lines.push(line(ACCOUNTS.RZP_CHARGES_ORDERS, 'debit', gatewayTotal, tags));
    lines.push(line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit', gatewayTotal, tags));
    // …and the vendor bears it (already netted out of vendor_amount).
    lines.push(line(ACCOUNTS.RZP_CHARGES_ORDERS, 'credit', gatewayTotal, tags));
  }
  return {
    description: `Order payment — booking ${snapshot.booking_id}`,
    lines,
  };
}

/** SUBSCRIPTION_PAYMENT — gateway fee is a PLATFORM expense (PRD §5.3/§11.3). */
function subscriptionPaymentEntry(payment) {
  const tags = { vendor_id: payment.vendor_id, subscription_payment_id: payment.id };
  const gatewayTotal = round2(Number(payment.razorpay_fee || 0) + Number(payment.razorpay_tax || 0));

  const lines = [
    line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit', payment.total_charged, tags),
    line(ACCOUNTS.SUBSCRIPTION_REVENUE, 'credit', payment.plan_price, tags),
  ];
  if (Number(payment.gst_amount) > 0) lines.push(line(ACCOUNTS.GST_PAYABLE, 'credit', payment.gst_amount, tags));
  if (gatewayTotal > 0) {
    lines.push(line(ACCOUNTS.RZP_CHARGES_SUBS, 'debit', gatewayTotal, tags));
    lines.push(line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit', gatewayTotal, tags));
  }
  return {
    description: `Subscription payment — ${payment.plan_type || 'plan'} by vendor ${payment.vendor_id}`,
    lines,
  };
}

/** BANK_TRANSFER — Razorpay settlement remitted to the bank (PRD §11.6). */
function bankTransferEntry({ amount, reference }) {
  return {
    description: `Razorpay → bank transfer ${reference || ''}`.trim(),
    lines: [
      line(ACCOUNTS.BANK, 'debit', amount),
      line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit', amount),
    ],
  };
}

/** ADJUSTMENT — admin-supplied balanced lines (validated again by the RPC). */
function adjustmentEntry({ description, lines }) {
  return { description: description || 'Manual adjustment', lines };
}

/** REVERSAL — mirror of an existing entry's lines. */
function reversalEntry(original) {
  return {
    description: `Reversal of ${original.journal_number}`,
    lines: original.lines.map((l) => ({
      ...l,
      debit: l.credit,
      credit: l.debit,
    })),
  };
}

module.exports = {
  orderPaymentEntry,
  subscriptionPaymentEntry,
  bankTransferEntry,
  adjustmentEntry,
  reversalEntry,
};
```

- [ ] **Step 5: Run — expect PASS**

```bash
cd server && npm test -- --runTestsByPath tests/unit/journalTemplates.test.js --silent
```

- [ ] **Step 6: Commit**

```bash
git add server/lib/ledgerAccounts.js server/services/ledger/journalTemplates.js server/tests/unit/journalTemplates.test.js
git commit -m "feat(ledger): account constants + pure journal templates (PRD fixtures as tests)"
```

---

### Task 4: postingService

**Files:**
- Create: `server/services/ledger/postingService.js`
- Test: `server/tests/unit/postingService.test.js`

- [ ] **Step 1: Write failing tests** — `server/tests/unit/postingService.test.js`:

```js
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { rpc: jest.fn() },
}));
const { supabaseAdmin } = require('../../config/supabase');
const posting = require('../../services/ledger/postingService');

beforeEach(() => jest.clearAllMocks());

describe('postingService.post', () => {
  const tpl = {
    description: 'test',
    lines: [
      { account_code: '1000', debit: 10, credit: 0 },
      { account_code: '4000', debit: 0, credit: 10 },
    ],
  };

  test('calls the RPC with the full payload and returns the entry id', async () => {
    supabaseAdmin.rpc.mockResolvedValue({ data: 'entry-uuid', error: null });
    const id = await posting.post({
      sourceType: 'ORDER_PAYMENT', sourceId: 'src-1',
      journalDate: '2026-06-13', template: tpl,
    });
    expect(id).toBe('entry-uuid');
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('post_journal_entry', {
      p: {
        source_type: 'ORDER_PAYMENT',
        source_id: 'src-1',
        journal_date: '2026-06-13',
        description: 'test',
        created_by: null,
        lines: tpl.lines,
      },
    });
  });

  test('throws a descriptive error when the RPC errors', async () => {
    supabaseAdmin.rpc.mockResolvedValue({ data: null, error: { message: 'does not balance' } });
    await expect(posting.post({ sourceType: 'ADJUSTMENT', sourceId: 'x', template: tpl }))
      .rejects.toThrow(/does not balance/);
  });

  test('postSafe never throws — returns null and logs on failure', async () => {
    supabaseAdmin.rpc.mockRejectedValue(new Error('boom'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const id = await posting.postSafe({ sourceType: 'ORDER_PAYMENT', sourceId: 'y', template: tpl });
    expect(id).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module not found)

- [ ] **Step 3: Create `server/services/ledger/postingService.js`**

```js
/**
 * postingService.js — the ONLY JS write path into the ledger.
 * Wraps the atomic Postgres RPC post_journal_entry(jsonb).
 * Idempotency lives in the DB (UNIQUE (source_type, source_id)) — calling
 * post twice for the same event returns the same entry id, posts nothing new.
 */
'use strict';

const { supabaseAdmin } = require('../../config/supabase');

/**
 * @param {object} args
 * @param {string} args.sourceType  ORDER_PAYMENT | SUBSCRIPTION_PAYMENT | BANK_TRANSFER | ADJUSTMENT | REVERSAL | BACKFILL | BACKFILL_SETTLEMENT | SETTLEMENT | REFUND
 * @param {string} args.sourceId    uuid of the source record (booking, subscription payment, …)
 * @param {object} args.template    { description, lines } from journalTemplates
 * @param {string} [args.journalDate] ISO date (defaults to today in the DB)
 * @param {string} [args.createdBy]   admin_users.id for manual entries
 * @returns {Promise<string>} journal entry uuid
 */
async function post({ sourceType, sourceId, template, journalDate = null, createdBy = null }) {
  const { data, error } = await supabaseAdmin.rpc('post_journal_entry', {
    p: {
      source_type: sourceType,
      source_id: sourceId,
      journal_date: journalDate,
      description: template.description,
      created_by: createdBy,
      lines: template.lines,
    },
  });
  if (error) throw new Error(`ledger posting failed (${sourceType}/${sourceId}): ${error.message}`);
  return data;
}

/**
 * Non-throwing variant for payment paths: a captured payment must never fail
 * because the ledger write failed. The reconciler cron self-heals misses.
 */
async function postSafe(args) {
  try {
    return await post(args);
  } catch (err) {
    console.error('LEDGER POSTING MISSED (reconciler will retry):', err.message);
    return null;
  }
}

module.exports = { post, postSafe };
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add server/services/ledger/postingService.js server/tests/unit/postingService.test.js
git commit -m "feat(ledger): postingService — single RPC write path with safe variant"
```

---

### Task 5: Booking snapshot v3 (creation)

**Files:**
- Modify: `server/controllers/bookingController.js` (~lines 209–320)

- [ ] **Step 1: Extend the snapshot payload.** In `createBooking`, the pricing block already computes `pricing = computeBreakdown(...)` (which now returns `commissionGst` after Task 2). Update the `bookingPayload` object — after the line `commission_applied:  commission,` add:

```js
      commission_gst:        pricing.commissionGst,   // v2.8: 18% GST on commission, vendor-borne
      commission_percentage: commissionPct,           // v2.8 snapshot
      vendor_plan_type:      effectivePlanSlug,       // v2.8 snapshot
```

(`commissionPct` and `effectivePlanSlug` are already in scope at that point.)

- [ ] **Step 2: Extend the legacy-schema fallback.** In the destructuring drop list a few lines below, add the three new fields so pre-v2.8 DBs still work:

```js
      const {
        commission_applied: _c, platform_fee_gst: _g, customer_total: _t,
        gst_rate: _r, razorpay_fee_actual: _f, end_at: _e,
        commission_gst: _cg, commission_percentage: _cp, vendor_plan_type: _vp,
        ...payloadCore
      } = bookingPayload;
```

- [ ] **Step 3: Note** — `vendor_amount: vendorPayout` already uses `pricing.vendorPayout`, which now subtracts commission GST automatically. No other change.

- [ ] **Step 4: Run full server suite — expect PASS** (and fix any booking test fixtures that assert the old payout for commission>0 cases)

```bash
cd server && npm test --silent
```

- [ ] **Step 5: Commit**

```bash
git add server/controllers/bookingController.js server/tests
git commit -m "feat(booking): snapshot v3 — commission GST, commission %, vendor plan type"
```

---

### Task 6: verifyPayment — fee/tax split, paid_at, ORDER_PAYMENT posting

**Files:**
- Modify: `server/controllers/paymentController.js` (`verifyPayment`, lines ~137–292)

- [ ] **Step 1: Widen the booking select.** Replace the select in `verifyPayment`:

```js
      .select("razorpay_order_id, payment_status, commission_applied, commission_gst, platform_fee_amount, platform_fee_gst, customer_total, meeting_link, scheduled_at, guest_name, guest_email, notes, host_id, service_id, services(price, title, duration, meeting_mode)")
```

- [ ] **Step 2: Split fee and tax.** Replace the fee-fetch block (lines ~159–170):

```js
    // Record the ACTUAL Razorpay fee + tax (vendor-borne) and finalise the payout.
    // Razorpay's `fee` (paise) INCLUDES `tax`; we store them split (PRD §19).
    let razorpayFeeTotal = 0, razorpayTax = 0;
    try {
      const payment = await razorpay.payments.fetch(razorpay_payment_id);
      if (payment && payment.fee != null) razorpayFeeTotal = Number(payment.fee) / 100;
      if (payment && payment.tax != null) razorpayTax = Number(payment.tax) / 100;
    } catch (feeErr) {
      console.error("Razorpay fee fetch failed (payout uses 0 until reconciled):", feeErr.message);
    }
    const razorpayFeeExclTax = Math.max(0, Math.round((razorpayFeeTotal - razorpayTax) * 100) / 100);
    const servicePrice  = booking.services?.price || 0;
    const commission    = Number(booking.commission_applied) || 0;
    const commissionGst = Number(booking.commission_gst) || 0;
    const finalPayout   = calculateVendorPayout(servicePrice, commission, commissionGst, razorpayFeeTotal);
```

- [ ] **Step 3: Extend the update payload.** Replace `fullUpdate`:

```js
    const paidAt = new Date().toISOString();
    const fullUpdate = {
      payment_status: "paid", status: "confirmed", razorpay_payment_id,
      razorpay_fee_actual: razorpayFeeExclTax, razorpay_tax_actual: razorpayTax,
      vendor_amount: finalPayout, paid_at: paidAt,
      updated_at: paidAt,
    };
```

And extend the legacy fallback drop:

```js
      const { razorpay_fee_actual: _drop, razorpay_tax_actual: _drop2, paid_at: _drop3, ...coreUpdate } = fullUpdate;
```

- [ ] **Step 4: Post the journal entry.** Immediately after the `if (error) return res.status(500)...` line (payment is now recorded), insert:

```js
    // ── Ledger: post ORDER_PAYMENT (non-fatal — reconciler self-heals) ──
    try {
      const { orderPaymentEntry } = require("../services/ledger/journalTemplates");
      const { postSafe } = require("../services/ledger/postingService");
      await postSafe({
        sourceType: "ORDER_PAYMENT",
        sourceId: booking_id,
        journalDate: paidAt.slice(0, 10),
        template: orderPaymentEntry({
          booking_id,
          host_id: booking.host_id,
          service_price: servicePrice,
          platform_fee_amount: Number(booking.platform_fee_amount) || 0,
          platform_fee_gst: Number(booking.platform_fee_gst) || 0,
          commission_applied: commission,
          commission_gst: commissionGst,
          razorpay_fee_actual: razorpayFeeExclTax,
          razorpay_tax_actual: razorpayTax,
          vendor_amount: finalPayout,
          customer_total: Number(booking.customer_total) || 0,
        }),
      });
    } catch (ledgerErr) {
      console.error("Order ledger posting error (non-fatal):", ledgerErr.message);
    }
```

- [ ] **Step 5: Fix the import** at the top of the file — `calculateVendorPayout` call sites now use the v3 4-arg signature (done in Step 2); `calculatePlatformFee` is used by product flows and must be added to the destructured import if not already present:

```js
const { computeBreakdown, computeSubscriptionBreakdown, calculateVendorPayout, calculatePlatformFee } = require("../lib/pricingEngine");
```

(Check current import line 8 — it lacks `calculatePlatformFee` yet `createProductOrder` calls it; if so this was a latent bug. Include it now.)

- [ ] **Step 6: Run full server suite — expect PASS**

- [ ] **Step 7: Commit**

```bash
git add server/controllers/paymentController.js
git commit -m "feat(payment): fee/tax split, paid_at stamp, ORDER_PAYMENT ledger posting"
```

---

### Task 7: completeBooking — recognition + settlement stamps

**Files:**
- Modify: `server/controllers/bookingController.js` (`completeBooking`, ~line 500)

- [ ] **Step 1: Replace the status update** in `completeBooking`:

```js
    const nowIso = new Date().toISOString();
    const completionUpdate = {
      status: "completed",
      completed_at: nowIso,
      revenue_recognized_at: nowIso,            // PRD Rule 2: commission recognised at completion
      revenue_recognition_status: "recognized",
      settlement_status: "eligible_for_settlement",
      updated_at: nowIso,
    };
    let { data, error } = await supabaseAdmin
      .from("bookings")
      .update(completionUpdate)
      .eq("id", req.params.id)
      .select()
      .single();

    // Legacy DB without v2.8 columns: retry with the original minimal update
    if (error && /Could not find the|column.*does not exist/i.test(error.message)) {
      ({ data, error } = await supabaseAdmin
        .from("bookings")
        .update({ status: "completed", updated_at: nowIso })
        .eq("id", req.params.id)
        .select()
        .single());
    }
    if (error) return res.status(500).json({ message: error.message });
```

No journal entry here — commission revenue was credited at payment; recognition is a date/status stamp (spec §6).

- [ ] **Step 2: Run server suite — expect PASS. Commit**

```bash
git add server/controllers/bookingController.js
git commit -m "feat(booking): completion stamps — revenue recognition + settlement eligibility"
```

---

### Task 8: Subscription GST + subscription_payments + posting

**Files:**
- Modify: `server/controllers/paymentController.js` (`subscribePlan`, `verifySubscription`)

- [ ] **Step 1: Charge GST on top in `subscribePlan`.** Replace the function body:

```js
const subscribePlan = async (req, res) => {
  try {
    const { plan } = req.body;
    const planRecord = await planService.getPlan(plan);
    if (!planRecord || planRecord.slug !== planService.normalizeSlug(plan) || !(Number(planRecord.annual_price) > 0)) {
      return res.status(400).json({ message: "Invalid or free plan — nothing to purchase." });
    }
    // GST is charged ON TOP of the plan price (PRD §5.2) — never embedded.
    const { gstRate } = await platformConfig.getConfig();
    const breakdown = computeSubscriptionBreakdown({ planPrice: Number(planRecord.annual_price), gstRate });
    const amountPaise = Math.round(breakdown.totalCharged * 100);
    const order = await razorpay.orders.create({
      amount: amountPaise, currency: "INR",
      receipt: `plan_${plan}_${req.user.id.slice(0, 10)}`,
      notes: { vendor_id: req.user.id, plan, plan_price: breakdown.planPrice, gst: breakdown.gstAmount },
    });
    auditLog('SUBSCRIPTION_ORDER_CREATED', req.user.id, { plan, amount: amountPaise });
    res.json({
      razorpay_order_id: order.id, amount: order.amount, currency: order.currency, plan,
      plan_price: breakdown.planPrice, gst_amount: breakdown.gstAmount, total: breakdown.totalCharged,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```

(The old `getPlanPricePaise` helper stays — `verifySubscription`'s legacy `plan_purchases` insert still uses it.)

- [ ] **Step 2: Record + post in `verifySubscription`.** After the existing `plan_purchases` insert and before the `auditLog('SUBSCRIPTION_ACTIVATED', ...)` line, insert:

```js
    // ── v2.8: subscription payment record + SUBSCRIPTION_PAYMENT ledger entry ──
    try {
      const planRecord2 = await planService.getPlan(plan);
      const { gstRate } = await platformConfig.getConfig();
      const breakdown = computeSubscriptionBreakdown({ planPrice: Number(planRecord2?.annual_price) || 0, gstRate });

      // Actual gateway fee+tax — PLATFORM-borne for subscriptions (PRD §5.3)
      let subFeeTotal = 0, subTax = 0;
      try {
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        if (payment && payment.fee != null) subFeeTotal = Number(payment.fee) / 100;
        if (payment && payment.tax != null) subTax = Number(payment.tax) / 100;
      } catch (feeErr) {
        console.error("Subscription fee fetch failed (recorded 0):", feeErr.message);
      }
      const subFeeExclTax = Math.max(0, Math.round((subFeeTotal - subTax) * 100) / 100);

      const nowIso = new Date().toISOString();
      const { data: subPayment, error: subErr } = await supabaseAdmin
        .from("subscription_payments").insert({
          vendor_id: req.user.id, plan_type: plan,
          plan_price: breakdown.planPrice, gst_amount: breakdown.gstAmount, total_charged: breakdown.totalCharged,
          razorpay_fee: subFeeExclTax, razorpay_tax: subTax,
          razorpay_payment_id, razorpay_order_id,
          paid_at: nowIso, revenue_recognized_at: nowIso,
          billing_period_start: nowIso.slice(0, 10),
          billing_period_end: expiresAt.toISOString().slice(0, 10),
          status: "paid",
        }).select().single();

      if (subErr) {
        console.error("subscription_payments insert failed (reconciler cannot heal this — investigate):", subErr.message);
      } else {
        const { subscriptionPaymentEntry } = require("../services/ledger/journalTemplates");
        const { postSafe } = require("../services/ledger/postingService");
        await postSafe({
          sourceType: "SUBSCRIPTION_PAYMENT",
          sourceId: subPayment.id,
          journalDate: nowIso.slice(0, 10),
          template: subscriptionPaymentEntry(subPayment),
        });
      }
    } catch (subLedgerErr) {
      console.error("Subscription ledger error (non-fatal):", subLedgerErr.message);
    }
```

- [ ] **Step 3: Run server suite — expect PASS. Commit**

```bash
git add server/controllers/paymentController.js
git commit -m "feat(subscription): GST charged on top + subscription_payments record + ledger posting"
```

---

### Task 9: UpgradePlan.jsx — GST display

**Files:**
- Modify: `client/src/pages/UpgradePlan.jsx`

- [ ] **Step 1:** Under the price render (~line 216, `₹{plan.price.toLocaleString("en-IN")}`), the paid-plan card shows the annual price. Add a GST note line directly below the price element:

```jsx
{plan.price > 0 && (
  <p className="text-[11px] text-gray-400 mt-0.5">
    + 18% GST (₹{Math.round(plan.price * 0.18 * 100) / 100} — total ₹{(Math.round(plan.price * 1.18 * 100) / 100).toLocaleString("en-IN")})
  </p>
)}
```

The Razorpay modal already charges `order.amount` from the server (which now includes GST), so no checkout logic changes.

- [ ] **Step 2:** Run client tests + build:

```bash
cd client && npm test -- run && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/UpgradePlan.jsx
git commit -m "feat(plans): show 18% GST line on paid plan cards"
```

---

### Task 10: ledgerReconciler cron (self-heal)

**Files:**
- Create: `server/services/ledger/ledgerReconciler.js`
- Modify: `server/server.js`
- Test: `server/tests/unit/ledgerReconciler.test.js`

- [ ] **Step 1: Write failing test** — `server/tests/unit/ledgerReconciler.test.js`:

```js
jest.mock('../../config/supabase', () => {
  const chain = () => {
    const c = {};
    for (const m of ['select', 'eq', 'gt', 'is', 'in', 'not', 'limit', 'order']) {
      c[m] = jest.fn(() => c);
    }
    c.then = undefined; // resolved manually per test via mockResolvedValue on terminal calls
    return c;
  };
  return { supabaseAdmin: { from: jest.fn(() => chain()), rpc: jest.fn() }, __chain: chain };
});
jest.mock('../../services/ledger/postingService', () => ({ postSafe: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const { postSafe } = require('../../services/ledger/postingService');
const reconciler = require('../../services/ledger/ledgerReconciler');

beforeEach(() => jest.clearAllMocks());

test('reposts paid bookings that have no journal entry', async () => {
  // 1st from('journal_entries') → existing source ids; 2nd from('bookings') → paid rows
  const journalChain = { select: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }) };
  const bookingsChain = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({
      data: [{
        id: 'b1', host_id: 'v1', paid_at: '2026-06-13T00:00:00Z',
        customer_total: 1011.8, vendor_amount: 917.4, platform_fee_amount: 10,
        platform_fee_gst: 1.8, commission_applied: 50, commission_gst: 9,
        razorpay_fee_actual: 20, razorpay_tax_actual: 3.6,
        services: { price: 1000 },
      }],
      error: null,
    }),
  };
  supabaseAdmin.from
    .mockImplementationOnce(() => bookingsChain)   // bookings scan
    .mockImplementationOnce(() => journalChain);   // journal existence check

  const result = await reconciler.reconcile();
  expect(postSafe).toHaveBeenCalledTimes(1);
  expect(postSafe.mock.calls[0][0].sourceType).toBe('ORDER_PAYMENT');
  expect(postSafe.mock.calls[0][0].sourceId).toBe('b1');
  expect(result.reposted).toBe(1);
});
```

- [ ] **Step 2: Run — expect FAIL.** Then create `server/services/ledger/ledgerReconciler.js`:

```js
/**
 * ledgerReconciler.js — self-heal cron. Finds paid bookings and subscription
 * payments that have NO journal entry (posting failed at capture time) and
 * reposts them. Safe to run repeatedly: posting is idempotent on
 * (source_type, source_id). Scans a bounded recent window each run.
 */
'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { orderPaymentEntry, subscriptionPaymentEntry } = require('./journalTemplates');
const { postSafe } = require('./postingService');

const SCAN_LIMIT = 200;

async function missingSourceIds(sourceType, ids) {
  if (!ids.length) return new Set();
  const { data, error } = await supabaseAdmin
    .from('journal_entries')
    .select('source_id')
    .in('source_id', ids)
    .eq('source_type', sourceType);
  if (error) throw new Error(`reconciler journal lookup failed: ${error.message}`);
  const posted = new Set((data || []).map((r) => r.source_id));
  return new Set(ids.filter((id) => !posted.has(id)));
}

async function reconcile() {
  let reposted = 0;

  // ── Paid bookings without an ORDER_PAYMENT entry ──
  const { data: bookings, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select('id, host_id, paid_at, customer_total, vendor_amount, platform_fee_amount, platform_fee_gst, commission_applied, commission_gst, razorpay_fee_actual, razorpay_tax_actual, services(price)')
    .eq('payment_status', 'paid')
    .gt('customer_total', 0)
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(SCAN_LIMIT);
  if (bErr) throw new Error(`reconciler booking scan failed: ${bErr.message}`);

  const missingBookings = await missingSourceIds('ORDER_PAYMENT', (bookings || []).map((b) => b.id));
  for (const b of bookings || []) {
    if (!missingBookings.has(b.id)) continue;
    const id = await postSafe({
      sourceType: 'ORDER_PAYMENT',
      sourceId: b.id,
      journalDate: (b.paid_at || '').slice(0, 10) || null,
      template: orderPaymentEntry({
        booking_id: b.id, host_id: b.host_id,
        service_price: b.services?.price || 0,
        platform_fee_amount: b.platform_fee_amount, platform_fee_gst: b.platform_fee_gst,
        commission_applied: b.commission_applied, commission_gst: b.commission_gst,
        razorpay_fee_actual: b.razorpay_fee_actual, razorpay_tax_actual: b.razorpay_tax_actual,
        vendor_amount: b.vendor_amount, customer_total: b.customer_total,
      }),
    });
    if (id) reposted += 1;
  }

  // ── Subscription payments without a SUBSCRIPTION_PAYMENT entry ──
  const { data: subs, error: sErr } = await supabaseAdmin
    .from('subscription_payments')
    .select('*')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(SCAN_LIMIT);
  if (sErr) throw new Error(`reconciler subscription scan failed: ${sErr.message}`);

  const missingSubs = await missingSourceIds('SUBSCRIPTION_PAYMENT', (subs || []).map((s) => s.id));
  for (const s of subs || []) {
    if (!missingSubs.has(s.id)) continue;
    const id = await postSafe({
      sourceType: 'SUBSCRIPTION_PAYMENT',
      sourceId: s.id,
      journalDate: (s.paid_at || '').slice(0, 10) || null,
      template: subscriptionPaymentEntry(s),
    });
    if (id) reposted += 1;
  }

  return { reposted };
}

module.exports = { reconcile };
```

**Note for the test:** the bookings scan runs BEFORE the journal lookup, so `supabaseAdmin.from` is called with `bookings` first, then `journal_entries`, then `subscription_payments`, then `journal_entries` again. The test above mocks the first two calls; extend `mockImplementationOnce` twice more with an empty subs chain (`limit` resolving `{ data: [], error: null }`) so the subscription pass is a no-op. Adjust until green — the assertion that matters is `postSafe` called once with ORDER_PAYMENT/b1.

- [ ] **Step 3: Wire the cron in `server/server.js`.** After the badge engine interval block, add:

```js
// Ledger reconciler — self-heals missed journal postings (hourly, idempotent)
const ledgerReconciler = require('./services/ledger/ledgerReconciler');
const LEDGER_RECONCILE_MIN = Number(process.env.LEDGER_RECONCILE_INTERVAL_MIN || 60);
setInterval(async () => {
  try {
    const r = await ledgerReconciler.reconcile();
    if (r.reposted > 0) console.log(`Ledger reconciler: reposted ${r.reposted} missed entries`);
  } catch (err) { console.error('Ledger reconciler cron error:', err.message); }
}, LEDGER_RECONCILE_MIN * 60 * 1000);
```

- [ ] **Step 4: Run tests — expect PASS. Commit**

```bash
git add server/services/ledger/ledgerReconciler.js server/tests/unit/ledgerReconciler.test.js server/server.js
git commit -m "feat(ledger): hourly self-heal reconciler for missed postings"
```

---

### Task 11: Backfill script

**Files:**
- Create: `server/scripts/backfillLedger.js`

- [ ] **Step 1: Create the script** (run manually once after deploy; `--dry-run` first):

```js
/**
 * backfillLedger.js — one-time idempotent replay of pre-ledger history.
 * Usage:  node scripts/backfillLedger.js --dry-run   (print plan, write nothing)
 *         node scripts/backfillLedger.js              (post BACKFILL entries)
 *
 * Truthful-history rule: amounts come from each booking's ORIGINAL v2.2
 * snapshot (no commission GST — it did not exist then). Old subscription
 * purchases post with gst_amount 0 (none was charged).
 * Idempotent: posting dedupes on (source_type, source_id); re-runs are no-ops.
 */
'use strict';
require('dotenv').config();

const { supabaseAdmin } = require('../config/supabase');
const { orderPaymentEntry, subscriptionPaymentEntry } = require('../services/ledger/journalTemplates');
const { post } = require('../services/ledger/postingService');
const { ACCOUNTS } = require('../lib/ledgerAccounts');

const DRY = process.argv.includes('--dry-run');

async function run() {
  let planned = 0, posted = 0;

  // ── 1. Historical paid bookings (original snapshots; source BACKFILL) ──
  const { data: bookings, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select('id, host_id, paid_at, created_at, updated_at, customer_total, vendor_amount, platform_fee_amount, platform_fee_gst, commission_applied, commission_gst, razorpay_fee_actual, razorpay_tax_actual, services(price)')
    .eq('payment_status', 'paid')
    .gt('customer_total', 0)
    .order('created_at', { ascending: true });
  if (bErr) throw bErr;

  for (const b of bookings || []) {
    const journalDate = (b.paid_at || b.updated_at || b.created_at || '').slice(0, 10) || null;
    planned += 1;
    console.log(`[booking ${b.id}] ${journalDate} customer_total=${b.customer_total} vendor=${b.vendor_amount}`);
    if (DRY) continue;
    await post({
      sourceType: 'BACKFILL', sourceId: b.id, journalDate,
      template: orderPaymentEntry({
        booking_id: b.id, host_id: b.host_id,
        service_price: b.services?.price || 0,
        platform_fee_amount: b.platform_fee_amount, platform_fee_gst: b.platform_fee_gst,
        commission_applied: b.commission_applied, commission_gst: b.commission_gst || 0,
        razorpay_fee_actual: b.razorpay_fee_actual, razorpay_tax_actual: b.razorpay_tax_actual || 0,
        vendor_amount: b.vendor_amount, customer_total: b.customer_total,
      }),
    });
    posted += 1;
  }

  // ── 2. Historical plan purchases (amount_paid stored in PAISE) ──
  const { data: purchases, error: pErr } = await supabaseAdmin
    .from('plan_purchases')
    .select('id, vendor_id, plan, amount_paid, activated_at, expires_at, razorpay_payment_id, razorpay_order_id')
    .order('activated_at', { ascending: true });
  if (pErr) throw pErr;

  for (const p of purchases || []) {
    const planPrice = Math.round(Number(p.amount_paid || 0)) / 100; // paise → ₹
    if (!(planPrice > 0)) continue;
    const journalDate = (p.activated_at || '').slice(0, 10) || null;
    planned += 1;
    console.log(`[plan_purchase ${p.id}] ${journalDate} ${p.plan} ₹${planPrice}`);
    if (DRY) continue;

    // Retroactive subscription_payments row (gst 0 — none was charged then)
    let subRow;
    const { data: existing } = await supabaseAdmin
      .from('subscription_payments').select('*').eq('razorpay_payment_id', p.razorpay_payment_id).maybeSingle();
    if (existing) {
      subRow = existing;
    } else {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from('subscription_payments').insert({
          vendor_id: p.vendor_id, plan_type: p.plan,
          plan_price: planPrice, gst_amount: 0, total_charged: planPrice,
          razorpay_fee: 0, razorpay_tax: 0,
          razorpay_payment_id: p.razorpay_payment_id, razorpay_order_id: p.razorpay_order_id,
          paid_at: p.activated_at, revenue_recognized_at: p.activated_at,
          billing_period_start: (p.activated_at || '').slice(0, 10) || null,
          billing_period_end: (p.expires_at || '').slice(0, 10) || null,
          status: 'paid',
        }).select().single();
      if (insErr) throw insErr;
      subRow = inserted;
    }

    await post({
      sourceType: 'BACKFILL', sourceId: subRow.id, journalDate,
      template: subscriptionPaymentEntry(subRow),
    });
    posted += 1;
  }

  // ── 3. Already-executed payouts → relieve Vendor Payables ──
  const { data: payouts, error: poErr } = await supabaseAdmin
    .from('payout_requests')
    .select('id, host_id, amount, status, created_at, updated_at')
    .in('status', ['approved', 'paid', 'completed'])
    .order('created_at', { ascending: true });
  if (poErr) throw poErr;

  for (const po of payouts || []) {
    const amount = Number(po.amount) || 0;
    if (!(amount > 0)) continue;
    const journalDate = (po.updated_at || po.created_at || '').slice(0, 10) || null;
    planned += 1;
    console.log(`[payout ${po.id}] ${journalDate} vendor=${po.host_id} ₹${amount}`);
    if (DRY) continue;
    await post({
      sourceType: 'BACKFILL_SETTLEMENT', sourceId: po.id, journalDate,
      template: {
        description: `Backfill: historical payout ${po.id}`,
        lines: [
          { account_code: ACCOUNTS.VENDOR_PAYABLES, debit: amount, credit: 0, vendor_id: po.host_id },
          { account_code: ACCOUNTS.BANK, debit: 0, credit: amount, vendor_id: po.host_id },
        ],
      },
    });
    posted += 1;
  }

  console.log(`\n${DRY ? 'DRY RUN — ' : ''}planned ${planned} entries${DRY ? '' : `, posted ${posted}`}.`);
  if (!DRY) {
    const { data: balances } = await supabaseAdmin
      .from('account_balances').select('balance, chart_of_accounts(code, name)');
    console.log('\nClosing balances:');
    for (const row of balances || []) {
      console.log(`  ${row.chart_of_accounts.code} ${row.chart_of_accounts.name}: ₹${row.balance}`);
    }
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error('Backfill failed:', e.message); process.exit(1); });
```

**Note:** `payout_requests` column names (`host_id`, `amount`, `status` values) must be verified against the live table before the run (`SELECT * FROM payout_requests LIMIT 3` via MCP) — adjust the select/status filter if they differ.

- [ ] **Step 2: Dry-run, then execute** (post-deploy step — record output):

```bash
cd server && node scripts/backfillLedger.js --dry-run
cd server && node scripts/backfillLedger.js
```

Sanity: dashboard `Available Business Cash`/revenue figures should match the known live numbers (admin getStats showed ₹2 platform revenue scale — tiny dataset, eyeball-checkable).

- [ ] **Step 3: Commit**

```bash
git add server/scripts/backfillLedger.js
git commit -m "feat(ledger): idempotent history backfill script (bookings, plans, payouts)"
```

---

### Task 12: `finance.manage` perm + finance admin API (reads)

**Files:**
- Modify: `server/lib/adminPermissions.js`
- Create: `server/controllers/financeAdminController.js`
- Modify: `server/routes/adminRoutes.js`
- Test: `server/tests/unit/financeAdminController.test.js`

- [ ] **Step 1: Add the permission.** In `adminPermissions.js` PERMISSIONS array, change the Finance group:

```js
  // Finance
  'finance.view', 'finance.refund', 'finance.manage',
```

And add `'finance.manage'` to the `finance` role's permissions array (after `'finance.refund'`). Super has wildcard. **Also append `finance.manage` to the live `admin_roles` row** for finance via MCP after merge:

```sql
UPDATE admin_roles SET permissions = permissions || '["finance.manage"]'::jsonb
 WHERE key = 'finance' AND NOT permissions ? 'finance.manage';
```

(Verify the column type first — if `permissions` is `text[]` not jsonb, use `array_append`.)

- [ ] **Step 2: Write failing tests** — `server/tests/unit/financeAdminController.test.js`:

```js
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));
const { supabaseAdmin } = require('../../config/supabase');
const ctrl = require('../../controllers/financeAdminController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

// Minimal chainable supabase mock: every method returns the chain; await
// resolves to the configured payload.
const chain = (payload) => {
  const c = {};
  const handler = { get: (_, prop) => (prop === 'then'
    ? (resolve) => resolve(payload)
    : jest.fn(() => new Proxy(c, handler))) };
  return new Proxy(c, handler);
};

beforeEach(() => jest.clearAllMocks());

test('getSummary returns balances keyed by account code', async () => {
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'account_balances') {
      return chain({ data: [
        { balance: 988.2, chart_of_accounts: { code: '1100', name: 'Razorpay Receivable', type: 'ASSET' } },
        { balance: 917.4, chart_of_accounts: { code: '2000', name: 'Vendor Payables', type: 'LIABILITY' } },
      ], error: null });
    }
    return chain({ data: [], error: null, count: 0 });
  });
  const res = mockRes();
  await ctrl.getSummary({ query: {} }, res);
  const body = res.json.mock.calls[0][0];
  expect(body.balances['2000'].balance).toBe(917.4);
  expect(body.metrics).toBeDefined();
});

test('postAdjustment rejects unbalanced lines with 400', async () => {
  const res = mockRes();
  await ctrl.postAdjustment({
    admin: { id: 'a1' },
    body: { description: 'x', lines: [
      { account_code: '1000', debit: 10, credit: 0 },
      { account_code: '4000', debit: 0, credit: 9 },
    ] },
  }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('postBankTransfer requires a positive amount', async () => {
  const res = mockRes();
  await ctrl.postBankTransfer({ admin: { id: 'a1' }, body: { amount: 0 } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});
```

- [ ] **Step 3: Run — expect FAIL.** Create `server/controllers/financeAdminController.js`:

```js
/**
 * financeAdminController.js — P1 ledger admin API.
 * Reads: summary metrics, chart of accounts, journal browser, per-account ledger.
 * Writes: manual journal entries ONLY (adjustment / reversal / bank transfer)
 * via postingService → RPC. No direct table writes, ever (immutability).
 */
'use strict';

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { audit } = require('../services/auditService');
const { adjustmentEntry, reversalEntry, bankTransferEntry } = require('../services/ledger/journalTemplates');
const { post } = require('../services/ledger/postingService');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const PAGE_LIMIT = 25;

// ── GET /admin/finance/summary ────────────────────────────────
const getSummary = async (req, res) => {
  try {
    const { data: balanceRows, error } = await supabaseAdmin
      .from('account_balances')
      .select('balance, chart_of_accounts(code, name, type)');
    if (error) return res.status(500).json({ message: error.message });

    const balances = {};
    for (const row of balanceRows || []) {
      const acct = row.chart_of_accounts;
      if (acct) balances[acct.code] = { name: acct.name, type: acct.type, balance: Number(row.balance) };
    }
    const bal = (code) => balances[code]?.balance || 0;

    // Charge + collection metrics from indexed snapshot sums (PRD §23/§27)
    const { data: orderAgg } = await supabaseAdmin
      .from('bookings')
      .select('customer_total.sum(), razorpay_fee_actual.sum(), razorpay_tax_actual.sum()')
      .eq('payment_status', 'paid');
    const { data: subAgg } = await supabaseAdmin
      .from('subscription_payments')
      .select('total_charged.sum(), razorpay_fee.sum(), razorpay_tax.sum()')
      .eq('status', 'paid');
    const o = (orderAgg && orderAgg[0]) || {};
    const s = (subAgg && subAgg[0]) || {};

    const rzpOrders = round2((o.sum || 0) * 0 + Number(o['sum_2'] || o.razorpay_fee_actual_sum || 0) + Number(o['sum_3'] || o.razorpay_tax_actual_sum || 0));
    // NOTE: PostgREST aggregate alias naming varies by version — during
    // implementation, log the raw `orderAgg` once and fix the key names above
    // to whatever the live response uses, then delete this note.

    const netRevenue = round2(
      bal('4000') + bal('4100') + bal('4200')
      - 0 /* order gateway charges are vendor-borne: account 5000 nets 0 */
      - bal('5100') - bal('5200') - bal('5300'),
    );
    const availableCash = round2(bal('1000') - bal('2000') - bal('2100'));

    res.json({
      balances,
      metrics: {
        gross_collections: round2(Number(o.customer_total_sum || o.sum || 0) + Number(s.total_charged_sum || 0)),
        outstanding_vendor_payables: bal('2000'),
        platform_fee_revenue: bal('4000'),
        commission_revenue: bal('4100'),
        subscription_revenue: bal('4200'),
        gst_liability: bal('2100'),
        razorpay_charges_orders: rzpOrders,
        razorpay_charges_subscriptions: round2(Number(s.razorpay_fee_sum || 0) + Number(s.razorpay_tax_sum || 0)),
        net_revenue: netRevenue,
        available_business_cash: availableCash,
        razorpay_receivable: bal('1100'),
        bank_balance: bal('1000'),
      },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── GET /admin/finance/accounts ───────────────────────────────
const getAccounts = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('id, code, name, type, active, account_balances(balance)')
      .order('code');
    if (error) return res.status(500).json({ message: error.message });
    res.json({ accounts: data || [] });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── GET /admin/finance/journals ───────────────────────────────
const listJournals = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    let q = supabaseAdmin
      .from('journal_entries')
      .select('id, journal_number, journal_date, source_type, source_id, description, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT - 1);
    if (req.query.source_type) q = q.eq('source_type', req.query.source_type);
    if (req.query.from) q = q.gte('journal_date', req.query.from);
    if (req.query.to) q = q.lte('journal_date', req.query.to);
    const { data, error, count } = await q;
    if (error) return res.status(500).json({ message: error.message });
    res.json({ journals: data || [], total: count || 0, page, limit: PAGE_LIMIT });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── GET /admin/finance/journals/:id ───────────────────────────
const getJournal = async (req, res) => {
  try {
    const { data: entry, error } = await supabaseAdmin
      .from('journal_entries').select('*').eq('id', req.params.id).single();
    if (error || !entry) return res.status(404).json({ message: 'Journal entry not found' });
    const { data: lines } = await supabaseAdmin
      .from('journal_lines')
      .select('id, debit, credit, vendor_id, order_item_id, subscription_payment_id, chart_of_accounts(code, name, type)')
      .eq('journal_entry_id', entry.id)
      .order('created_at');
    res.json({ entry, lines: lines || [] });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── GET /admin/finance/ledger/:accountId ──────────────────────
const getLedger = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const { data, error, count } = await supabaseAdmin
      .from('ledger_entries')
      .select('id, created_at, ledger_type, debit, credit, balance_after_account, vendor_id, order_item_id, journal_entries(journal_number, description, source_type)', { count: 'exact' })
      .eq('account_id', req.params.accountId)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT - 1);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ entries: data || [], total: count || 0, page, limit: PAGE_LIMIT });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── Manual entry validation ───────────────────────────────────
const validateLines = (lines) => {
  if (!Array.isArray(lines) || lines.length < 2) return 'At least 2 lines required';
  let d = 0, c = 0;
  for (const l of lines) {
    const debit = Number(l.debit) || 0, credit = Number(l.credit) || 0;
    if (debit < 0 || credit < 0) return 'Amounts cannot be negative';
    if ((debit > 0) === (credit > 0)) return 'Each line needs exactly one of debit/credit';
    if (!l.account_code) return 'Each line needs an account_code';
    d += debit; c += credit;
  }
  if (round2(d) !== round2(c)) return `Lines do not balance (debits ₹${round2(d)} vs credits ₹${round2(c)})`;
  return null;
};

// ── POST /admin/finance/adjustment ────────────────────────────
const postAdjustment = async (req, res) => {
  try {
    const { description, lines } = req.body || {};
    const invalid = validateLines(lines);
    if (invalid) return res.status(400).json({ message: invalid });
    const sourceId = crypto.randomUUID();
    const entryId = await post({
      sourceType: 'ADJUSTMENT', sourceId, createdBy: req.admin?.id || null,
      template: adjustmentEntry({ description, lines }),
    });
    await audit(req, 'FINANCE_ADJUSTMENT_POSTED', 'journal_entry', entryId, { description });
    res.json({ id: entryId });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── POST /admin/finance/reversal ──────────────────────────────
const postReversal = async (req, res) => {
  try {
    const { journal_entry_id } = req.body || {};
    if (!journal_entry_id) return res.status(400).json({ message: 'journal_entry_id is required' });
    const { data: entry } = await supabaseAdmin
      .from('journal_entries').select('id, journal_number').eq('id', journal_entry_id).single();
    if (!entry) return res.status(404).json({ message: 'Journal entry not found' });
    const { data: lines } = await supabaseAdmin
      .from('journal_lines')
      .select('debit, credit, vendor_id, order_item_id, subscription_payment_id, chart_of_accounts(code)')
      .eq('journal_entry_id', entry.id);
    const flat = (lines || []).map((l) => ({
      account_code: l.chart_of_accounts.code,
      debit: Number(l.debit), credit: Number(l.credit),
      vendor_id: l.vendor_id, order_item_id: l.order_item_id,
      subscription_payment_id: l.subscription_payment_id,
    }));
    const entryId = await post({
      sourceType: 'REVERSAL', sourceId: entry.id, createdBy: req.admin?.id || null,
      template: reversalEntry({ journal_number: entry.journal_number, lines: flat }),
    });
    await audit(req, 'FINANCE_REVERSAL_POSTED', 'journal_entry', entryId, { reversed: entry.journal_number });
    res.json({ id: entryId });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── POST /admin/finance/bank-transfer ─────────────────────────
const postBankTransfer = async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    const reference = (req.body?.reference || '').trim();
    if (!(amount > 0)) return res.status(400).json({ message: 'amount must be > 0' });
    const sourceId = crypto.randomUUID();
    const entryId = await post({
      sourceType: 'BANK_TRANSFER', sourceId, createdBy: req.admin?.id || null,
      template: bankTransferEntry({ amount, reference }),
    });
    await audit(req, 'FINANCE_BANK_TRANSFER_POSTED', 'journal_entry', entryId, { amount, reference });
    res.json({ id: entryId });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = {
  getSummary, getAccounts, listJournals, getJournal, getLedger,
  postAdjustment, postReversal, postBankTransfer,
};
```

**Implementation notes (resolve while making tests green):**
- Verify `auditService.audit()`'s actual signature in `server/services/auditService.js` and match it (the existing controllers are the reference — copy their call shape exactly).
- The PostgREST aggregate select (`customer_total.sum()`) response key naming MUST be checked against live once; if aggregates are unavailable on the installed PostgREST, replace with a plain select + JS reduce — dataset is small today, and leave a `// TODO P4: move to SQL view` marker. The dashboard requirement (no full-table in-memory aggregation) is then satisfied later by the P4 reporting views; record this in the PR description.

- [ ] **Step 4: Register routes.** In `server/routes/adminRoutes.js`, after the Campaigns block:

```js
// ── Financial ledger (P1) ──────────────────────────────────────
const finance = require('../controllers/financeAdminController');
router.get('/finance/summary',            requireAdmin('finance.view'),   finance.getSummary);
router.get('/finance/accounts',           requireAdmin('finance.view'),   finance.getAccounts);
router.get('/finance/journals',           requireAdmin('finance.view'),   finance.listJournals);
router.get('/finance/journals/:id',       requireAdmin('finance.view'),   finance.getJournal);
router.get('/finance/ledger/:accountId',  requireAdmin('finance.view'),   finance.getLedger);
router.post('/finance/adjustment',        requireAdmin('finance.manage'), finance.postAdjustment);
router.post('/finance/reversal',          requireAdmin('finance.manage'), finance.postReversal);
router.post('/finance/bank-transfer',     requireAdmin('finance.manage'), finance.postBankTransfer);
```

- [ ] **Step 5: Run tests (incl. `adminPermissions.test.js`) — expect PASS. Commit**

```bash
git add server/lib/adminPermissions.js server/controllers/financeAdminController.js server/routes/adminRoutes.js server/tests/unit/financeAdminController.test.js
git commit -m "feat(admin): finance ledger API — summary, journals, ledger, manual entries + finance.manage perm"
```

---

### Task 13: Client — API helpers + Finance dashboard page

**Files:**
- Modify: `client/src/services/api.js`
- Create: `client/src/pages/admin/AdminFinanceDashboard.jsx`
- Modify: `client/src/App.jsx`, `client/src/components/common/AdminLayout.jsx`

- [ ] **Step 1: API helpers.** In `client/src/services/api.js` near the other admin helpers:

```js
// ── Financial ledger (P1) ──
export const adminFinanceSummary      = ()            => API.get('/admin/finance/summary');
export const adminFinanceAccounts     = ()            => API.get('/admin/finance/accounts');
export const adminFinanceJournals     = (params)      => API.get('/admin/finance/journals', { params });
export const adminFinanceJournal      = (id)          => API.get(`/admin/finance/journals/${id}`);
export const adminFinanceLedger       = (accountId, params) => API.get(`/admin/finance/ledger/${accountId}`, { params });
export const adminFinanceAdjustment   = (data)        => API.post('/admin/finance/adjustment', data);
export const adminFinanceReversal     = (data)        => API.post('/admin/finance/reversal', data);
export const adminFinanceBankTransfer = (data)        => API.post('/admin/finance/bank-transfer', data);
```

- [ ] **Step 2: Create `client/src/pages/admin/AdminFinanceDashboard.jsx`** (style matches AdminAudit; money in tabular numerals; en-IN formatting):

```jsx
import { useState, useEffect } from 'react';
import { adminFinanceSummary } from '../../services/api';
import toast from 'react-hot-toast';

// P1 Ledger dashboard — every figure is read from account_balances (running
// double-entry balances) or indexed snapshot sums. Nothing computed client-side.

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(n) || 0);

const CARDS = [
  { key: 'gross_collections',            label: 'Gross Collections',        hint: 'All customer + vendor payments received' },
  { key: 'net_revenue',                  label: 'Net Revenue',              hint: 'Fee + commission + subscription − platform-borne charges', accent: true },
  { key: 'available_business_cash',      label: 'Available Business Cash',  hint: 'Bank − vendor payables − GST liability', accent: true },
  { key: 'outstanding_vendor_payables',  label: 'Vendor Payables',          hint: 'Owed to vendors, pending settlement' },
  { key: 'gst_liability',                label: 'GST Liability',            hint: 'Collected for the government, not revenue' },
  { key: 'platform_fee_revenue',         label: 'Platform Fee Revenue',     hint: '₹10 base fee per paid order' },
  { key: 'commission_revenue',           label: 'Commission Revenue',       hint: 'Free-plan commission' },
  { key: 'subscription_revenue',         label: 'Subscription Revenue',     hint: 'Vendor plan fees (excl. GST)' },
  { key: 'razorpay_charges_orders',      label: 'Razorpay Charges (Orders)', hint: 'Vendor-borne gateway fees' },
  { key: 'razorpay_charges_subscriptions', label: 'Razorpay Charges (Subs)', hint: 'Platform-borne gateway fees' },
  { key: 'razorpay_receivable',          label: 'Razorpay Receivable',      hint: 'Collected by Razorpay, not yet in bank' },
  { key: 'bank_balance',                 label: 'Bank',                     hint: 'Per ledger (bank transfers recorded)' },
];

const AdminFinanceDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFinanceSummary()
      .then((r) => setMetrics(r.data.metrics))
      .catch((e) => toast.error(e.response?.data?.message || 'Failed to load financial summary'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Finance</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">Double-entry ledger balances. GST and vendor money are never platform revenue.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {CARDS.map((c) => <div key={c.key} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : !metrics ? (
        <div className="bg-white border rounded-2xl py-16 text-center text-gray-400">No financial data yet.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {CARDS.map((c) => (
            <div key={c.key} className={`bg-white border rounded-2xl p-4 ${c.accent ? 'border-gray-900' : ''}`}>
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{c.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{inr(metrics[c.key])}</p>
              <p className="text-[11px] text-gray-400 mt-1">{c.hint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFinanceDashboard;
```

(The revenue-by-month recharts chart needs the P4 reporting view for an indexed month bucket; P1 ships cards only — note this scope trim in the PR.)

- [ ] **Step 3: Route + nav.** In `client/src/App.jsx` add with the other admin lazy imports:

```jsx
const AdminFinanceDashboard = lazy(() => import('./pages/admin/AdminFinanceDashboard'));
const AdminJournal          = lazy(() => import('./pages/admin/AdminJournal'));
const AdminLedger           = lazy(() => import('./pages/admin/AdminLedger'));
```

and with the admin routes (BEFORE any `/admin/finance/...` shell routes so the new pages win):

```jsx
          {/* Financial ledger (P1) */}
          <Route path="/admin/finance" element={<AdminWrapper><AdminFinanceDashboard /></AdminWrapper>} />
          <Route path="/admin/finance/journal" element={<AdminWrapper><AdminJournal /></AdminWrapper>} />
          <Route path="/admin/finance/ledger" element={<AdminWrapper><AdminLedger /></AdminWrapper>} />
```

In `client/src/components/common/AdminLayout.jsx` FINANCE section (line ~142), add at the TOP of the items array:

```js
    { label:'Dashboard', icon:'trendUp', to:'/admin/finance', exact:true, perm:'finance.view' },
    { label:'Journal',   icon:'file',    to:'/admin/finance/journal', perm:'finance.view' },
    { label:'Ledger',    icon:'layers',  to:'/admin/finance/ledger',  perm:'finance.view' },
```

(Task 14 creates the two remaining pages — App.jsx imports land here so do Tasks 13+14 in one working session, or temporarily comment the two routes until Task 14.)

- [ ] **Step 4: Client build + tests — expect PASS. Commit**

```bash
git add client/src/services/api.js client/src/pages/admin/AdminFinanceDashboard.jsx client/src/App.jsx client/src/components/common/AdminLayout.jsx
git commit -m "feat(admin-ui): finance dashboard page, routes, FINANCE nav"
```

---

### Task 14: Client — Journal + Ledger pages

**Files:**
- Create: `client/src/pages/admin/AdminJournal.jsx`
- Create: `client/src/pages/admin/AdminLedger.jsx`
- Test: `client/src/pages/admin/__tests__/AdminFinance.test.jsx`

- [ ] **Step 1: Create `client/src/pages/admin/AdminJournal.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import {
  adminFinanceJournals, adminFinanceJournal, adminFinanceAccounts,
  adminFinanceAdjustment, adminFinanceReversal, adminFinanceBankTransfer,
} from '../../services/api';
import toast from 'react-hot-toast';

// Journal browser — append-only double-entry record. Corrections happen ONLY
// through adjustment/reversal entries (the modal); nothing is ever edited.

const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n) || 0);
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—');
const SOURCES = ['ORDER_PAYMENT', 'SUBSCRIPTION_PAYMENT', 'BANK_TRANSFER', 'ADJUSTMENT', 'REVERSAL', 'BACKFILL', 'BACKFILL_SETTLEMENT'];

const emptyLine = () => ({ account_code: '', debit: '', credit: '' });

const AdminJournal = () => {
  const [journals, setJournals] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ source_type: '', from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);   // journal id → { entry, lines }
  const [lineCache, setLineCache] = useState({});
  const [modal, setModal] = useState(null);          // 'adjustment' | 'transfer' | null
  const [accounts, setAccounts] = useState([]);
  const [adjLines, setAdjLines] = useState([emptyLine(), emptyLine()]);
  const [adjDesc, setAdjDesc] = useState('');
  const [transfer, setTransfer] = useState({ amount: '', reference: '' });
  const [saving, setSaving] = useState(false);
  const limit = 25;

  const fetchJournals = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (filters.source_type) params.source_type = filters.source_type;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      const { data } = await adminFinanceJournals(params);
      setJournals(data.journals || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load journal');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchJournals(); }, [fetchJournals]);
  useEffect(() => { adminFinanceAccounts().then((r) => setAccounts(r.data.accounts || [])).catch(() => {}); }, []);

  const toggle = async (id) => {
    if (expanded === id) return setExpanded(null);
    setExpanded(id);
    if (!lineCache[id]) {
      try {
        const { data } = await adminFinanceJournal(id);
        setLineCache((c) => ({ ...c, [id]: data.lines || [] }));
      } catch { toast.error('Failed to load lines'); }
    }
  };

  const reverse = async (id) => {
    if (!window.confirm('Post a reversal entry mirroring this journal entry?')) return;
    try {
      await adminFinanceReversal({ journal_entry_id: id });
      toast.success('Reversal posted');
      fetchJournals();
    } catch (e) { toast.error(e.response?.data?.message || 'Reversal failed'); }
  };

  const submitAdjustment = async () => {
    setSaving(true);
    try {
      const lines = adjLines
        .filter((l) => l.account_code)
        .map((l) => ({ account_code: l.account_code, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }));
      await adminFinanceAdjustment({ description: adjDesc, lines });
      toast.success('Adjustment posted');
      setModal(null); setAdjLines([emptyLine(), emptyLine()]); setAdjDesc('');
      fetchJournals();
    } catch (e) { toast.error(e.response?.data?.message || 'Adjustment failed'); }
    finally { setSaving(false); }
  };

  const submitTransfer = async () => {
    setSaving(true);
    try {
      await adminFinanceBankTransfer({ amount: Number(transfer.amount), reference: transfer.reference });
      toast.success('Bank transfer recorded');
      setModal(null); setTransfer({ amount: '', reference: '' });
      fetchJournals();
    } catch (e) { toast.error(e.response?.data?.message || 'Transfer failed'); }
    finally { setSaving(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const entryAmount = (id) => {
    const lines = lineCache[id];
    if (!lines) return null;
    return lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Journal</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Append-only double-entry record. {total} entr{total === 1 ? 'y' : 'ies'}.</p>
        </div>
        <div className="flex gap-2">
          <button className="fb-btn fb-btn--secondary text-xs" onClick={() => setModal('transfer')}>Record bank transfer</button>
          <button className="fb-btn text-xs" onClick={() => setModal('adjustment')}>New adjustment</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">Source</label>
          <select className="fb-input text-sm" value={filters.source_type}
            onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, source_type: e.target.value })); }}>
            <option value="">All sources</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">From</label>
          <input type="date" className="fb-input text-sm" value={filters.from}
            onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, from: e.target.value })); }} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">To</label>
          <input type="date" className="fb-input text-sm" value={filters.to}
            onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, to: e.target.value })); }} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : journals.length === 0 ? (
        <div className="bg-white border rounded-2xl py-16 text-center text-gray-400">No journal entries match these filters.</div>
      ) : (
        <div className="bg-white border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b">
                <th className="px-4 py-3 font-semibold">Entry</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Description</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {journals.map((j) => (
                <>
                  <tr key={j.id} className="border-b last:border-0 hover:bg-gray-50/60 cursor-pointer" onClick={() => toggle(j.id)}>
                    <td className="px-4 py-3 font-mono text-[12px] font-semibold text-gray-700">{j.journal_number}</td>
                    <td className="px-4 py-3 text-[12px] text-gray-500 whitespace-nowrap">{fmt(j.journal_date)}</td>
                    <td className="px-4 py-3"><span className="text-[11px] font-mono px-2 py-1 rounded bg-gray-100 text-gray-700">{j.source_type}</span></td>
                    <td className="px-4 py-3 hidden md:table-cell text-[12px] text-gray-500 truncate max-w-[280px]">{j.description || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-[11px] text-gray-500 underline" onClick={(e) => { e.stopPropagation(); reverse(j.id); }}>Reverse</button>
                    </td>
                  </tr>
                  {expanded === j.id && (
                    <tr key={`${j.id}-lines`} className="bg-gray-50/60 border-b">
                      <td colSpan={5} className="px-6 py-3">
                        {!lineCache[j.id] ? (
                          <div className="h-8 bg-gray-100 rounded animate-pulse" />
                        ) : (
                          <table className="w-full text-[12px]">
                            <tbody>
                              {lineCache[j.id].map((l) => (
                                <tr key={l.id}>
                                  <td className="py-1 pr-3 font-mono text-gray-500">{l.chart_of_accounts?.code}</td>
                                  <td className="py-1 pr-3 text-gray-700">{l.chart_of_accounts?.name}</td>
                                  <td className="py-1 pr-3 text-right tabular-nums">{Number(l.debit) > 0 ? inr(l.debit) : ''}</td>
                                  <td className="py-1 text-right tabular-nums text-gray-500">{Number(l.credit) > 0 ? inr(l.credit) : ''}</td>
                                </tr>
                              ))}
                              <tr className="border-t">
                                <td colSpan={2} className="py-1 pr-3 text-gray-400">Entry total</td>
                                <td className="py-1 pr-3 text-right tabular-nums font-semibold">{inr(entryAmount(j.id))}</td>
                                <td className="py-1 text-right tabular-nums font-semibold text-gray-500">{inr(entryAmount(j.id))}</td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="fb-btn fb-btn--secondary text-xs disabled:opacity-40">Previous</button>
          <span className="text-[12px] text-gray-400">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="fb-btn fb-btn--secondary text-xs disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Manual-entry modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
            {modal === 'transfer' ? (
              <>
                <h2 className="font-bold text-gray-900 mb-1">Record bank transfer</h2>
                <p className="text-[12px] text-gray-400 mb-4">Razorpay settlement received in the bank account. DR Bank / CR Razorpay Receivable.</p>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">Amount (₹)</label>
                <input type="number" min="0.01" step="0.01" className="fb-input text-sm w-full mb-3" value={transfer.amount}
                  onChange={(e) => setTransfer((t) => ({ ...t, amount: e.target.value }))} />
                <label className="block text-[11px] font-medium text-gray-400 mb-1">Settlement reference</label>
                <input type="text" className="fb-input text-sm w-full mb-5" value={transfer.reference} placeholder="setl_..."
                  onChange={(e) => setTransfer((t) => ({ ...t, reference: e.target.value }))} />
                <div className="flex justify-end gap-2">
                  <button className="fb-btn fb-btn--secondary text-xs" onClick={() => setModal(null)}>Cancel</button>
                  <button className="fb-btn text-xs disabled:opacity-40" disabled={saving || !(Number(transfer.amount) > 0)} onClick={submitTransfer}>
                    {saving ? 'Posting…' : 'Post entry'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-bold text-gray-900 mb-1">New adjustment entry</h2>
                <p className="text-[12px] text-gray-400 mb-4">Debits must equal credits. Posted entries are permanent.</p>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">Description</label>
                <input type="text" className="fb-input text-sm w-full mb-3" value={adjDesc} onChange={(e) => setAdjDesc(e.target.value)} />
                {adjLines.map((l, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select className="fb-input text-sm flex-1" value={l.account_code}
                      onChange={(e) => setAdjLines((ls) => ls.map((x, j) => (j === i ? { ...x, account_code: e.target.value } : x)))}>
                      <option value="">Account…</option>
                      {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                    </select>
                    <input type="number" min="0" step="0.01" placeholder="Debit" className="fb-input text-sm w-24" value={l.debit}
                      onChange={(e) => setAdjLines((ls) => ls.map((x, j) => (j === i ? { ...x, debit: e.target.value, credit: '' } : x)))} />
                    <input type="number" min="0" step="0.01" placeholder="Credit" className="fb-input text-sm w-24" value={l.credit}
                      onChange={(e) => setAdjLines((ls) => ls.map((x, j) => (j === i ? { ...x, credit: e.target.value, debit: '' } : x)))} />
                  </div>
                ))}
                <button className="text-[11px] text-gray-500 underline mb-4" onClick={() => setAdjLines((ls) => [...ls, emptyLine()])}>+ Add line</button>
                <div className="flex justify-end gap-2">
                  <button className="fb-btn fb-btn--secondary text-xs" onClick={() => setModal(null)}>Cancel</button>
                  <button className="fb-btn text-xs disabled:opacity-40" disabled={saving} onClick={submitAdjustment}>
                    {saving ? 'Posting…' : 'Post entry'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminJournal;
```

- [ ] **Step 2: Create `client/src/pages/admin/AdminLedger.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { adminFinanceAccounts, adminFinanceLedger } from '../../services/api';
import toast from 'react-hot-toast';

// Per-account ledger with running balance — the auditable account history.

const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n) || 0);
const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const AdminLedger = () => {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 25;

  useEffect(() => {
    adminFinanceAccounts()
      .then((r) => {
        const list = r.data.accounts || [];
        setAccounts(list);
        if (list.length && !accountId) setAccountId(list[0].id);
      })
      .catch((e) => toast.error(e.response?.data?.message || 'Failed to load accounts'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const { data } = await adminFinanceLedger(accountId, { page });
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [accountId, page]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const selected = accounts.find((a) => a.id === accountId);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Ledger</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">Per-account entries with running balance. Written only by the posting engine.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">Account</label>
          <select className="fb-input text-sm min-w-[280px]" value={accountId}
            onChange={(e) => { setPage(1); setAccountId(e.target.value); }}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.type})</option>
            ))}
          </select>
        </div>
        {selected && (
          <p className="text-sm text-gray-700 pb-2">
            Balance: <span className="font-bold tabular-nums">{inr(selected.account_balances?.[0]?.balance ?? selected.account_balances?.balance ?? 0)}</span>
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : entries.length === 0 ? (
        <div className="bg-white border rounded-2xl py-16 text-center text-gray-400">No ledger entries for this account yet.</div>
      ) : (
        <div className="bg-white border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Journal</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Description</th>
                <th className="px-4 py-3 font-semibold text-right">Debit</th>
                <th className="px-4 py-3 font-semibold text-right">Credit</th>
                <th className="px-4 py-3 font-semibold text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-[12px] text-gray-500 whitespace-nowrap">{fmt(e.created_at)}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-gray-700">{e.journal_entries?.journal_number}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-[12px] text-gray-500 truncate max-w-[240px]">{e.journal_entries?.description || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(e.debit) > 0 ? inr(e.debit) : ''}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">{Number(e.credit) > 0 ? inr(e.credit) : ''}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{inr(e.balance_after_account)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="fb-btn fb-btn--secondary text-xs disabled:opacity-40">Previous</button>
          <span className="text-[12px] text-gray-400">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="fb-btn fb-btn--secondary text-xs disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
};

export default AdminLedger;
```

- [ ] **Step 3: Client tests** — `client/src/pages/admin/__tests__/AdminFinance.test.jsx` (match the existing Vitest setup/mocks used by other admin page tests in the repo — copy an existing admin page test's mock scaffolding):

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdminFinanceDashboard from '../AdminFinanceDashboard';

vi.mock('../../../services/api', () => ({
  adminFinanceSummary: vi.fn(() => Promise.resolve({ data: { metrics: {
    gross_collections: 1011.8, net_revenue: 60, available_business_cash: -928.2,
    outstanding_vendor_payables: 917.4, gst_liability: 10.8,
    platform_fee_revenue: 10, commission_revenue: 50, subscription_revenue: 0,
    razorpay_charges_orders: 23.6, razorpay_charges_subscriptions: 0,
    razorpay_receivable: 988.2, bank_balance: 0,
  } } })),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

describe('AdminFinanceDashboard', () => {
  it('renders metric cards with en-IN currency', async () => {
    render(<AdminFinanceDashboard />);
    await waitFor(() => expect(screen.getByText('Vendor Payables')).toBeInTheDocument());
    expect(screen.getByText('₹917.40')).toBeInTheDocument();
    expect(screen.getByText('GST Liability')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run client suite + build — expect PASS. Commit**

```bash
cd client && npm test -- run && npm run build
git add client/src/pages/admin/AdminJournal.jsx client/src/pages/admin/AdminLedger.jsx client/src/pages/admin/__tests__/AdminFinance.test.jsx
git commit -m "feat(admin-ui): journal browser with manual entries + per-account ledger viewer"
```

---

### Task 15: Full verification + live e2e + QA

- [ ] **Step 1: Full suites**

```bash
cd server && npm test --silent          # expect ALL green
cd client && npm test -- run            # expect ALL green
cd client && npm run build              # clean build
```

- [ ] **Step 2: Live DB steps (in order, via Supabase MCP)**
1. Confirm migration applied (Task 1) and the smoke entry was reversed.
2. Apply the `finance.manage` role update SQL (Task 12 Step 1).
3. Run backfill `--dry-run`, eyeball, then real run (Task 11). Record closing balances in the PR/summary.

- [ ] **Step 3: Live e2e (real flows)**
1. Make a test booking on a paid service → pay with a Razorpay test card → verify: `bookings.paid_at` set, fee/tax split recorded, `journal_entries` has ORDER_PAYMENT row, lines balance, `account_balances` moved.
2. Mark it complete → verify recognition stamps + `settlement_status='eligible_for_settlement'`.
3. Buy a plan with a test account → verify GST charged on top (Razorpay modal total = price × 1.18), `subscription_payments` row, SUBSCRIPTION_PAYMENT entry.
4. `SELECT sum(debit), sum(credit) FROM journal_lines;` — totals MUST be equal.

- [ ] **Step 4: gstack browser QA** — run the finance pages at `/backstage` login → `/admin/finance`, `/admin/finance/journal` (expand an entry, post a ₹1 adjustment + its reversal), `/admin/finance/ledger` (check running balance column). Responsive at 375px. Screenshot evidence. (gstack browse: one-time `./setup` build needed — NEEDS_SETUP was reported this session.)

- [ ] **Step 5: Docs + memory**
- Update `docs/current-state.md` + `docs/current-work.md` (new sprint section) + `docs/database-schema.md` (v2.8 tables).
- Update auto-memory `payout-model.md` (money model v3: commission GST + subscription GST) and add a ledger memory file.

- [ ] **Step 6: Commit + finishing-a-development-branch skill** (merge/PR decision with user).

---

## Self-Review Notes (done at planning time)

- **Spec coverage:** schema §5 → Task 1; money math §4 → Task 2; templates/posting §6 → Tasks 3–8, 10; backfill §7 → Task 11; API §8 → Task 12; UI §9 → Tasks 13–14; testing §11 → every task + Task 15. Revenue-by-month chart and Earnings-page GST line consciously trimmed (chart needs P4 view; Earnings net already includes commission GST) — both noted for the PR description.
- **Known live-verify points (flagged inside tasks, not placeholders):** PostgREST aggregate key names (Task 12), `payout_requests` exact columns (Task 11), `auditService.audit()` signature (Task 12), `admin_roles.permissions` column type (Task 12).
- **Type consistency:** `postingService.post({sourceType, sourceId, template, journalDate, createdBy})` used identically in Tasks 6, 8, 10, 11, 12. Template output `{description, lines:[{account_code, debit, credit, ...tags}]}` consistent across Tasks 3, 4, 11, 12. `calculateVendorPayout(price, commission, commissionGst, razorpayFeeTotal)` consistent in Tasks 2, 5, 6.
