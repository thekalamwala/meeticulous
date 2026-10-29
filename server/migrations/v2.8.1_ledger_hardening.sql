-- v2.8.1_ledger_hardening.sql — code-review followups on v2.8
-- 1. RPC: auto-seed balance rows for new accounts; graceful idempotency under
--    concurrency (unique_violation → return existing); deterministic ordered
--    account locking (no deadlocks); full validation BEFORE any insert;
--    negative-amount + inactive-account rejection; ledger created_at uses
--    clock_timestamp() so (account_id, created_at) ordering matches balance order.
-- 2. Drop index redundant with the UNIQUE constraint.
-- 3. Ledger rows get their own amount CHECKs.
-- 4. Immutability enforced in the DB: UPDATE/DELETE on journal/ledger tables raises.

-- ── 2. Redundant index (UNIQUE (source_type, source_id) already indexes) ──
DROP INDEX IF EXISTS idx_journal_entries_source;

-- ── 3. ledger_entries amount integrity (mirrors journal_lines) ──
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_amounts_chk;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_amounts_chk
  CHECK (debit >= 0 AND credit >= 0 AND ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)));

-- ── 4. Immutability triggers (PRD Rule 3: no edits, no deletes — ever) ──
CREATE OR REPLACE FUNCTION forbid_financial_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'financial records are immutable (table %)', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS journal_entries_immutable ON journal_entries;
CREATE TRIGGER journal_entries_immutable
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_financial_mutation();

DROP TRIGGER IF EXISTS journal_lines_immutable ON journal_lines;
CREATE TRIGGER journal_lines_immutable
  BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION forbid_financial_mutation();

DROP TRIGGER IF EXISTS ledger_entries_immutable ON ledger_entries;
CREATE TRIGGER ledger_entries_immutable
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_financial_mutation();

-- ── 1. Hardened RPC ──
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

  -- Idempotent fast path: one entry per (source_type, source_id)
  SELECT id INTO v_existing FROM journal_entries
   WHERE source_type = p->>'source_type' AND source_id = (p->>'source_id')::uuid;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  IF p->'lines' IS NULL OR jsonb_array_length(p->'lines') < 2 THEN
    RAISE EXCEPTION 'journal entry needs at least 2 lines';
  END IF;

  -- ── Full validation BEFORE any write (no wasted sequence numbers) ──
  FOR v_line IN SELECT * FROM jsonb_array_elements(p->'lines') LOOP
    v_debit  := COALESCE((v_line->>'debit')::numeric,  0);
    v_credit := COALESCE((v_line->>'credit')::numeric, 0);
    IF v_debit < 0 OR v_credit < 0 THEN
      RAISE EXCEPTION 'line amounts cannot be negative (account %)', v_line->>'account_code';
    END IF;
    IF (v_debit > 0 AND v_credit > 0) OR (v_debit = 0 AND v_credit = 0) THEN
      RAISE EXCEPTION 'each line must have exactly one of debit/credit > 0 (account %)', v_line->>'account_code';
    END IF;
    SELECT id INTO v_acct_id FROM chart_of_accounts
     WHERE code = v_line->>'account_code' AND active;
    IF v_acct_id IS NULL THEN
      RAISE EXCEPTION 'unknown or inactive account code %', v_line->>'account_code';
    END IF;
    v_total_debit  := v_total_debit  + v_debit;
    v_total_credit := v_total_credit + v_credit;
  END LOOP;
  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'journal entry does not balance: debits=% credits=%', v_total_debit, v_total_credit;
  END IF;

  -- ── Seed missing balance rows (new accounts), then lock ALL referenced
  --    accounts in deterministic order — concurrent entries can't deadlock. ──
  INSERT INTO account_balances (account_id, balance)
    SELECT c.id, 0
      FROM chart_of_accounts c
     WHERE c.code IN (SELECT DISTINCT l.value->>'account_code'
                        FROM jsonb_array_elements(p->'lines') l)
  ON CONFLICT (account_id) DO NOTHING;

  PERFORM 1
     FROM account_balances ab
    WHERE ab.account_id IN (
            SELECT c.id FROM chart_of_accounts c
             WHERE c.code IN (SELECT DISTINCT l.value->>'account_code'
                                FROM jsonb_array_elements(p->'lines') l))
    ORDER BY ab.account_id
      FOR UPDATE;

  v_journal_no := 'JNL-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('journal_number_seq')::text, 6, '0');

  -- Concurrent same-source race: loser of the UNIQUE constraint returns the
  -- winner's entry id instead of surfacing 23505 to the caller.
  BEGIN
    INSERT INTO journal_entries (journal_number, journal_date, source_type, source_id, description, created_by)
    VALUES (
      v_journal_no,
      COALESCE((p->>'journal_date')::date, CURRENT_DATE),  -- UTC date; callers pass journal_date explicitly
      p->>'source_type',
      (p->>'source_id')::uuid,
      p->>'description',
      NULLIF(p->>'created_by','')::uuid
    ) RETURNING id INTO v_entry_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing FROM journal_entries
     WHERE source_type = p->>'source_type' AND source_id = (p->>'source_id')::uuid;
    RETURN v_existing;
  END;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p->'lines') LOOP
    SELECT id, type INTO v_acct_id, v_acct_type
      FROM chart_of_accounts WHERE code = v_line->>'account_code';

    v_debit  := COALESCE((v_line->>'debit')::numeric,  0);
    v_credit := COALESCE((v_line->>'credit')::numeric, 0);

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

    UPDATE account_balances
       SET balance = balance + v_signed, updated_at = now()
     WHERE account_id = v_acct_id
     RETURNING balance INTO v_new_balance;

    -- clock_timestamp(): real insert time, so (account_id, created_at) ordering
    -- agrees with balance_after_account ordering (locks already serialise us).
    INSERT INTO ledger_entries
      (created_at, account_id, order_id, order_item_id, vendor_id, subscription_payment_id,
       journal_entry_id, ledger_type, debit, credit, balance_after_account)
    VALUES
      (clock_timestamp(), v_acct_id,
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
