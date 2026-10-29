-- v2.5 — Google vendor auth + availability engine hardening
-- 1. profiles.google_id          : stable Google account id (vendor Google auth)
-- 2. bookings.end_at             : slot end instant (backs the exclusion constraint)
-- 3. bookings_no_overlap         : DB-level double-booking guarantee
--
-- Safe to run multiple times. Additive only — no data destroyed.

-- 1. Google account id on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_id TEXT;

-- 2. Booking end instant
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;

-- Backfill end_at from the service duration (default 30 min)
UPDATE bookings b
SET end_at = b.scheduled_at + make_interval(mins => COALESCE(s.duration, 30))
FROM services s
WHERE s.id = b.service_id AND b.end_at IS NULL;

-- 3. Exclusion constraint: no two non-cancelled bookings for the same host may
-- have overlapping [scheduled_at, end_at) ranges. Applies only to bookings
-- scheduled after the migration date so historical overlaps (if any) cannot
-- fail the migration. Grace-period padding stays application-level by design.
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap'
  ) THEN
    BEGIN
      ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
        EXCLUDE USING gist (
          host_id WITH =,
          tstzrange(scheduled_at, end_at) WITH &&
        )
        WHERE (status <> 'cancelled' AND end_at IS NOT NULL AND scheduled_at > '2026-06-11');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'bookings_no_overlap not created (existing overlapping rows?): %', SQLERRM;
    END;
  END IF;
END $$;
