-- v3.173_verification_badges_automatic.sql
--
-- Make "Google Verified" and "LinkedIn Verified" TRUE automatic (engine-owned)
-- badges instead of code-awarded manual ones. v3.172 made them manual as a
-- stop-gap; the correct model is the badge engine owning them so award AND
-- revoke are consistent and they read as "Automatic" in the admin UI.
--
-- The engine evaluates badge_rules against the vendor_metrics view, which only
-- had activity metrics. This adds two boolean (0/1) attribute metrics —
-- has_google_identity and linkedin_verified — then adds one rule per badge and
-- flips both to badge_type='automatic'. Awarding stays instant because
-- authController triggers a scoped badgeEngine.evaluate() on Google login and on
-- LinkedIn verify; the periodic engine run reconciles everyone else.
--
-- Idempotent; run on BOTH DBs (staging Tokyo, prod Mumbai).

-- 1) Extend vendor_metrics with the two attribute metrics (append-only columns,
--    so CREATE OR REPLACE keeps every existing column/position unchanged).
CREATE OR REPLACE VIEW vendor_metrics AS
 SELECT p.id AS vendor_id,
    p.username,
    COALESCE(b.completed_bookings, 0::bigint)::numeric AS completed_bookings,
    COALESCE(b.revenue, 0::numeric) AS revenue,
    COALESCE(r.avg_rating, 0::numeric) AS avg_rating,
    COALESCE(r.review_count, 0::bigint)::numeric AS review_count,
    COALESCE(r.five_star_reviews, 0::bigint)::numeric AS five_star_reviews,
    COALESCE(r.one_star_reviews, 0::bigint)::numeric AS one_star_reviews,
    0::numeric AS avg_response_time_minutes,
    COALESCE(b.active_days, 0::bigint)::numeric AS active_days,
    0::numeric AS login_streak,
    COALESCE(rc.repeat_customers, 0::bigint)::numeric AS repeat_customers,
    COALESCE(b.customer_count, 0::bigint)::numeric AS customer_count,
    COALESCE(b.cancellation_count, 0::bigint)::numeric AS cancellation_count,
    COALESCE(b.days_since_last_booking, EXTRACT(day FROM now() - p.created_at)) AS inactive_days,
    EXTRACT(day FROM now() - p.created_at) AS account_age_days,
    (p.google_id IS NOT NULL)::int::numeric AS has_google_identity,
    (p.linkedin_verified_at IS NOT NULL)::int::numeric AS linkedin_verified
   FROM profiles p
     LEFT JOIN ( SELECT bookings.host_id,
            count(*) FILTER (WHERE bookings.status = 'completed'::text) AS completed_bookings,
            count(*) FILTER (WHERE bookings.status = 'cancelled'::text) AS cancellation_count,
            COALESCE(sum(bookings.vendor_amount) FILTER (WHERE bookings.payment_status = 'paid'::text), 0::numeric) AS revenue,
            count(DISTINCT NULLIF(bookings.guest_email, ''::text)) AS customer_count,
            count(DISTINCT bookings.scheduled_at::date) FILTER (WHERE bookings.status = 'completed'::text) AS active_days,
            GREATEST(0::numeric, EXTRACT(day FROM now() - max(bookings.created_at))) AS days_since_last_booking
           FROM bookings
          GROUP BY bookings.host_id) b ON b.host_id = p.id
     LEFT JOIN ( SELECT reviews.host_id,
            count(*) AS review_count,
            round(avg(reviews.rating), 2) AS avg_rating,
            count(*) FILTER (WHERE reviews.rating = 5) AS five_star_reviews,
            count(*) FILTER (WHERE reviews.rating = 1) AS one_star_reviews
           FROM reviews
          GROUP BY reviews.host_id) r ON r.host_id = p.id
     LEFT JOIN ( SELECT t.host_id,
            count(*) AS repeat_customers
           FROM ( SELECT bookings.host_id,
                    bookings.guest_email
                   FROM bookings
                  WHERE COALESCE(bookings.guest_email, ''::text) <> ''::text
                  GROUP BY bookings.host_id, bookings.guest_email
                 HAVING count(*) >= 2) t
          GROUP BY t.host_id) rc ON rc.host_id = p.id
  WHERE p.role = 'host'::text;

-- 2) Flip both verification badges to automatic (engine-owned).
UPDATE badges SET badge_type = 'automatic', status = 'active'
 WHERE slug IN ('google-verified', 'linkedin-verified');

-- 3) Rules (idempotent): each badge held iff its attribute metric = 1.
DELETE FROM badge_rules
 WHERE badge_id IN (SELECT id FROM badges WHERE slug IN ('google-verified', 'linkedin-verified'));

INSERT INTO badge_rules (badge_id, field, operator, value, group_id)
SELECT id, 'has_google_identity', '=', '1', 0 FROM badges WHERE slug = 'google-verified';

INSERT INTO badge_rules (badge_id, field, operator, value, group_id)
SELECT id, 'linkedin_verified', '=', '1', 0 FROM badges WHERE slug = 'linkedin-verified';

-- Note: existing awards (backfilled in v3.172, assigned_by = null) satisfy their
-- new rule, so the engine keeps them; it will not revoke on the next run.
