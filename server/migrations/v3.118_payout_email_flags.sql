-- v3.118_payout_email_flags.sql — per-recipient dedup markers for host payout/
-- settlement lifecycle emails, so a re-run (reconciler every 15 min) never re-sends.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- Each email claims its flag atomically (UPDATE ... WHERE flag IS NULL RETURNING) —
-- only the first caller wins and sends. All additive; code keeps a schema fallback
-- (skips the email rather than crashing) until applied.
--   bookings.payout_email_sent_at        "₹X on its way to your bank" (on release)
--   bookings.payout_failed_email_sent_at "payout couldn't complete" (transfer failed)
--   bookings.reversal_email_sent_at       "earning reversed" (refund/cancel clawback)
--   kyc_submissions.activation_email_sent_at "finish verifying" (activation stuck) —
--     one-time per host so the 15-min reconciler never re-nudges.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payout_email_sent_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_failed_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversal_email_sent_at      TIMESTAMPTZ;

ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS activation_email_sent_at TIMESTAMPTZ;
