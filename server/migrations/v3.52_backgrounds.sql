-- server/migrations/v3.52_backgrounds.sql
-- Admin background library: appearance curation + per-host pick.
ALTER TABLE appearance_settings
  ADD COLUMN IF NOT EXISTS backgrounds JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_background TEXT NOT NULL DEFAULT 'dotgrid';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS background_key TEXT;
