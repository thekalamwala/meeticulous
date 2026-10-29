-- v3.104 — real cancellation timestamp (P3-2)
--
-- WHY: the stale-hold reaper already tried to write bookings.cancelled_at but the
-- column never existed, so every reap batch hit the "column does not exist"
-- fallback (an extra round-trip) and no cancellation timestamp was ever stored.
-- This adds the column so both cancel paths (cancelBookingRecord + the reaper)
-- record when a booking was cancelled — useful for support/audit and dispute
-- windows.
--
-- Additive + idempotent. Code keeps a schema fallback, so it is safe to apply
-- before/after the code merge. Run on BOTH prod (Mumbai) + staging (Tokyo).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Backfill a best-effort timestamp for already-cancelled rows (updated_at is when
-- the cancel happened for these). New cancellations set it precisely.
UPDATE public.bookings
  SET cancelled_at = updated_at
  WHERE status = 'cancelled' AND cancelled_at IS NULL;
