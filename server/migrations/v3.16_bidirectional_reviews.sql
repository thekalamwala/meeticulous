-- v3.16 — Bidirectional reviews (guest <-> host)
-- Both parties can review each other after a booking is completed.
-- Adds `direction` + `subject_id`, relaxes the one-review-per-booking rule to
-- one-review-per-author-per-booking, and ships the kill switch OFF.

-- 1. Direction of the review.
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'guest_to_host';

-- 2. Who is being reviewed (the subject). For legacy rows that's the host.
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

UPDATE reviews SET subject_id = host_id WHERE subject_id IS NULL;

-- 3. Constrain direction to the two valid values.
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_direction_chk;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_direction_chk
  CHECK (direction IN ('guest_to_host', 'host_to_guest'));

-- 4. Replace UNIQUE(booking_id) with UNIQUE(booking_id, reviewer_id):
--    each party may leave exactly one review per booking.
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_booking_id_key;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_booking_reviewer_key;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_booking_reviewer_key UNIQUE (booking_id, reviewer_id);

-- 5. Index for "reviews received by me" lookups.
CREATE INDEX IF NOT EXISTS idx_reviews_subject ON reviews(subject_id);
CREATE INDEX IF NOT EXISTS idx_reviews_direction ON reviews(direction);

-- 6. Kill switch — ship OFF. The registry will keep the metadata in sync but
--    never flips `enabled`, so this OFF state sticks until an admin turns it on.
--    (scope 'both' = a single switch governs reviews in either direction.)
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'review_submission',
  'Review Submission',
  'Allow guests and hosts to review each other after a completed booking. Off = all new reviews blocked (both directions).',
  'Engagement',
  'both',
  false
)
ON CONFLICT (key) DO UPDATE
  SET enabled = false,
      scope = 'both',
      label = EXCLUDED.label,
      description = EXCLUDED.description,
      category = EXCLUDED.category;
