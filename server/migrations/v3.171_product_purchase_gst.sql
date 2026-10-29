-- v3.171_product_purchase_gst.sql
--
-- Snapshot GST-on-fee and place-of-supply onto digital-product purchases so the
-- product flow matches services/bookings (which already carry platform_fee_gst,
-- gst_rate, buyer_state, buyer_gstin). Products previously stored only the flat
-- platform_fee with NO GST and NO invoice; these columns let materializeProductPurchase
-- persist the GST charged on the platform fee and the buyer's declared place of
-- supply / GSTIN for the BAS platform-fee tax invoice.
--
-- Additive + schema-fallback safe: materializeProductPurchase inserts these in
-- fullRow only and falls back to the base insert on "column does not exist", so
-- code is safe to deploy before this runs. Run on BOTH DBs (staging Tokyo, prod
-- Mumbai) per the migration workflow.

ALTER TABLE product_purchases
  ADD COLUMN IF NOT EXISTS platform_fee_gst numeric,
  ADD COLUMN IF NOT EXISTS gst_rate numeric,
  ADD COLUMN IF NOT EXISTS buyer_state text,
  ADD COLUMN IF NOT EXISTS buyer_gstin text;
