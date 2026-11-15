-- ============================================================
-- v3.212 — host_testimonials (host-authored "proof wall" quotes)
-- ------------------------------------------------------------
-- Hosts import praise they already have (WhatsApp screenshots, DMs, emails)
-- and show it as a proof wall on their public profile — a Pro conversion
-- magnet. These are HOST-AUTHORED, NOT verified booking reviews: they live
-- in their own table so they can NEVER pollute the `reviews`-derived public
-- star rating / JSON-LD aggregateRating (a real-reviews-only honesty guard;
-- see reviewController.getHostReviews).
--
-- FREE hosts are capped at 3 rows (enforced in testimonialController on
-- create via planService); Pro is unlimited.
--
-- RLS ON, no policies: service_role only. The public read is done by the
-- Express server with supabaseAdmin — the browser never reads this table
-- through PostgREST (matches the v3.206 anon-write lockdown posture).
--
-- Additive + schema-fallback safe: testimonialController swallows a
-- missing-table error (→ empty list / graceful no-op), so the feature is
-- dormant and harmless until this migration is applied.
--
-- APPLY TO the Meeticulous DB (spquowzrefozmrzoszkf). Idempotent.
-- NOTE: version number may collide cosmetically with another v3.212_* file —
-- harmless, Supabase names migrations independently.
-- ============================================================

CREATE TABLE IF NOT EXISTS host_testimonials (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quote            text NOT NULL,
  author_name      text NOT NULL,
  author_role      text,
  author_image_url text,
  sort_order       int  NOT NULL DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Public proof-wall read: all of a host's testimonials, ordered.
CREATE INDEX IF NOT EXISTS idx_host_testimonials_host
  ON host_testimonials (host_id, sort_order, created_at);

ALTER TABLE host_testimonials ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service_role key (Express server) touches this.
