-- v3.185 — platform reviews (reviews OF Meeticulous, by signed-in hosts/guests).
--
-- Distinct from `reviews` (guest <-> host, per completed booking). One row per
-- account; submitted from /submit-review. Every row is tied to a real signed-in
-- profile — there is no anonymous path, so a review here is always verifiable.
--
-- Publishing (marketing: Wall of Love, public pages, social) requires BOTH:
--   status = 'approved'  (admin moderation)  AND  consent_public = true
-- consented_at records WHEN the person agreed to public use of name/photo/review
-- (endorsement-consent evidence). An edit resets status to 'pending' so changed
-- text is re-moderated before it can appear publicly again.
--
-- Additive. RLS on with NO client policies — all access is server-side via the
-- service-role client (same model as `feedback`).

CREATE TABLE IF NOT EXISTS platform_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_role   text NOT NULL CHECK (reviewer_role IN ('host', 'guest')),
  rating          int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title           text CHECK (char_length(title) <= 120),
  body            text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000),
  consent_public  boolean NOT NULL DEFAULT false,
  consented_at    timestamptz,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note      text,
  moderated_at    timestamptz,
  moderated_by    uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Public read path: approved + consented only.
CREATE INDEX IF NOT EXISTS idx_platform_reviews_public
  ON platform_reviews (created_at DESC) WHERE status = 'approved' AND consent_public;
CREATE INDEX IF NOT EXISTS idx_platform_reviews_status ON platform_reviews (status);

ALTER TABLE platform_reviews ENABLE ROW LEVEL SECURITY;
