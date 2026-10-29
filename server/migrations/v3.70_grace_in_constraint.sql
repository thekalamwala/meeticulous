-- v3.70 — Move per-service grace into the bookings_no_overlap exclusion constraint
-- ============================================================================
-- WHY: the v2.5 constraint uses the RAW range [scheduled_at, end_at). Grace was
-- enforced only in the app-level validateSlot (bookingController.js:309), which
-- is a racy pre-check that runs BEFORE the per-host mutex. Under concurrency two
-- bookings that don't raw-overlap but sit inside the grace window both pass the
-- check and both commit — proven by scripts/sameSlotBurst.js scenario 2
-- (5/5 rounds double-committed on staging, 2026-07-11). Not a double-booking
-- (no real time overlap) but a tighter-than-configured gap; the fix is to let the
-- DB enforce grace atomically, the same way it already enforces raw overlap.
--
-- MODEL: each booking carries its own grace snapshot (grace_minutes), padded onto
-- BOTH ends of its range. Two padded ranges overlap iff the gap between the
-- bookings is < graceA + graceB — exactly the double-sided rule validateSlot
-- applies (availabilityService.js:280,308). Snapshot semantics match the existing
-- "always snapshot pricing" rule: a later change to services.grace_period_minutes
-- does not retroactively move existing bookings.
--
-- Apply on BOTH DBs (prod ayjhlwyzszykqtnaktpb, staging xwvciqkayammbvsidqig).
-- Keep the code-side fallback (bookingController.js strips grace_minutes) until
-- this is confirmed applied everywhere.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;  -- already present since v2.5; no-op

-- 0. Immutable padding helper. `timestamptz ± interval` is labelled STABLE by
--    Postgres (a blanket DST guard for month/day intervals) and so is rejected in
--    an index expression (42P17). But grace is ALWAYS whole minutes — a fixed
--    60s/unit shift that is genuinely timezone-invariant — so wrapping the
--    minutes-only arithmetic in an IMMUTABLE function is correct, not a lie: the
--    result never varies with session TimeZone. This lets the padded range be
--    indexed by the exclusion constraint below.
CREATE OR REPLACE FUNCTION booking_grace_range(_start timestamptz, _end timestamptz, _grace_min integer)
RETURNS tstzrange
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT tstzrange(_start - make_interval(mins => _grace_min), _end + make_interval(mins => _grace_min));
$$;

-- 1. Snapshot column.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS grace_minutes INTEGER;

-- 2. Backfill from the service; fall back to the app default (10) for orphans
--    (service deleted) so no row participating in the constraint is left NULL.
UPDATE bookings b
   SET grace_minutes = COALESCE(s.grace_period_minutes, 10)
  FROM services s
 WHERE b.service_id = s.id AND b.grace_minutes IS NULL;
UPDATE bookings SET grace_minutes = 10 WHERE grace_minutes IS NULL;

-- 3. Pre-flight: abort loudly if any live pair already violates the grace-padded
--    range, so the ADD CONSTRAINT below can't error out mid-swap and leave the
--    table with NO overlap constraint. Expected count on a clean DB: 0.
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM bookings a JOIN bookings b
      ON a.host_id = b.host_id AND a.id < b.id
     AND a.status <> 'cancelled'  AND b.status <> 'cancelled'
     AND a.end_at IS NOT NULL     AND b.end_at IS NOT NULL
     AND a.scheduled_at > '2026-06-11' AND b.scheduled_at > '2026-06-11'
     AND booking_grace_range(a.scheduled_at, a.end_at, a.grace_minutes)
      && booking_grace_range(b.scheduled_at, b.end_at, b.grace_minutes);
  IF n > 0 THEN
    RAISE EXCEPTION 'v3.70 abort: % existing booking pair(s) violate the grace-padded range; reconcile before swapping.', n;
  END IF;
END $$;

-- 4. Swap raw-range -> grace-padded range. All expressions are IMMUTABLE, so this
--    is a valid GiST exclusion index. Predicate mirrors v2.5 plus grace_minutes IS
--    NOT NULL (a NULL-grace row would produce a NULL range and silently opt out).
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    host_id WITH =,
    booking_grace_range(scheduled_at, end_at, grace_minutes) WITH &&
  )
  WHERE (status <> 'cancelled' AND end_at IS NOT NULL
         AND grace_minutes IS NOT NULL AND scheduled_at > '2026-06-11');

-- ── Verify (run after applying) ──
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'bookings_no_overlap';
-- -> should show the make_interval(mins => grace_minutes) padded range.
