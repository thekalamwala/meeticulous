-- v3.60 — Service Category integrity: PHASE 3 of 4 = VALIDATE (gate, read-only)
--
-- Pre-flight for v3.63 enforce. Read-only: makes NO changes. It RAISES EXCEPTION
-- (aborting the run) if any condition that v3.63's constraints require is not yet
-- true. Green run => safe to enforce. A raised exception => STOP, do not run
-- v3.63; re-run v3.61 backfill (and investigate) first.
--
-- Checks each future constraint's precondition:
--   A) chk_category_pair       : no row has exactly one of (category, primary_category) set
--   B) fk_services_category    : every non-null pair exists in service_categories
--   C) fk_sc_primary           : every service_categories.primary_category is a real profession
-- Counts are printed via NOTICE for the release log even on success.

DO $$
DECLARE
  a_pair_mismatch int;   -- violates chk_category_pair
  b_orphan_pair   int;   -- violates fk_services_category
  c_orphan_prof   int;   -- violates fk_sc_primary
BEGIN
  -- A) exactly-one-null rows (the CHECK forbids these)
  SELECT count(*) INTO a_pair_mismatch
  FROM services
  WHERE (category IS NULL) <> (primary_category IS NULL);

  -- B) categorised rows whose (primary_category, category) pair is not a real
  --    service_categories row (the composite FK forbids these)
  SELECT count(*) INTO b_orphan_pair
  FROM services s
  WHERE s.category IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM service_categories sc
      WHERE sc.primary_category = s.primary_category
        AND sc.slug = s.category
    );

  -- C) service_categories buckets pointing at a non-existent profession
  SELECT count(*) INTO c_orphan_prof
  FROM service_categories sc
  WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = sc.primary_category);

  RAISE NOTICE '--- v3.62 validation report ---';
  RAISE NOTICE 'A chk_category_pair violations (exactly-one-null): %', a_pair_mismatch;
  RAISE NOTICE 'B fk_services_category violations (orphan pair)   : %', b_orphan_pair;
  RAISE NOTICE 'C fk_sc_primary violations (orphan profession)    : %', c_orphan_prof;

  IF a_pair_mismatch > 0 OR b_orphan_pair > 0 OR c_orphan_prof > 0 THEN
    RAISE EXCEPTION
      'v3.62 VALIDATION FAILED (A=%, B=%, C=%). Do NOT run v3.63. Re-run v3.61 backfill and investigate.',
      a_pair_mismatch, b_orphan_pair, c_orphan_prof;
  END IF;

  RAISE NOTICE 'v3.62 VALIDATION PASSED — safe to run v3.63 enforce.';
END $$;
