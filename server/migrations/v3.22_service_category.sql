-- v3.22 — Service category
-- Each service carries one category slug, drawn from the host's own
-- profiles.categories. Nullable so existing rows stay valid (no backfill).
BEGIN;

ALTER TABLE services ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS services_category_idx ON services(category);

COMMIT;
