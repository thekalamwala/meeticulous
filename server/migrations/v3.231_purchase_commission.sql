-- ============================================================
-- v3.231 — Commission snapshot on product + course purchases (pricing v2 §2)
-- ------------------------------------------------------------
-- Pricing v2 charges commission on digital goods at the plan's `products` /
-- `courses` rate (Starter 12%, Pro 4%). The rate is fixed at checkout (order
-- notes) and snapshotted here at capture, exactly like bookings (v1.7/v2.8/v3.93)
-- and membership_charges (v3.225): refunds and any payout read the snapshot,
-- never the live plan.
--
-- Commission is GST-INCLUSIVE (same regime as bookings): commission_gst is
-- backed out of commission_applied, commission_taxable = applied − gst.
--
-- product_purchases.vendor_amount (v3.37) is now price − commission − gateway.
-- course_purchases has no vendor_amount and no ledger entry — the course payout
-- rail does not exist yet (known record gap); these columns are what it will read.
--
-- Additive, nullable/defaulted, idempotent. Code is schema-fallback safe: the
-- purchase insert retries without these columns on "column not found", so the
-- buyer's access is never blocked by bookkeeping. RLS unchanged (service-role
-- only); v3.206 default privileges give anon/authenticated no write grant.
-- ============================================================

ALTER TABLE product_purchases
  ADD COLUMN IF NOT EXISTS commission_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS commission_applied    numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_gst        numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_taxable    numeric(12,2);

ALTER TABLE course_purchases
  ADD COLUMN IF NOT EXISTS commission_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS commission_applied    numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_gst        numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_taxable    numeric(12,2);

-- ── Verify ──────────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('product_purchases', 'course_purchases')
  AND column_name LIKE 'commission%'
ORDER BY table_name, column_name;
