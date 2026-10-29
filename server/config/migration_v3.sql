-- Run this in Supabase SQL Editor
-- Adds fields for redesigned profile, badges, and service slugs

-- Profile enhancements
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_image TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profession TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]';

-- Expand social_links to include fb, ig, github (already JSONB, just document new keys)
-- social_links: { linkedin, twitter, instagram, facebook, github, website, email }

-- Service slug for clean URLs
ALTER TABLE services ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index on slug per host
CREATE UNIQUE INDEX IF NOT EXISTS services_host_slug_idx ON services(host_id, slug);

-- Booking: add phone field
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_phone TEXT DEFAULT '';

-- Function to auto-generate slug from title
CREATE OR REPLACE FUNCTION generate_service_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := LOWER(REGEXP_REPLACE(REGEXP_REPLACE(NEW.title, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'));
    -- Append random chars to avoid collisions
    NEW.slug := NEW.slug || '-' || SUBSTR(NEW.id::TEXT, 1, 4);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_service_slug ON services;
CREATE TRIGGER set_service_slug
  BEFORE INSERT ON services
  FOR EACH ROW EXECUTE FUNCTION generate_service_slug();

-- Backfill slugs for existing services
UPDATE services SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(title, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g')) || '-' || SUBSTR(id::TEXT, 1, 4) WHERE slug IS NULL;
