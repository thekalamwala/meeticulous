-- v3.189 — old brand orange (#FE5100) → maroon (#960D32) in DB colour defaults.
-- The client already falls back to maroon, but profiles.theme_color still
-- DEFAULTed to orange, so every new host's public profile rendered orange.
-- Only rows still on the old default are repainted; hosts who picked another
-- colour are untouched. Safe to apply before or after the code release.

BEGIN;

ALTER TABLE profiles       ALTER COLUMN theme_color SET DEFAULT '#960D32';
ALTER TABLE email_settings ALTER COLUMN brand_color SET DEFAULT '#960D32';

UPDATE profiles       SET theme_color = '#960D32' WHERE upper(theme_color) = '#FE5100';
UPDATE email_settings SET brand_color = '#960D32' WHERE upper(brand_color) = '#FE5100';

COMMIT;
