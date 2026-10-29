-- v3.45 — Add 'no_show' booking status (audit P1-6)
--
-- BEFORE: there was no way to record a no-show. autoCompleteBookings flipped
-- every past 'confirmed' booking to 'completed', so a guest who never showed up
-- was auto-marked completed — the host was paid and the guest was prompted to
-- review a session that never happened, with no dispute trail.
--
-- FIX: add a terminal 'no_show' status. The host marks a confirmed, past booking
-- as no_show (bookingController.markNoShow). Treatment is host-favourable: a paid
-- no-show is settlement-eligible (the host showed up), but it is a distinct,
-- auditable state — not silently "completed". autoCompleteBookings only touches
-- status='confirmed', so a no_show is never auto-rewritten.

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show'));
