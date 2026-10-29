-- v3.147 — Add "Sports Arena" primary category (profession)
-- Beachhead category for sports-facility / arena operators (turf, box cricket,
-- courts, gaming, ground rental) and the coaching/membership they sell on the
-- same facility.
--
-- Adds ONLY the categories taxonomy row so the profession is pickable in
-- onboarding + admin. The per-profession bookable services are seeded separately
-- by scripts/seedServiceCategories.js (SERVICE_CATEGORY_SEED['sports-arena']).
--
-- GST note: sports-facility rental + coaching are OUTSIDE §9(5) CGST (not
-- passenger transport / hotel accommodation / housekeeping / restaurant food),
-- so the existing marketplace tax model (host GST; platform TDS+TCS) is unchanged.
--
-- Idempotent: WHERE NOT EXISTS makes re-apply a no-op regardless of any unique
-- constraint on categories.slug.
--
-- Apply on BOTH DBs (staging Tokyo xwvciqkayammbvsidqig, prod Mumbai
-- ayjhlwyzszykqtnaktpb), then run: node server/scripts/seedServiceCategories.js
-- against each (it only fills gaps, so it is safe on the existing catalogue).

BEGIN;

INSERT INTO categories (slug, label, group_label, sort_order, status)
SELECT 'sports-arena', 'Sports Arena', 'Sports & Venues', 610, 'active'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'sports-arena');

COMMIT;
