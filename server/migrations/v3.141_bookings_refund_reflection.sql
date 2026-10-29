-- v3.141 — reflect a refund on the booking row (audit F14).
--
-- The refund webhook + admin action posted the ledger REFUND and reversed the
-- held payout, but never touched the booking row, so a refunded booking still
-- read payment_status='paid'. Bolt answered "where is my refund?" by checking
-- payment_status='refunded' and would tell a refunded guest they were NOT
-- refunded; the guest console + host dashboard showed "Paid"; CRM attribution
-- counted it as live revenue.
--
-- payment_status alone can't express a PARTIAL refund (its CHECK allows only
-- unpaid/paid/refunded, and a tiered refund returns a % of the service price, not
-- the whole customer_total). So a partial refund keeps payment_status='paid' and
-- is surfaced by these two additive columns; a FULL refund also flips
-- payment_status to 'refunded'. refundService writes both.
--
-- Additive + schema-fallback safe (refundService/executeRefund destructure on a
-- "column not found"). Apply on BOTH DBs. Idempotent.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refunded_amount numeric(12,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refunded_at     timestamptz;

-- Partial index for "bookings with a refund" reads (support, finance, CRM).
CREATE INDEX IF NOT EXISTS idx_bookings_refunded
  ON bookings (refunded_at)
  WHERE refunded_amount IS NOT NULL;
