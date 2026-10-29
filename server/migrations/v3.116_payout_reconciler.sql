-- v3.116_payout_reconciler.sql — safety net for the host payout rail.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- The automatic Route payout (v3.99) is a single fire-and-forget attempt at
-- capture with no retry, no backfill, and no reconciliation — so a booking whose
-- transfer was skipped (host not yet onboarded), failed, or is stuck held after a
-- missed transfer.processed webhook is never healed. This migration adds the small
-- bookkeeping the payoutReconciler cron needs to retry safely with a cap, and a
-- tri-state mode switch so the cron is dormant / observe-only / live by config.
--
--   bookings.transfer_attempts        how many times the reconciler has tried to
--                                     create this booking's transfer (retry cap)
--   bookings.transfer_last_attempt_at when it last tried (for backoff/debugging)
--
-- Additive only; the reconciler keeps a schema fallback until this is applied.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS transfer_attempts        INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_last_attempt_at TIMESTAMPTZ;

-- Candidate lookup: paid bookings that owe the host money but have no transfer yet.
-- (partial — most paid bookings either already have a transfer or owe nothing.)
CREATE INDEX IF NOT EXISTS bookings_payout_pending_idx
  ON bookings (payment_status)
  WHERE payment_status = 'paid' AND razorpay_transfer_id IS NULL;

-- Reconciler mode: 'off' (dormant) | 'observe' (scan + alert, no money moves) |
-- 'live' (create/retry/finalize transfers). Seeded 'observe' so breakage is
-- surfaced by email out of the box while money movement stays an explicit opt-in.
-- The code defaults to 'observe' when the row is absent, so this seed is only for
-- admin visibility/editability.
-- value is JSON — store the mode as a JSON string ('"observe"'), matching how
-- fee_only_mode et al. are stored. platformConfig.toMode unwraps the JSON layer.
INSERT INTO platform_settings (key, value)
VALUES ('payout_reconciler_mode', '"observe"')
ON CONFLICT (key) DO NOTHING;
