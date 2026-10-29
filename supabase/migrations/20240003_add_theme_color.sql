-- Add theme_color to profiles table
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#FE5100';

-- Refresh the schema cache so PostgREST picks it up immediately
NOTIFY pgrst, 'reload schema';
