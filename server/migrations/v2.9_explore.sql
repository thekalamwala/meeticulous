-- ============================================================
-- v2.9 — Explore Page Revenue Infrastructure
-- Tables for: featured slots, sponsored keywords, collections,
-- boosts, and verified badges.
-- Apply via: Supabase SQL Editor → New Query
-- ============================================================

-- ── 1. FEATURED SLOTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS explore_featured_slots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_position INT  NOT NULL DEFAULT 1 CHECK (slot_position BETWEEN 1 AND 5),
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  price_paid   NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_ref  TEXT,
  notes        TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_explore_featured_vendor ON explore_featured_slots(vendor_id);
CREATE INDEX IF NOT EXISTS idx_explore_featured_active  ON explore_featured_slots(is_active, ends_at);

-- ── 2. SPONSORED KEYWORDS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS explore_sponsored_keywords (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  keyword     TEXT NOT NULL,
  bid_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  payment_ref TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_explore_kw_keyword ON explore_sponsored_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_explore_kw_vendor  ON explore_sponsored_keywords(vendor_id);
CREATE INDEX IF NOT EXISTS idx_explore_kw_active  ON explore_sponsored_keywords(is_active, ends_at);

-- ── 3. COLLECTIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS explore_collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  subtitle    TEXT,
  slug        TEXT NOT NULL UNIQUE,
  icon_emoji  TEXT DEFAULT '✨',
  sort_order  INT  DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  is_paid     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO explore_collections (title, subtitle, slug, icon_emoji, sort_order, is_active) VALUES
  ('Top Picks',   'Hand-curated by the Book A Sloth team',     'top-picks',  '🏆', 1, TRUE),
  ('New Sloths',  'Recently joined, high potential',            'new-sloths', '🌱', 2, TRUE),
  ('Under ₹500', 'Great sessions that won''t break the bank',  'under-500',  '💸', 3, TRUE)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS explore_collection_vendors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES explore_collections(id) ON DELETE CASCADE,
  vendor_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sort_order    INT  DEFAULT 0,
  added_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (collection_id, vendor_id)
);
CREATE INDEX IF NOT EXISTS idx_ecv_collection ON explore_collection_vendors(collection_id);
CREATE INDEX IF NOT EXISTS idx_ecv_vendor     ON explore_collection_vendors(vendor_id);

-- ── 4. BOOSTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS explore_boosts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  boost_type   TEXT NOT NULL DEFAULT 'standard' CHECK (boost_type IN ('standard', 'premium')),
  multiplier   NUMERIC(3,1) NOT NULL DEFAULT 1.5,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  price_paid   NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_ref  TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_explore_boosts_vendor ON explore_boosts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_explore_boosts_active ON explore_boosts(is_active, ends_at);

-- ── 5. VERIFIED BADGES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS explore_verified_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  verified_at TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  price_paid  NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_ref TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_explore_verified_active ON explore_verified_badges(is_active, expires_at);

-- ── 6. CATEGORY SPONSORSHIP ──────────────────────────────────
CREATE TABLE IF NOT EXISTS explore_category_sponsors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  price_paid   NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_ref  TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (category_id, starts_at)
);
CREATE INDEX IF NOT EXISTS idx_explore_cat_sponsor_active ON explore_category_sponsors(is_active, ends_at);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE explore_featured_slots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_sponsored_keywords  ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_collections         ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_collection_vendors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_boosts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_verified_badges     ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_category_sponsors   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_featured"    ON explore_featured_slots     FOR SELECT USING (is_active = TRUE);
CREATE POLICY "public_read_kw"          ON explore_sponsored_keywords FOR SELECT USING (is_active = TRUE);
CREATE POLICY "public_read_collections" ON explore_collections        FOR SELECT USING (is_active = TRUE);
CREATE POLICY "public_read_ecv"         ON explore_collection_vendors FOR SELECT USING (TRUE);
CREATE POLICY "public_read_boosts"      ON explore_boosts             FOR SELECT USING (is_active = TRUE);
CREATE POLICY "public_read_verified"    ON explore_verified_badges    FOR SELECT USING (is_active = TRUE);
CREATE POLICY "public_read_cat_sponsor" ON explore_category_sponsors  FOR SELECT USING (is_active = TRUE);
