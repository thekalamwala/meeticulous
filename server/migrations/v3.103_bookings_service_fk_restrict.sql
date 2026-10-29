-- v3.103 — protect booking history: bookings.service_id FK → ON DELETE RESTRICT (P2-16)
--
-- WHY: bookings_service_id_fkey was ON DELETE CASCADE, so deleting a service
-- silently deleted ALL of its bookings — including paid + completed ones (their
-- financial / audit history). host_id was already flipped to RESTRICT (v3.43) for
-- exactly this reason; service_id was missed. This aligns them.
--
-- The deleteService endpoints (serviceController + hostController) now catch the
-- resulting 23503 and DEACTIVATE the service (is_active=false) instead of hard-
-- deleting when bookings exist — the service drops off the public profile while
-- the booking records survive.
--
-- Safe: every booking already references a live service (CASCADE never left
-- danglers), so the stricter constraint adds cleanly. Idempotent via DROP IF
-- EXISTS. Run on BOTH prod (Mumbai) + staging (Tokyo).

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_service_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;
