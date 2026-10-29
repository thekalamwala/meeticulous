-- v3.12_settlement_clearing.sql
-- Settlement Engine P2: configurable clearing window (days after a booking's
-- completion before the vendor's earning becomes withdrawable). Idempotent.

INSERT INTO platform_settings (key, value)
VALUES ('settlement_clearing_days', '7')
ON CONFLICT (key) DO NOTHING;

-- Backfill: bookings completed & paid before the settlement columns existed were
-- left at settlement_status='pending_completion' with a null completed_at, so they
-- would never become withdrawable. Stamp them eligible and give completed_at a
-- best-effort timestamp (recognition time, else last-updated). Idempotent.
UPDATE bookings
SET settlement_status = 'eligible_for_settlement',
    completed_at = COALESCE(completed_at, revenue_recognized_at, updated_at)
WHERE status = 'completed'
  AND payment_status = 'paid'
  AND settlement_status = 'pending_completion';
