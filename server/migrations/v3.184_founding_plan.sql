-- v3.184 — Founding-100 Pro (founder decision 2026-11-03, docs/free-vs-pro-audit.md §0)
--
-- 1. `premium_founding`: an ARCHIVED copy of Pro at today's price. While the first
--    100 paying Pro spots are open, Pro checkouts land on this row
--    (paymentController.createVendorSubscription), so a founding host keeps the
--    founding price through cadence switches. After 100 the admin raises `premium`
--    yearly to ₹1,499 — this row is untouched and keeps renewing. Archived rows still
--    resolve and renew (same pattern as the legacy `creator` partner tier).
-- 2. `is_founding_member` metric on vendor_metrics + an automatic "Founding Member"
--    badge. Automatic = the engine revokes it if the host cancels and lapses, which
--    matches the promise: cancel and the founding status is gone.
-- 3. Drop the phantom subscription_plans.features keys nothing on the server reads
--    (audit §3). Pricing copy already ignores them.
--
-- Additive + idempotent. Code is schema-fallback safe: checkout only routes to
-- premium_founding when the row exists; the badge engine selects * and treats an
-- unknown metric as false.

-- 1 ──────────────────────────────────────────────────────────────────────────────
INSERT INTO subscription_plans
  (name, slug, annual_price, monthly_price, billing_cycle, commission_percentage,
   limits, features, integrations, support_type, active, sort_order)
SELECT 'Pro (Founding)', 'premium_founding', annual_price, monthly_price, billing_cycle,
       commission_percentage, limits, features, integrations, support_type, false, sort_order
  FROM subscription_plans
 WHERE slug = 'premium'
ON CONFLICT (slug) DO NOTHING;

-- 2 ──────────────────────────────────────────────────────────────────────────────
-- Same body as v3.173 with one column appended at the end (CREATE OR REPLACE VIEW
-- may only add columns at the end).
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
    (p.linkedin_verified_at IS NOT NULL)::int::numeric AS linkedin_verified,
    (p.plan = 'premium_founding' AND p.subscription_status = 'active')::int::numeric AS is_founding_member
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

INSERT INTO badges (name, slug, description, category_id, badge_type, is_negative, is_bas_team, status, rule_logic)
SELECT 'Founding Member', 'founding-member',
       'One of the first 100 hosts to back Meeticulous Pro.',
       (SELECT category_id FROM badges WHERE slug = 'google-verified'),
       'automatic', false, false, 'active', 'AND'
 WHERE NOT EXISTS (SELECT 1 FROM badges WHERE slug = 'founding-member');

INSERT INTO badge_rules (badge_id, field, operator, value, group_id)
SELECT id, 'is_founding_member', '=', '1', 0 FROM badges b
 WHERE slug = 'founding-member'
   AND NOT EXISTS (SELECT 1 FROM badge_rules r WHERE r.badge_id = b.id);

-- 3 ──────────────────────────────────────────────────────────────────────────────
UPDATE subscription_plans
   SET features = features
     - 'advanced_reports' - 'data_export' - 'client_notes' - 'custom_fields'
     - 'recurring_clients' - 'multiple_schedules' - 'custom_branding' - 'priority_feature_access'
 WHERE features IS NOT NULL;
