-- ============================================================
-- Meeticulous — v1.6 CATCH-UP MIGRATION
-- Includes: v1.1, v1.2, v1.3, v1.4 (partial), v1.5 (BUG-15)
-- All statements use IF NOT EXISTS — safe to run multiple times.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- ─── PROFILES: add all missing columns ───────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_access_token TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_refresh_token TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_image TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profession TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'explorer'
  CHECK (plan IN ('explorer', 'creator', 'professional'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ;

-- Allow superadmin role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('host', 'guest', 'superadmin'));

-- ─── SERVICES: add all missing columns ───────────────────────

ALTER TABLE services ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT '';
ALTER TABLE services ADD COLUMN IF NOT EXISTS grace_period_minutes INTEGER DEFAULT 10;
ALTER TABLE services ADD COLUMN IF NOT EXISTS short_description TEXT DEFAULT '';
ALTER TABLE services ADD COLUMN IF NOT EXISTS long_description TEXT DEFAULT '';
ALTER TABLE services ADD COLUMN IF NOT EXISTS included_items JSONB DEFAULT '[]';
ALTER TABLE services ADD COLUMN IF NOT EXISTS excluded_items JSONB DEFAULT '[]';
ALTER TABLE services ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]';
ALTER TABLE services ADD COLUMN IF NOT EXISTS important_note TEXT DEFAULT '';
ALTER TABLE services ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS total_bookings INTEGER DEFAULT 0;

-- Unique slug index for services
CREATE UNIQUE INDEX IF NOT EXISTS services_slug_unique_idx ON services(slug);

-- Backfill missing grace periods
UPDATE services SET grace_period_minutes = 10 WHERE grace_period_minutes IS NULL;

-- ─── BOOKINGS: add all missing columns ───────────────────────

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_phone TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vendor_amount NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC DEFAULT 10;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_status TEXT DEFAULT 'none'
  CHECK (reschedule_status IN ('none', 'awaiting_guest_ack', 'acknowledged'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_ack_token TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_acknowledged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_host_scheduled
  ON bookings(host_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_reminders
  ON bookings(status, reminder_24h_sent, reminder_1h_sent, scheduled_at);
CREATE INDEX IF NOT EXISTS bookings_reschedule_ack_token_idx
  ON bookings(reschedule_ack_token)
  WHERE reschedule_ack_token IS NOT NULL;

-- ─── AVAILABILITY: add buffer_minutes ────────────────────────

ALTER TABLE availability ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER DEFAULT 0;

-- ─── OTP CODES TABLE ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS otp_codes (
  email       TEXT PRIMARY KEY,
  otp         TEXT NOT NULL,
  phone       TEXT DEFAULT '',
  type        TEXT DEFAULT 'booking',
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_type ON otp_codes(email, type);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_otp" ON otp_codes;
CREATE POLICY "deny_all_otp" ON otp_codes FOR ALL USING (false);

-- ─── REVIEWS TABLE ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID REFERENCES bookings(id) ON DELETE CASCADE,
  service_id   UUID REFERENCES services(id) ON DELETE CASCADE,
  reviewer_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  host_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rating       INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_host    ON reviews(host_id);
CREATE INDEX IF NOT EXISTS idx_reviews_service ON reviews(service_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reviews viewable by everyone" ON reviews;
CREATE POLICY "Reviews viewable by everyone"
  ON reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON reviews;
CREATE POLICY "Authenticated users can create reviews"
  ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);

-- ─── PLAN PURCHASES TABLE ────────────────────────────────────

CREATE TABLE IF NOT EXISTS plan_purchases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan                TEXT NOT NULL CHECK (plan IN ('creator', 'professional')),
  amount_paid         INTEGER NOT NULL,
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  activated_at        TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_purchases_vendor ON plan_purchases(vendor_id);

ALTER TABLE plan_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors see own plan purchases" ON plan_purchases;
CREATE POLICY "Vendors see own plan purchases"
  ON plan_purchases FOR SELECT USING (auth.uid() = vendor_id);

-- ─── PRODUCTS TABLE ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT DEFAULT '',
  type            TEXT DEFAULT 'pdf'
    CHECK (type IN ('pdf', 'template', 'ebook', 'prompt_pack', 'resource', 'other')),
  price           NUMERIC NOT NULL DEFAULT 0,
  currency        TEXT DEFAULT 'INR',
  file_url        TEXT DEFAULT '',
  thumbnail_url   TEXT DEFAULT '',
  is_active       BOOLEAN DEFAULT TRUE,
  purchase_count  INTEGER DEFAULT 0,
  slug            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_host ON products(host_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active products viewable by everyone" ON products;
CREATE POLICY "Active products viewable by everyone"
  ON products FOR SELECT USING (is_active = TRUE);
DROP POLICY IF EXISTS "Hosts manage own products" ON products;
CREATE POLICY "Hosts manage own products"
  ON products FOR ALL USING (auth.uid() = host_id);

-- ─── PRODUCT PURCHASES TABLE ─────────────────────────────────

CREATE TABLE IF NOT EXISTS product_purchases (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                 UUID REFERENCES products(id) ON DELETE CASCADE,
  host_id                    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  buyer_id                   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  buyer_name                 TEXT,
  buyer_email                TEXT,
  buyer_phone                TEXT DEFAULT '',
  amount_paid                NUMERIC NOT NULL,
  platform_fee               NUMERIC DEFAULT 10,
  payment_status             TEXT DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  razorpay_order_id          TEXT,
  razorpay_payment_id        TEXT,
  download_token             TEXT UNIQUE,
  download_token_expires_at  TIMESTAMPTZ,
  download_count             INTEGER DEFAULT 0,
  created_at                 TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_purchases_token   ON product_purchases(download_token);
CREATE INDEX IF NOT EXISTS idx_product_purchases_product ON product_purchases(product_id);

ALTER TABLE product_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Hosts see own product purchases" ON product_purchases;
CREATE POLICY "Hosts see own product purchases"
  ON product_purchases FOR SELECT USING (auth.uid() = host_id);
DROP POLICY IF EXISTS "Anyone can insert product purchases" ON product_purchases;
CREATE POLICY "Anyone can insert product purchases"
  ON product_purchases FOR INSERT WITH CHECK (true);

-- ─── PLATFORM SETTINGS: add missing keys ─────────────────────

INSERT INTO platform_settings (key, value) VALUES
  ('platform_fee',          '10'),      -- BUG-10: flat ₹ fee (replaces % model)
  ('plan_price_creator',    '99900'),
  ('plan_price_professional','365000'),
  ('plan_limits', '{"explorer":{"services":3,"bookings_per_month":20,"products":0},"creator":{"services":15,"bookings_per_month":-1,"products":5},"professional":{"services":-1,"bookings_per_month":-1,"products":-1}}')
ON CONFLICT (key) DO NOTHING;

-- ─── BUG-15: atomic product purchase count increment ─────────

CREATE OR REPLACE FUNCTION increment_product_purchase_count(row_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE products
  SET purchase_count = COALESCE(purchase_count, 0) + 1
  WHERE id = row_id;
$$;


-- ─── SUPABASE STORAGE BUCKET ─────────────────────────────────
-- Creates the 'images' bucket for profile photos, service thumbnails, cover images.
-- Safe to run if it already exists (ON CONFLICT DO UPDATE).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- Storage RLS policies
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images');

DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
CREATE POLICY "Public can view images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'images');

DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
CREATE POLICY "Authenticated users can update images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'images');

DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
CREATE POLICY "Authenticated users can delete images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'images');

-- ─── Done ─────────────────────────────────────────────────────
-- After running this migration, all features should be fully functional.
