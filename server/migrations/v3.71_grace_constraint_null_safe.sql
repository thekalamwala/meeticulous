-- v3.71 — Make bookings_no_overlap null-safe (closes the v3.70 deploy-ordering gap)
-- ============================================================================
-- v3.70's constraint predicate required `grace_minutes IS NOT NULL`. Between
-- applying v3.70 and deploying the server code that sets grace_minutes on insert,
-- a booking created by the OLD code has grace_minutes = NULL and is therefore
-- EXEMPT from the partial exclusion constraint — silently disabling the
-- double-booking guarantee for new rows during that window.
--
-- FIX: COALESCE null grace to 0 (which pads by nothing → the raw
-- [scheduled_at, end_at) range, i.e. exactly the pre-v3.70 overlap protection)
-- and drop the `grace_minutes IS NOT NULL` predicate, so every eligible row is
-- always covered regardless of code-deploy timing. Rows that DO carry grace
-- (new code) still get the full grace-padded gap = graceA + graceB.
--
-- Existing rows were backfilled non-null by v3.70, so re-adding the constraint
-- validates cleanly (same or looser than v3.70 for those rows).
--
-- Applied on BOTH DBs (prod ayjhlwyzszykqtnaktpb, staging xwvciqkayammbvsidqig)
-- 2026-07-11.
-- ============================================================================

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    host_id WITH =,
    booking_grace_range(scheduled_at, end_at, COALESCE(grace_minutes, 0)) WITH &&
  )
  WHERE (status <> 'cancelled' AND end_at IS NOT NULL AND scheduled_at > '2026-06-11');

-- ── Verify ──
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'bookings_no_overlap';
-- -> COALESCE(grace_minutes, 0), and the predicate no longer mentions grace_minutes.
