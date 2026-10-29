-- v3.67_gst_invoicing.sql — GST tax invoices for BAS's own supply.
-- invoices (immutable legal record) + invoice_counters (atomic gap-free serial)
-- + create_invoice() RPC (advisory-locked, idempotent) + billing_details columns.
-- Idempotent. Apply on BOTH DBs (prod Mumbai + staging Tokyo).

CREATE TABLE IF NOT EXISTS invoice_counters (
  series       TEXT NOT NULL,           -- 'SUB' | 'BKG'
  fiscal_year  TEXT NOT NULL,           -- '26' (2-digit FY start year)
  last_serial  INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (series, fiscal_year)
);

CREATE TABLE IF NOT EXISTS invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   TEXT UNIQUE NOT NULL,
  series           TEXT NOT NULL,
  fiscal_year      TEXT NOT NULL,
  serial           INT  NOT NULL,
  source_type      TEXT NOT NULL,       -- 'subscription' | 'booking'
  source_id        UUID NOT NULL,
  payment_id       TEXT,
  buyer_name       TEXT NOT NULL,
  buyer_address    TEXT,
  buyer_state      TEXT,
  buyer_state_code TEXT,
  buyer_gstin      TEXT,
  buyer_pan        TEXT,
  seller_snapshot  JSONB NOT NULL,
  taxable_value    NUMERIC NOT NULL,
  cgst             NUMERIC NOT NULL DEFAULT 0,
  sgst             NUMERIC NOT NULL DEFAULT 0,
  igst             NUMERIC NOT NULL DEFAULT 0,
  total            NUMERIC NOT NULL,
  place_of_supply  TEXT,
  sac_code         TEXT,
  access_token     UUID NOT NULL DEFAULT gen_random_uuid(),
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);
CREATE INDEX IF NOT EXISTS invoices_source_idx ON invoices (source_type, source_id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_details JSONB;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS billing_details JSONB;

-- Atomic, gap-free, idempotent invoice minting. Advisory lock serialises
-- concurrent calls for the SAME (source_type, source_id) so the second sees the
-- committed row and returns it WITHOUT consuming a serial (no gaps, no dupes).
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
  p_sac_code        TEXT
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
    seller_snapshot, taxable_value, cgst, sgst, igst, total, place_of_supply, sac_code
  ) VALUES (
    v_number, p_series, p_fiscal_year, v_serial, p_source_type, p_source_id, p_payment_id,
    p_buyer_name, p_buyer_address, p_buyer_state, p_buyer_state_code, p_buyer_gstin, p_buyer_pan,
    p_seller_snapshot, p_taxable_value, p_cgst, p_sgst, p_igst, p_total, p_place_of_supply, p_sac_code
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
