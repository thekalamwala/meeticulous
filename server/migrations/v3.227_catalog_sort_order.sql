-- v3.227 — Catalog order: the host decides which service, product and course
-- shows first.
--
-- Kept Catalog (founder-approved 2026-11-26): a host long-presses a row on the
-- phone (or uses Reorder on desktop) to set the order. The order is the one
-- guests see on the booking page, the way Calendly orders event types.
--
-- `sort_order` is NULL until the host first reorders a list. Every read orders
-- by `sort_order ASC NULLS LAST, created_at DESC`, so a host who never touches
-- it keeps today's newest-first order exactly. Written only by
-- PUT /api/{services,products,courses}/reorder (host-scoped by host_id).
--
-- Apply on BOTH DBs. Additive, nullable, no default, no backfill. RLS and grants
-- are unchanged (v3.206 already revoked anon/authenticated writes). The code
-- keeps a schema fallback: reads retry without `sort_order` and the reorder
-- endpoint answers 409 "not available yet" on "column does not exist", so the
-- release is safe to deploy before this runs.
--
-- Rollback:
--   ALTER TABLE services DROP COLUMN IF EXISTS sort_order;
--   ALTER TABLE products DROP COLUMN IF EXISTS sort_order;
--   ALTER TABLE courses  DROP COLUMN IF EXISTS sort_order;

ALTER TABLE services ADD COLUMN IF NOT EXISTS sort_order INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER;
ALTER TABLE courses  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

COMMENT ON COLUMN services.sort_order IS 'Host-set display order (1 = first). NULL = never placed; sorts after placed rows, newest first.';
COMMENT ON COLUMN products.sort_order IS 'Host-set display order (1 = first). NULL = never placed; sorts after placed rows, newest first.';
COMMENT ON COLUMN courses.sort_order  IS 'Host-set display order (1 = first). NULL = never placed; sorts after placed rows, newest first.';

-- Host-scoped list reads order on these; the existing host_id indexes already
-- narrow each list to a handful of rows, so one composite per table is enough.
CREATE INDEX IF NOT EXISTS idx_services_host_sort ON services (host_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_host_sort ON products (host_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_courses_host_sort  ON courses  (host_id, sort_order);
