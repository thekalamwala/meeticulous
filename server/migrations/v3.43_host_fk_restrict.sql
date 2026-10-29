-- v3.43 — Block hard-delete of a host that has financial/booking history (audit P1-2)
--
-- BEFORE: deleting a profile CASCADE-deleted everything beneath it:
--     bookings_host_id_fkey      ON DELETE CASCADE
--     services_host_id_fkey      ON DELETE CASCADE  (and services → bookings CASCADE)
--     plan_purchases_vendor_id   ON DELETE CASCADE
-- profiles.id itself CASCADEs from auth.users, so deleting a GoTrue user (or any
-- admin "delete user" path) silently erased all of that host's paid/completed
-- bookings and the guests' records of those transactions — while the immutable
-- double-entry ledger (no FK to bookings) kept the money rows. Books and
-- operational data diverge permanently. Irreversible.
--
-- FIX: switch the host references on booking/financial-bearing tables to
-- ON DELETE RESTRICT. A host with any service, booking, or plan purchase can no
-- longer be hard-deleted — the delete fails loudly instead of destroying history.
-- Hosts should be soft-disabled (profiles.is_banned), never hard-deleted.
--
-- Changing services.host_id to RESTRICT also breaks the host→services→bookings
-- cascade chain, so bookings are protected on host deletion. A host can still
-- delete their OWN service (bookings.service_id stays CASCADE — unchanged
-- behaviour, separate concern); only deletion of the HOST is now blocked.
--
-- product_purchases.host_id / buyer_id are already ON DELETE SET NULL (the
-- purchase record survives a deleted host) — left as-is.

ALTER TABLE public.bookings       DROP CONSTRAINT IF EXISTS bookings_host_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_host_id_fkey
  FOREIGN KEY (host_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.services       DROP CONSTRAINT IF EXISTS services_host_id_fkey;
ALTER TABLE public.services
  ADD CONSTRAINT services_host_id_fkey
  FOREIGN KEY (host_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.plan_purchases DROP CONSTRAINT IF EXISTS plan_purchases_vendor_id_fkey;
ALTER TABLE public.plan_purchases
  ADD CONSTRAINT plan_purchases_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
