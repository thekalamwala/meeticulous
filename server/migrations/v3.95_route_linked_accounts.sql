-- v3.95_route_linked_accounts.sql — Razorpay Route Phase 0: linked-account bridge.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- Route was approved (RZP ticket #20267942) and the Route product is now live in
-- the dashboard. Phase 0 wires host KYC → a Razorpay Route LINKED ACCOUNT so that,
-- once host payouts go live (fee_only_mode → false, a LATER phase), every host
-- already has an `acc_...` to receive transfers-from-balance into. This migration
-- is additive only — it stores the linked-account id + sync bookkeeping on the
-- existing kyc_submissions row. No host money moves as a result of this migration.
--
-- Model: TRANSFER-FROM-BALANCE (not transfer-on-payment). Route transfers are made
-- from the platform balance to the linked account in a later phase; Phase 0 only
-- creates the destination account. Creation is triggered on KYC APPROVAL and is a
-- no-op while fee_only_mode is true (enforced in code — routeAccountService).
--
-- route_status values:
--   'none'    — not yet attempted (default)
--   'pending' — create in flight / awaiting activation on Razorpay's side
--   'created' — linked account exists (razorpay_account_id populated)
--   'error'   — last create attempt failed (see route_error); retryable
--
-- Code keeps a schema fallback (SELECT/UPDATE destructure) until this is confirmed
-- applied on both DBs — a missing column degrades to "no Route sync", never a crash.

ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS razorpay_account_id TEXT,
  ADD COLUMN IF NOT EXISTS route_status        TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS route_error         TEXT,
  ADD COLUMN IF NOT EXISTS route_synced_at     TIMESTAMPTZ;

-- Constrain the status to the known set (drop-and-add so re-runs stay idempotent).
ALTER TABLE kyc_submissions DROP CONSTRAINT IF EXISTS kyc_route_status_chk;
ALTER TABLE kyc_submissions
  ADD CONSTRAINT kyc_route_status_chk
  CHECK (route_status IN ('none', 'pending', 'created', 'error'));

-- One linked account per Razorpay id; partial unique so the many NULLs don't clash.
CREATE UNIQUE INDEX IF NOT EXISTS kyc_razorpay_account_uidx
  ON kyc_submissions (razorpay_account_id)
  WHERE razorpay_account_id IS NOT NULL;

-- Fast lookup of rows still needing a linked account (approved but not yet created).
CREATE INDEX IF NOT EXISTS kyc_route_pending_idx
  ON kyc_submissions (route_status)
  WHERE route_status IN ('none', 'pending', 'error');
