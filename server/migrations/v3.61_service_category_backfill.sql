-- v3.60 — Service Category integrity: PHASE 2 of 4 = BACKFILL (data only, no DDL)
--
-- Run AFTER the new server is deployed, so any category rows the OLD server wrote
-- during the expand->deploy window are also caught here. No schema changes; pure
-- data. Safe to re-run and safe under live traffic — the new server only ever
-- writes complete, valid pairs, so it never fights this.
--
-- IDEMPOTENCY MODEL: the three statements below are plain top-level SQL, so each
-- runs as its own implicit transaction and each WHERE clause is self-limiting.
-- Re-running the file after a COMPLETE run touches 0 rows. Re-running after a
-- FAILED run is also safe: the failed statement rolled back cleanly, so you
-- simply run the file again from the top. (services is small, so each statement
-- finishes in ms. For a multi-million-row table, use the batched PROCEDURE
-- variant at the bottom instead — a DO block cannot COMMIT per batch, so genuine
-- mid-run resumability needs a procedure.)
--
-- Steps:
--   0a) delete orphan service_categories (primary_category is not a real
--       profession) — required before v3.63's fk_sc_primary can validate.
--   1)  stamp services.primary_category from the host's profession where the pair
--       genuinely exists in service_categories.
--   2)  clear rows still categorised-but-unpaired (stale slug) so they satisfy the
--       future CHECK. This is the one destructive step (nulls category on rows the
--       app can no longer map); it matches the original v3.60 policy.

-- Report first (read-only) so the counts land in the release log ---------------
DO $$
DECLARE orphans int; to_stamp int; to_clear int;
BEGIN
  SELECT count(*) INTO orphans
  FROM service_categories sc
  WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = sc.primary_category);

  SELECT count(*) INTO to_stamp
  FROM services s JOIN profiles p ON p.id = s.host_id
  WHERE s.category IS NOT NULL AND s.primary_category IS NULL
    AND EXISTS (SELECT 1 FROM service_categories sc
                WHERE sc.primary_category = p.primary_category AND sc.slug = s.category);

  RAISE NOTICE 'v3.61 preview: % orphan catalog row(s) to delete, ~% service(s) to stamp', orphans, to_stamp;
END $$;

-- 0a) Orphan service_categories cleanup ---------------------------------------
DELETE FROM service_categories sc
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = sc.primary_category);

-- 1) Backfill services.primary_category from the host's profession -------------
UPDATE services s
SET primary_category = p.primary_category
FROM profiles p
WHERE s.host_id = p.id
  AND s.category IS NOT NULL
  AND s.primary_category IS NULL
  AND EXISTS (
    SELECT 1 FROM service_categories sc
    WHERE sc.primary_category = p.primary_category AND sc.slug = s.category
  );

-- 2) Clear stale categorised-but-unpaired rows (DESTRUCTIVE, intentional) ------
UPDATE services
SET category = NULL, primary_category = NULL
WHERE category IS NOT NULL AND primary_category IS NULL;

-- Confirm nothing remains (a clean re-run reports 0/0/0 in v3.62) --------------
DO $$
DECLARE remaining int;
BEGIN
  SELECT count(*) INTO remaining FROM services
  WHERE (category IS NULL) <> (primary_category IS NULL);
  RAISE NOTICE 'v3.61 done: % row(s) still exactly-one-null (should be 0)', remaining;
END $$;


-- ============================================================================
-- OPTIONAL: batched, genuinely-resumable variant for a very large services
-- table. A DO block cannot COMMIT mid-run; a PROCEDURE can. Uncomment, create,
-- then `CALL backfill_service_primary_category();`. Each batch commits, so an
-- interrupted run resumes where it stopped and holds no long transaction.
-- ----------------------------------------------------------------------------
-- CREATE OR REPLACE PROCEDURE backfill_service_primary_category()
-- LANGUAGE plpgsql AS $$
-- DECLARE affected int; total int := 0;
-- BEGIN
--   LOOP
--     WITH cte AS (
--       SELECT s.id, p.primary_category AS pc
--       FROM services s JOIN profiles p ON p.id = s.host_id
--       WHERE s.category IS NOT NULL AND s.primary_category IS NULL
--         AND EXISTS (SELECT 1 FROM service_categories sc
--                     WHERE sc.primary_category = p.primary_category AND sc.slug = s.category)
--       LIMIT 5000
--     )
--     UPDATE services s SET primary_category = cte.pc FROM cte WHERE s.id = cte.id;
--     GET DIAGNOSTICS affected = ROW_COUNT;
--     total := total + affected;
--     COMMIT;                         -- allowed inside a PROCEDURE
--     EXIT WHEN affected = 0;
--     RAISE NOTICE 'stamped % (total %)', affected, total;
--   END LOOP;
--   LOOP
--     WITH cte AS (
--       SELECT id FROM services
--       WHERE category IS NOT NULL AND primary_category IS NULL LIMIT 5000
--     )
--     UPDATE services s SET category = NULL, primary_category = NULL
--     FROM cte WHERE s.id = cte.id;
--     GET DIAGNOSTICS affected = ROW_COUNT;
--     COMMIT;
--     EXIT WHEN affected = 0;
--   END LOOP;
-- END $$;
