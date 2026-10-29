-- v3.124_booking_transfer_settlement.sql — track the LAST payout hop:
-- Razorpay Route settlement of a processed transfer to the host's actual bank.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- Until now we tracked bookings.transfer_status (created|pending|processed|failed|
-- reversed) = money moved platform -> the host's Route LINKED-ACCOUNT balance. But
-- "processed" is NOT "in the host's bank" — Razorpay settles the linked-account
-- balance to bank on its own schedule (T+n), and we stored nothing about it. So
-- "did the host actually get paid?" was invisible in-app (a real support blind spot:
-- a host with 9 processed-but-unsettled transfers looked paid, wasn't).
--
-- These columns mirror Razorpay's transfer.settlement_status so the settlement.processed
-- webhook (and the reconciler catch-up) can record the final hop:
--   transfer_settlement_status  'pending' | 'on_hold' | 'settled'  (Razorpay's field)
--   transfer_settled_at         when it reached the host's bank (settlement.processed)
--   recipient_settlement_id     Razorpay recipient settlement id (setl_...), the join key
--
-- Additive only; code keeps a schema fallback until applied on both DBs. No money moves.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS transfer_settlement_status TEXT,
  ADD COLUMN IF NOT EXISTS transfer_settled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recipient_settlement_id    TEXT,
  ADD COLUMN IF NOT EXISTS settlement_email_sent_at   TIMESTAMPTZ;

-- Reconciler catch-up query: processed transfers not yet confirmed settled to bank.
CREATE INDEX IF NOT EXISTS bookings_unsettled_transfer_idx
  ON bookings (transfer_status)
  WHERE razorpay_transfer_id IS NOT NULL AND transfer_settled_at IS NULL;
