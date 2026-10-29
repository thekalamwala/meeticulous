-- v3.53 — Service Category REDESIGN (scrap + rebuild)
--
-- Old model (scrapped):
--   * services.category          = a slug ∈ the host's profiles.categories (a PROFESSION). Wrong:
--                                  it tagged a photographer's service as "Photographer", not "Wedding Photography".
--   * service_categories (v3.40) = a flat, profession-agnostic admin marketplace taxonomy
--                                  + services.service_category_id FK. Also wrong shape.
--
-- New model:
--   * service_categories is keyed by PRIMARY CATEGORY (a profession, categories.slug).
--     Each row is an ACTUAL bookable service for that profession
--     (e.g. photographer → "Wedding Photography", "Pre-Wedding Photography", …).
--   * services.category now stores the chosen service-category SLUG, scoped to the
--     host's profiles.primary_category. (Repurposed; column kept, old values cleared.)
--
-- Seed the new table by running:  node server/scripts/seedServiceCategories.js
-- (source-of-truth dataset: server/config/serviceCategorySeed.js)

BEGIN;

-- 1) Drop the old marketplace FK + table -------------------------------------
ALTER TABLE services DROP COLUMN IF EXISTS service_category_id;
DROP TABLE IF EXISTS service_categories CASCADE;

-- 2) Clear stale services.category values ------------------------------------
--    Old values were profession slugs (wrong semantics under the new model).
--    Hosts re-pick a real service category on next edit; column stays nullable.
UPDATE services SET category = NULL WHERE category IS NOT NULL;

-- 3) Recreate service_categories (profession-scoped) -------------------------
CREATE TABLE service_categories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_category text NOT NULL,                 -- = categories.slug (a profession)
  name             text NOT NULL,                 -- "Wedding Photography"
  slug             text NOT NULL,                 -- "wedding-photography" (unique within a profession)
  display_order    int  NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (primary_category, slug)
);
CREATE INDEX idx_service_categories_primary
  ON service_categories(primary_category, is_active, display_order);

-- 4) Lock down: writes only via service_role (admin API); no anon/auth grants -
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON service_categories FROM anon, authenticated;

COMMIT;
