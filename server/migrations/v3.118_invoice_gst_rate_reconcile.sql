-- v3.118_invoice_gst_rate_reconcile.sql — GST invoice hardening (billing audit).
--   1. Persist the effective GST rate on each invoice (was derived at render time).
--   2. Belt-and-suspenders CHECKs: an invoice can never carry BOTH IGST and
--      CGST/SGST for one supply, and cgst+sgst+igst must reconcile to total−taxable.
--   3. Extend create_invoice() with an optional p_gst_rate (DEFAULT NULL) so the
--      app can pass it; the default keeps pre-migration callers working during a
--      rolling deploy (code-side schema fallback also handles the reverse window).
-- Additive + idempotent. CHECKs are added NOT VALID so existing (correct) rows are
-- grandfathered without a scan — historical financial records are never modified.
-- Apply on BOTH DBs (prod Mumbai + staging Tokyo).

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,4);

DO $$
BEGIN
  -- Mutually-exclusive tax heads: intra-state (CGST+SGST) XOR inter-state (IGST).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_tax_exclusive_chk') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_tax_exclusive_chk
      CHECK (NOT (igst > 0 AND (cgst > 0 OR sgst > 0))) NOT VALID;
  END IF;
  -- Reconciliation: taxes + taxable value must equal the grand total (±5 paise
  -- for rounding). Guards a mis-minted invoice from ever being written.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_tax_reconcile_chk') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_tax_reconcile_chk
      CHECK (abs(total - (taxable_value + cgst + sgst + igst)) <= 0.05) NOT VALID;
  END IF;
END $$;

-- Replace create_invoice with a signature that also records the GST rate. Dropping
-- the old 20-arg version first avoids leaving two overloads; p_gst_rate DEFAULT NULL
-- means a caller that omits it (mid-deploy) still resolves to this one function.
DROP FUNCTION IF EXISTS create_invoice(
  TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION create_invoice(
  p_series          TEXT,
  p_number_prefix   TEXT,   -- e.g. 'BAS-SUB'
  p_fiscal_year     TEXT,
  p_source_type     TEXT,
  p_source_id       UUID,
  p_payment_id      TEXT,
  p_buyer_name      TEXT,
  p_buyer_address   TEXT,
  p_buyer_state     TEXT,
  p_buyer_state_code TEXT,
  p_buyer_gstin     TEXT,
  p_buyer_pan       TEXT,
  p_seller_snapshot JSONB,
  p_taxable_value   NUMERIC,
  p_cgst            NUMERIC,
  p_sgst            NUMERIC,
  p_igst            NUMERIC,
  p_total           NUMERIC,
  p_place_of_supply TEXT,
  p_sac_code        TEXT,
  p_gst_rate        NUMERIC DEFAULT NULL
) RETURNS invoices
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing invoices;
  v_serial   INT;
  v_number   TEXT;
  v_row      invoices;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_source_type || ':' || p_source_id::text));

  SELECT * INTO v_existing FROM invoices
    WHERE source_type = p_source_type AND source_id = p_source_id;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  INSERT INTO invoice_counters (series, fiscal_year, last_serial)
    VALUES (p_series, p_fiscal_year, 1)
    ON CONFLICT (series, fiscal_year)
    DO UPDATE SET last_serial = invoice_counters.last_serial + 1
    RETURNING last_serial INTO v_serial;

  v_number := p_number_prefix || '/' || p_fiscal_year || '/' || lpad(v_serial::text, 5, '0');

  INSERT INTO invoices (
    invoice_number, series, fiscal_year, serial, source_type, source_id, payment_id,
    buyer_name, buyer_address, buyer_state, buyer_state_code, buyer_gstin, buyer_pan,
    seller_snapshot, taxable_value, cgst, sgst, igst, total, place_of_supply, sac_code, gst_rate
  ) VALUES (
    v_number, p_series, p_fiscal_year, v_serial, p_source_type, p_source_id, p_payment_id,
    p_buyer_name, p_buyer_address, p_buyer_state, p_buyer_state_code, p_buyer_gstin, p_buyer_pan,
    p_seller_snapshot, p_taxable_value, p_cgst, p_sgst, p_igst, p_total, p_place_of_supply, p_sac_code, p_gst_rate
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Re-pin search_path on the new signature (matches v3.100 advisor hardening).
ALTER FUNCTION create_invoice(
  TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC
) SET search_path = pg_catalog, public;
