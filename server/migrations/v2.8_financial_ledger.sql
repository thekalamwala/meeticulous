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
