-- Run in Supabase SQL Editor
-- Adds superadmin role support

-- Update the role check constraint to allow 'superadmin'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('host', 'guest', 'superadmin'));

-- Add is_banned and admin_notes fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT '';

-- Platform settings table
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO platform_settings (key, value) VALUES
  ('platform_name', '"Book A Sloth"'),
  ('platform_fee_percent', '0'),
  ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

-- RLS for platform_settings.
-- NOTE: the original `USING (true)` policy below let ANY anon client read every
-- row (incl. encrypted Razorpay secrets). Superseded by migration
-- v3.31_platform_settings_hide_secrets.sql which scopes the public read to
-- non-secret keys only. Server writes/reads use the service_role key (bypasses
-- RLS). Keep this file for historical context; v3.31 is the live policy.
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings readable by all" ON platform_settings FOR SELECT USING (true);

-- Allow service role full access to all tables (for admin operations)
-- The service_role key already bypasses RLS, so no additional policies needed.
