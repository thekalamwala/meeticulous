-- v3.9_payout_approval.sql — admin payout approval workflow.
-- Adds 'paid' status + approval/payment audit columns to payout_requests.
-- Idempotent (IF EXISTS / IF NOT EXISTS). Reject reason reuses admin_note.
-- (v3.8 is taken by monthly_subscriptions — this is v3.9.)

ALTER TABLE payout_requests DROP CONSTRAINT IF EXISTS payout_requests_status_check;
ALTER TABLE payout_requests ADD CONSTRAINT payout_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'paid'));

ALTER TABLE payout_requests
  ADD COLUMN IF NOT EXISTS approved_by       UUID,
  ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by           UUID,
  ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at       TIMESTAMPTZ;
