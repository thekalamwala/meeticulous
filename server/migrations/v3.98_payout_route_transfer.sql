-- v3.98_payout_route_transfer.sql — Razorpay Route Phase 1: transfer bookkeeping
-- on payout_requests.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- Phase 1 replaces the manual "mark paid" step (payoutAdminController.markPayoutPaid,
-- which just recorded a free-text payment_reference) with an actual Razorpay Route
-- TRANSFER-FROM-BALANCE to the host's linked account. An admin still approves and
-- still clicks release ("Pay via Route") — the human gate is unchanged. These
-- columns track the transfer so release + the transfer.* webhook stay idempotent:
--   razorpay_transfer_id   trf_... — the Route transfer (also stored in payment_reference)
--   transfer_status        Razorpay transfer status: 'pending'|'processed'|'failed'|'reversed'
--   transfer_error         last transfer failure reason (retryable)
--
-- Additive only; code keeps a schema fallback until applied on both DBs. The whole
-- path is dormant behind fee_only_mode — no money moves as a result of this migration.

ALTER TABLE payout_requests
  ADD COLUMN IF NOT EXISTS razorpay_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS transfer_status      TEXT,
  ADD COLUMN IF NOT EXISTS transfer_error       TEXT;

-- One payout_request per Route transfer id (partial unique — most rows are NULL).
CREATE UNIQUE INDEX IF NOT EXISTS payout_requests_transfer_uidx
  ON payout_requests (razorpay_transfer_id)
  WHERE razorpay_transfer_id IS NOT NULL;
