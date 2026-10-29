-- v3.42 — Make bookings.end_at NOT NULL (audit P0-4)
--
-- The ONLY hard double-booking guarantee is the v2.5 exclusion constraint
-- `bookings_no_overlap`, whose predicate is:
--     WHERE status <> 'cancelled' AND end_at IS NOT NULL AND scheduled_at > '2026-06-11'
-- The `end_at IS NOT NULL` clause means ANY booking row inserted with a NULL
-- end_at silently escapes the overlap check. The createBooking schema-cache
-- fallback used to strip end_at (now fixed in code), and a stale PostgREST cache
-- could re-introduce NULL end_at — silently disabling the platform's only
-- concurrency backstop and allowing two guests to book the same slot.
--
-- Making end_at NOT NULL guarantees the `end_at IS NOT NULL` predicate is always
-- satisfied, so the exclusion constraint applies to every (non-cancelled, future)
-- booking unconditionally. The application code always computes end_at =
-- scheduled_at + service duration on insert/reschedule.
--
-- Backfill any legacy NULL rows first (defensive — staging/prod currently have 0)
-- using a conservative 30-minute default so the SET NOT NULL cannot fail.
--
-- NOTE (deliberately deferred, tracked separately): the constraint range uses the
-- raw [scheduled_at, end_at) with no grace/buffer padding (grace stays
-- application-level by design per availabilityService.js), and the historical
-- `scheduled_at > '2026-06-11'` floor is cosmetic (every real booking is after
-- it). Neither is changed here to keep this migration zero-risk (no constraint
-- recreation, so it cannot fail on any pre-existing historical overlap).

UPDATE public.bookings
   SET end_at = scheduled_at + interval '30 minutes'
 WHERE end_at IS NULL;

ALTER TABLE public.bookings
  ALTER COLUMN end_at SET NOT NULL;
