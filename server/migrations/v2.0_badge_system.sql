-- ============================================================
-- v2.0 — Badge System
-- Rules-driven credentialing layer. All badge logic lives in
-- rows, not code. Run in Supabase SQL Editor (already applied
-- via MCP on 2026-06-10).
-- ============================================================

CREATE TABLE IF NOT EXISTS badge_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE badge_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  image_url   VARCHAR(500) DEFAULT '',
  category_id UUID REFERENCES badge_categories(id),
  badge_type  TEXT NOT NULL DEFAULT 'manual'  CHECK (badge_type IN ('automatic','manual')),
  is_negative BOOLEAN DEFAULT FALSE,
  is_bas_team BOOLEAN DEFAULT FALSE,
  status      TEXT NOT NULL DEFAULT 'draft'   CHECK (status IN ('draft','active','archived')),
  rule_logic  TEXT NOT NULL DEFAULT 'AND'     CHECK (rule_logic IN ('AND','OR')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS badge_rules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id   UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  field      VARCHAR(60) NOT NULL,
  operator   VARCHAR(2)  NOT NULL CHECK (operator IN ('=','>','<','>=','<=')),
  value      NUMERIC NOT NULL,
  group_id   INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_badge_rules_badge ON badge_rules (badge_id);
ALTER TABLE badge_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS vendor_badges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id          UUID NOT NULL REFERENCES badges(id)   ON DELETE CASCADE,
  assigned_by       UUID,                -- null = engine
  assigned_at       TIMESTAMPTZ DEFAULT now(),
  reason            TEXT,
  revoked_by        UUID,
  revoked_at        TIMESTAMPTZ,
  revocation_reason TEXT
);
-- One ACTIVE award per vendor+badge; revoked rows preserved as history
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_badge_active
  ON vendor_badges (vendor_id, badge_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_badges_vendor ON vendor_badges (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_badges_badge  ON vendor_badges (badge_id);
ALTER TABLE vendor_badges ENABLE ROW LEVEL SECURITY;

-- ── Metric snapshot view: one batched read for the engine, no N+1 ──
-- avg_response_time_minutes and login_streak have no data source yet:
-- exposed as 0 so rules referencing them are valid but never satisfied (>0).
CREATE OR REPLACE VIEW vendor_metrics AS
SELECT
  p.id AS vendor_id,
  p.username,
  COALESCE(b.completed_bookings, 0)::numeric                    AS completed_bookings,
  COALESCE(b.revenue, 0)::numeric                                AS revenue,
  COALESCE(r.avg_rating, 0)::numeric                             AS avg_rating,
  COALESCE(r.review_count, 0)::numeric                           AS review_count,
  COALESCE(r.five_star_reviews, 0)::numeric                      AS five_star_reviews,
  COALESCE(r.one_star_reviews, 0)::numeric                       AS one_star_reviews,
  0::numeric                                                     AS avg_response_time_minutes,
  COALESCE(b.active_days, 0)::numeric                            AS active_days,
  0::numeric                                                     AS login_streak,
  COALESCE(rc.repeat_customers, 0)::numeric                      AS repeat_customers,
  COALESCE(b.customer_count, 0)::numeric                         AS customer_count,
  COALESCE(b.cancellation_count, 0)::numeric                     AS cancellation_count,
  COALESCE(b.days_since_last_booking,
           EXTRACT(DAY FROM now() - p.created_at))::numeric      AS inactive_days,
  EXTRACT(DAY FROM now() - p.created_at)::numeric                AS account_age_days
FROM profiles p
LEFT JOIN (
  SELECT host_id,
    COUNT(*) FILTER (WHERE status = 'completed')                              AS completed_bookings,
    COUNT(*) FILTER (WHERE status = 'cancelled')                              AS cancellation_count,
    COALESCE(SUM(vendor_amount) FILTER (WHERE payment_status = 'paid'), 0)    AS revenue,
    COUNT(DISTINCT NULLIF(guest_email, ''))                                   AS customer_count,
    COUNT(DISTINCT (scheduled_at::date)) FILTER (WHERE status = 'completed')  AS active_days,
    GREATEST(0, EXTRACT(DAY FROM now() - MAX(created_at)))                    AS days_since_last_booking
  FROM bookings GROUP BY host_id
) b ON b.host_id = p.id
LEFT JOIN (
  SELECT host_id,
    COUNT(*)                              AS review_count,
    ROUND(AVG(rating)::numeric, 2)        AS avg_rating,
    COUNT(*) FILTER (WHERE rating = 5)    AS five_star_reviews,
    COUNT(*) FILTER (WHERE rating = 1)    AS one_star_reviews
  FROM reviews GROUP BY host_id
) r ON r.host_id = p.id
LEFT JOIN (
  SELECT host_id, COUNT(*) AS repeat_customers FROM (
    SELECT host_id, guest_email FROM bookings
    WHERE COALESCE(guest_email, '') <> ''
    GROUP BY host_id, guest_email HAVING COUNT(*) >= 2
  ) t GROUP BY host_id
) rc ON rc.host_id = p.id
WHERE p.role = 'host';

-- ── Seed categories ──
INSERT INTO badge_categories (name, sort_order) VALUES
  ('Performance', 1), ('Quality', 2), ('Community', 3), ('BAS Team', 4), ('Risk', 5)
ON CONFLICT (name) DO NOTHING;

-- ── Seed the 10 default BAS Team badges (manual-only, active) ──
INSERT INTO badges (name, slug, description, badge_type, is_bas_team, status, category_id)
SELECT v.name, v.slug, v.description, 'manual', TRUE, 'active',
       (SELECT id FROM badge_categories WHERE name = 'BAS Team')
FROM (VALUES
  ('Top Pick by BAS Team',         'top-pick-by-bas-team',         'Editorial endorsement of exceptional vendor quality'),
  ('Verified Sessions by BAS Team','verified-sessions-by-bas-team','BAS staff have attended and verified a live session'),
  ('Team Member of Book A Sloth',  'team-member-of-book-a-sloth',  'Vendor is an internal team member offering sessions'),
  ('Vendor of the Month',          'vendor-of-the-month',          'Monthly editorial spotlight recognition'),
  ('Trusted Professional',         'trusted-professional',         'Background/credential verification completed by BAS'),
  ('Community Champion',           'community-champion',           'Exceptional contribution to platform community'),
  ('BAS Certified',                'bas-certified',                'Completed BAS certification program'),
  ('Rising Star',                  'rising-star',                  'Exceptional early trajectory — flagged by BAS team'),
  ('Premium Partner',              'premium-partner',              'Elevated partnership tier with BAS'),
  ('Founding Vendor',              'founding-vendor',              'One of the original vendors at BAS launch')
) AS v(name, slug, description)
ON CONFLICT (name) DO NOTHING;
