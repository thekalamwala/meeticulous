-- v3.119_holiday_notice_flag.sql — dedup marker for the weekly bank-holiday payout
-- delay notice, so a host is emailed at most once per payout about a holiday delay.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
-- Additive; the notice keeps a schema fallback (skips rather than crashes) until applied.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS holiday_notice_sent_at TIMESTAMPTZ;
