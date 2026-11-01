-- ⚠️  NOT THE LIVE SCHEMA — DO NOT TRUST THIS FILE FOR CURRENT COLUMN/CONSTRAINT
--     DEFINITIONS (P3-4). This is the original bootstrap script; the database has
--     since evolved through server/migrations/v1.1 … v3.10x (the source of truth,
--     applied on both prod + staging). This file's CHECK constraints, columns and
--     defaults have DRIFTED from production — e.g. it predates several booking
--     columns and status values. For the real schema, read server/migrations/*.sql
--     (and staging_schema.sql), or introspect the live DB. The sibling
--     migration_v2..v6.sql files here are likewise historical and NOT executed by
--     scripts/migrate.js (which only runs server/migrations/).
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This creates all the tables for the Meeticulous app.

-- ============================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('host', 'guest')),
  username TEXT UNIQUE,
  bio TEXT DEFAULT '',
  tagline TEXT DEFAULT '',
  profile_image TEXT DEFAULT '',
  social_links JSONB DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    LOWER(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', '')) || SUBSTR(NEW.id::TEXT, 1, 4)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. SERVICES
-- ============================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'one_on_one' CHECK (type IN ('one_on_one', 'group', 'paid_dm')),
  duration INTEGER NOT NULL, -- minutes
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  meeting_mode TEXT NOT NULL DEFAULT 'online' CHECK (meeting_mode IN ('online', 'offline')),
  thumbnail_url TEXT DEFAULT '',
  grace_period_minutes INTEGER DEFAULT 10,
  slug TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS services_host_slug_idx ON services(host_id, slug);

-- ============================================
-- 3. AVAILABILITY
-- ============================================
CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  weekly_schedule JSONB DEFAULT '{
    "monday": [], "tuesday": [], "wednesday": [],
    "thursday": [], "friday": [], "saturday": [], "sunday": []
  }',
  blocked_dates JSONB DEFAULT '[]',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  buffer_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. BOOKINGS
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  payment_id TEXT,
  meeting_link TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  vendor_amount NUMERIC DEFAULT 0,
  platform_fee_amount NUMERIC DEFAULT 10,
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  reminder_1h_sent BOOLEAN DEFAULT FALSE,
  reschedule_status TEXT DEFAULT 'none' CHECK (reschedule_status IN ('none', 'awaiting_guest_ack', 'acknowledged')),
  reschedule_ack_token TEXT,
  reschedule_acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, owners can update
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Services: anyone can read active, hosts can manage own
CREATE POLICY "Active services are viewable" ON services FOR SELECT USING (is_active = true);
CREATE POLICY "Hosts can insert own services" ON services FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts can update own services" ON services FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Hosts can delete own services" ON services FOR DELETE USING (auth.uid() = host_id);

-- Availability: anyone can read, hosts can manage own
CREATE POLICY "Availability is viewable" ON availability FOR SELECT USING (true);
CREATE POLICY "Hosts can insert own availability" ON availability FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts can update own availability" ON availability FOR UPDATE USING (auth.uid() = host_id);

-- Bookings: hosts and guests can see their own
CREATE POLICY "Users can view own bookings" ON bookings FOR SELECT
  USING (auth.uid() = host_id OR auth.uid() = guest_id);
-- NOTE: no anon/authenticated INSERT policy — all booking writes go through the
-- Express API with the service_role key (bypasses RLS). The old
-- "Anyone can create bookings" WITH CHECK (true) policy was dropped in v3.69.
CREATE POLICY "Participants can update bookings" ON bookings FOR UPDATE
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

-- ── Write surface lockdown (mirrors v3.27 / v3.69) ──────────────────────────
-- All DB writes flow through Express using the service_role key, which bypasses
-- RLS. The browser uses supabase-js only for GoTrue auth + storage uploads.
-- Revoke write privileges from the browser-facing roles so a base-schema apply
-- (without the migration history) can't leave the anon insert path open. SELECT
-- is left intact. Reversible via GRANT if ever required.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;
