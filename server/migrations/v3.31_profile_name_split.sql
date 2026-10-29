-- v3.31: split-name capture for Google-sourced host profiles.
-- profile_image already exists; we only add first/last name.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;
