-- v3.19_service_seo.sql
-- Admin-managed SEO for services AND host profiles + dynamic-sitemap support.
--
-- SEO fields are ADMIN-controlled (set in /admin/services and /admin/providers).
-- Vendors keep control of title + URL slug; they never see/edit these columns.
-- Canonical URLs are NOT stored — they are derived from the live public URL
-- (https://meeticulous.com/<username>[/<slug>]) at render time.
--
-- is_indexable gates two things: (1) robots <meta> on the public page, and
-- (2) inclusion in the dynamic sitemap. Default TRUE so a newly-verified vendor
-- and their services are immediately indexable with no extra admin step.
--
-- Additive + idempotent. Existing rows are untouched (NULL SEO = use fallbacks
-- in code: service.title / short_description / thumbnail_url, host name / bio /
-- profile_image). Run in Supabase SQL Editor (or npm run migrate:*).

-- ── Services ───────────────────────────────────────────────────────────────
ALTER TABLE services ADD COLUMN IF NOT EXISTS seo_title       text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS seo_description text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS og_title        text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS og_description  text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS seo_image       text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_indexable    boolean NOT NULL DEFAULT true;
ALTER TABLE services ADD COLUMN IF NOT EXISTS seo_updated_at  timestamptz;
-- text (admin identifier/email), not an FK — admins aren't necessarily a
-- profiles row, and the audit log already holds the full actor record.
ALTER TABLE services ADD COLUMN IF NOT EXISTS seo_updated_by  text;

-- Cheap scan for the sitemap: only active + indexable services qualify.
CREATE INDEX IF NOT EXISTS idx_services_sitemap
  ON services (host_id)
  WHERE is_active = true AND is_indexable = true;

-- ── Host profiles ──────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_title       text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_description text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS og_title        text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS og_description  text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_image       text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_indexable    boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_updated_at  timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_updated_by  text;

-- Sitemap host scan: verified, indexable, non-banned hosts that have a username.
CREATE INDEX IF NOT EXISTS idx_profiles_sitemap
  ON profiles (username)
  WHERE role = 'host' AND is_verified = true AND is_indexable = true AND is_banned = false;
