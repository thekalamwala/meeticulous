-- ============================================================
-- Migration: Vendor / User Separation
-- Run this in Supabase SQL Editor (or supabase db push).
-- ============================================================

-- 1. Ensure role column exists and has a proper check constraint
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'guest';

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('host', 'guest', 'superadmin'));

-- 2. One email can only exist with ONE role.
--    If the same person wants to be both vendor and guest they need two accounts.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_email_role_unique;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_email_role_unique UNIQUE (email, role);

-- 3. vendor_profiles — vendor-specific extended data (avoids polluting the guest profiles table)
CREATE TABLE IF NOT EXISTS vendor_profiles (
  id              UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  business_name   TEXT,
  category        TEXT,
  tagline         TEXT,
  bio             TEXT,
  profession      TEXT,
  location        TEXT,
  theme_color     TEXT DEFAULT '#FE5100',
  cover_image     TEXT,
  social_links    JSONB DEFAULT '{}',
  badges          JSONB DEFAULT '[]',
  plan            TEXT NOT NULL DEFAULT 'explorer'
                  CHECK (plan IN ('explorer', 'creator', 'professional')),
  plan_expires_at TIMESTAMPTZ,
  is_verified     BOOLEAN DEFAULT FALSE,
  total_bookings  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Back-fill vendor_profiles from existing host profiles
INSERT INTO vendor_profiles (id, bio, profession, location, theme_color, cover_image, social_links, badges, plan, plan_expires_at, is_verified, updated_at)
SELECT
  p.id,
  p.bio,
  p.profession,
  p.location,
  p.theme_color,
  p.cover_image,
  COALESCE(p.social_links, '{}'),
  COALESCE(p.badges, '[]'),
  COALESCE(p.plan, 'explorer'),
  p.plan_expires_at,
  COALESCE(p.is_verified, FALSE),
  NOW()
FROM profiles p
WHERE p.role = 'host'
ON CONFLICT (id) DO NOTHING;

-- 4. RLS policies for vendor_profiles
ALTER TABLE vendor_profiles ENABLE ROW LEVEL SECURITY;

-- Public read (public profiles are visible to all)
DROP POLICY IF EXISTS vendor_profiles_public_read ON vendor_profiles;
CREATE POLICY vendor_profiles_public_read ON vendor_profiles
  FOR SELECT USING (TRUE);

-- Vendor can update their own row
DROP POLICY IF EXISTS vendor_profiles_self_update ON vendor_profiles;
CREATE POLICY vendor_profiles_self_update ON vendor_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role can do anything (server-side admin)
DROP POLICY IF EXISTS vendor_profiles_service_all ON vendor_profiles;
CREATE POLICY vendor_profiles_service_all ON vendor_profiles
  USING (auth.role() = 'service_role');

-- 5. Fix otp_codes RLS — allow service role unrestricted access
ALTER TABLE IF EXISTS otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS otp_codes_service_all ON otp_codes;
CREATE POLICY otp_codes_service_all ON otp_codes
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 6. Bookings: add explicit guest_profile_id FK separate from host_id
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS guest_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Back-fill from guest_id where it exists
UPDATE bookings SET guest_profile_id = guest_id::UUID WHERE guest_id IS NOT NULL;

COMMENT ON COLUMN bookings.guest_profile_id IS 'FK to profiles(id) for the guest. Separate from host_id (vendor).';
COMMENT ON COLUMN bookings.host_id IS 'FK to profiles(id) where role=host. Vendor who owns the service.';

-- Done.
