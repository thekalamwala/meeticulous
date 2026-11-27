-- v3.229_clean_catalog_slugs.sql
-- Readable catalog URLs for the profile SEO overhaul (/:username/products/<slug>,
-- /:username/courses/<slug>).
--
-- (a) products.legacy_slugs / courses.legacy_slugs: slugs a row USED to have, so an
--     old URL still resolves and 301s to the current one
--     (server/services/catalogSlug.js: slug → id → legacy_slugs).
-- (b) Strip the `demo-` prefix from product and course slugs (every live product
--     and course carried it), moving the old slug into legacy_slugs. Per-host
--     collision safety: if the stripped slug is taken (as a slug OR a legacy
--     slug) by another row of the same host, append -2, -3 … (readable, never
--     random letters).
--
-- Additive + idempotent: ADD COLUMN IF NOT EXISTS; the rename only touches rows
-- whose slug still starts with `demo-`, so a second run changes nothing. No
-- grants change (v3.206 default privileges already cover the tables).
--
-- Code is schema-fallback safe: until this runs, the legacy_slugs lookup errors
-- and is treated as "not found"; slug and id lookups work either way.
--
-- services: deliberately NOT given legacy_slugs here — service URLs are not
-- changing in this release and no service slug is rewritten.
--
-- ROLLBACK (restores each renamed row's last legacy slug, then drops the columns):
--   UPDATE public.products SET slug = legacy_slugs[cardinality(legacy_slugs)]
--     WHERE legacy_slugs[cardinality(legacy_slugs)] LIKE 'demo-%';
--   UPDATE public.courses  SET slug = legacy_slugs[cardinality(legacy_slugs)]
--     WHERE legacy_slugs[cardinality(legacy_slugs)] LIKE 'demo-%';
--   ALTER TABLE public.products DROP COLUMN IF EXISTS legacy_slugs;
--   ALTER TABLE public.courses  DROP COLUMN IF EXISTS legacy_slugs;
--
-- VERIFY (expect demo_left = 0, no duplicate rows):
--   SELECT 'products' AS t, count(*) FILTER (WHERE slug LIKE 'demo-%') AS demo_left,
--          count(*) FILTER (WHERE cardinality(legacy_slugs) > 0) AS moved
--     FROM public.products
--   UNION ALL
--   SELECT 'courses', count(*) FILTER (WHERE slug LIKE 'demo-%'),
--          count(*) FILTER (WHERE cardinality(legacy_slugs) > 0)
--     FROM public.courses;
--   SELECT 'products' AS t, host_id, slug, count(*) FROM public.products GROUP BY 2, 3 HAVING count(*) > 1
--   UNION ALL
--   SELECT 'courses', host_id, slug, count(*) FROM public.courses GROUP BY 2, 3 HAVING count(*) > 1;

BEGIN;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS legacy_slugs text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.courses  ADD COLUMN IF NOT EXISTS legacy_slugs text[] NOT NULL DEFAULT '{}';

DO $$
DECLARE
  tbl  text;
  r    record;
  base text;
  cand text;
  n    int;
  hit  boolean;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['products', 'courses'] LOOP
    FOR r IN EXECUTE format(
      'SELECT id, host_id, slug FROM public.%I WHERE slug LIKE %L ORDER BY created_at, id', tbl, 'demo-%'
    ) LOOP
      base := regexp_replace(r.slug, '^(demo-)+', '');
      CONTINUE WHEN base = '';
      cand := base;
      n := 2;
      LOOP
        EXECUTE format(
          'SELECT EXISTS (SELECT 1 FROM public.%I WHERE host_id = $1 AND id <> $2 AND (slug = $3 OR $3 = ANY (legacy_slugs)))', tbl
        ) INTO hit USING r.host_id, r.id, cand;
        EXIT WHEN NOT hit;
        cand := base || '-' || n;
        n := n + 1;
      END LOOP;
      EXECUTE format(
        'UPDATE public.%I SET slug = $1, legacy_slugs = CASE WHEN $2 = ANY (legacy_slugs) THEN legacy_slugs ELSE array_append(legacy_slugs, $2) END WHERE id = $3', tbl
      ) USING cand, r.slug, r.id;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
