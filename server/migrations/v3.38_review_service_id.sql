-- v3.38 — Backfill reviews.service_id from each review's booking.
--
-- Service pages query reviews by service_id, but createReview historically never
-- set it, so every existing review had service_id = NULL and service pages showed
-- 0 reviews / 0.0 rating (the vendor profile still worked because it queries by
-- host_id). reviewController.createReview now persists service_id at insert; this
-- backfills the rows created before that change.
--
-- Safe + idempotent: only touches rows where service_id IS NULL and the booking
-- still has a service_id. Re-running is a no-op.

UPDATE reviews r
SET service_id = b.service_id
FROM bookings b
WHERE r.booking_id = b.id
  AND r.service_id IS NULL
  AND b.service_id IS NOT NULL;
