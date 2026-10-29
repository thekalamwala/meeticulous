-- v3.99_booking_auto_payout.sql — Razorpay Route Phase 2: automatic host payout
-- via a payment-linked HELD transfer, created at booking capture.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- On payment capture, if the host has an activated Route linked account, we create
-- a HELD transfer of their vendor_amount (on_hold_until = service end + 24h). It
-- releases when the CUSTOMER marks the booking complete (instant) or auto-releases
-- at the hold timestamp; it is REVERSED on refund / cancel / dispute. These columns
-- track that per booking so the flow is idempotent + resumable.
--   razorpay_transfer_id   trf_... — the held Route transfer for this booking
--   transfer_status        'pending' | 'processed' (released) | 'failed' | 'reversed'
--   transfer_error         last transfer failure reason (retryable)
--   transfer_hold_until    when Razorpay will auto-release if not released early
--   transfer_released_at   when the hold was actually released (host paid)
--
-- Additive only; code keeps a schema fallback until applied on both DBs. Dormant
-- behind fee_only_mode — no transfer is created while fee-only mode is on.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS razorpay_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS transfer_status      TEXT,
  ADD COLUMN IF NOT EXISTS transfer_error       TEXT,
  ADD COLUMN IF NOT EXISTS transfer_hold_until  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transfer_released_at TIMESTAMPTZ;

-- One booking per Route transfer id (partial unique — most rows are NULL).
CREATE UNIQUE INDEX IF NOT EXISTS bookings_transfer_uidx
  ON bookings (razorpay_transfer_id)
  WHERE razorpay_transfer_id IS NOT NULL;

-- Fast lookup of held transfers still awaiting release (release/reverse workers).
CREATE INDEX IF NOT EXISTS bookings_transfer_pending_idx
  ON bookings (transfer_status)
  WHERE transfer_status = 'pending';
