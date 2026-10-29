-- v3.37 — Wire paid digital-product purchases into the double-entry ledger.
--
-- Why: product checkout (price + platform_fee) moved money but never posted a
-- journal entry, so Razorpay Receivable / Vendor Payables / Platform Fee Revenue
-- were understated for every product sale. Bookings and subscriptions already
-- post to the ledger; products were the gap.
--
--   1) Allow the new PRODUCT_PAYMENT source type on journal_entries.
--   2) Add the per-purchase money snapshot columns the PRODUCT_PAYMENT template
--      reads — an immutable record of what was charged, owed to the vendor, and
--      paid in gateway fees (vendor-borne, mirrors bookings).
--
-- Additive + safe: existing rows untouched; the server carries a schema fallback
-- (insert drops these columns, reconciler skips the scan) so nothing breaks if
-- this is applied late.

ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_source_type_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'ORDER_PAYMENT', 'SUBSCRIPTION_PAYMENT', 'PRODUCT_PAYMENT', 'SETTLEMENT',
    'REFUND', 'ADJUSTMENT', 'REVERSAL', 'BANK_TRANSFER', 'BACKFILL',
    'BACKFILL_SETTLEMENT', 'RESCHEDULE_FEE'
  ]));

ALTER TABLE product_purchases
  ADD COLUMN IF NOT EXISTS customer_total      numeric(12,2),
  ADD COLUMN IF NOT EXISTS vendor_amount       numeric(12,2),
  ADD COLUMN IF NOT EXISTS razorpay_fee_actual numeric(12,2),
  ADD COLUMN IF NOT EXISTS razorpay_tax_actual numeric(12,2);
