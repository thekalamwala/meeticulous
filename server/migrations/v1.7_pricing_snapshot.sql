-- ─── v1.7_pricing_snapshot.sql ───────────────────────────────────────────────
--
-- Purpose: Add commission_applied snapshot column to bookings.
--          Required by the Pricing & Commission Refactor Protocol.
--
-- Run this migration BEFORE deploying the updated bookingController.js.
-- Safe to re-run — uses IF NOT EXISTS / idempotent comments.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- Add commission snapshot column.
-- Stores the commission deducted from bookingValue at booking-creation time.
-- Once written it is immutable — refund and payout logic must read this value,
-- never recalculate it from current settings.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS commission_applied NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- ── Column comments (documentation) ──────────────────────────────────────────

COMMENT ON COLUMN bookings.commission_applied IS
  'Pricing snapshot: platform commission deducted at booking creation. '
  'Immutable after the booking row is inserted.';

COMMENT ON COLUMN bookings.vendor_amount IS
  'Pricing snapshot: vendor payout = booking_value − commission_applied. '
  'Replaces the previous semantics where this stored the raw service price.';

COMMENT ON COLUMN bookings.platform_fee_amount IS
  'Pricing snapshot: tiered platform fee charged to the customer at booking creation. '
  'Immutable after the booking row is inserted.';
