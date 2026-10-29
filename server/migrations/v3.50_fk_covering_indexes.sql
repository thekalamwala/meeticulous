-- v3.50 — covering indexes for unindexed foreign keys (audit P3-10)
--
-- The Supabase performance advisor flagged these FK columns as unindexed, which
-- means sequential scans on the parent side (e.g. listing a guest's bookings, a
-- reviewer's reviews) and slow ON DELETE checks. Add covering indexes. Cheap and
-- safe (CREATE INDEX IF NOT EXISTS); they only help as data grows.

CREATE INDEX IF NOT EXISTS idx_bookings_guest_id            ON public.bookings (guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service_id          ON public.bookings (service_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id          ON public.reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_product_purchases_buyer_id   ON public.product_purchases (buyer_id);
CREATE INDEX IF NOT EXISTS idx_product_purchases_host_id    ON public.product_purchases (host_id);
