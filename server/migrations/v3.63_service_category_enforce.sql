-- v3.60 — Service Category integrity: PHASE 4 of 4 = ENFORCE
--
-- Run ONLY after: new server deployed (v3.60 expand live), v3.61 backfill done,
-- and v3.62 validate PASSED. At this point every existing row already satisfies
-- every constraint and the new server only writes valid pairs, so enforcement
-- adds zero user-visible breakage.
--
-- Lock strategy: each constraint is added NOT VALID (a fast catalog change, brief
-- ACCESS EXCLUSIVE, NO full-table scan) and VALIDATEd in a separate statement
-- (SHARE UPDATE EXCLUSIVE — concurrent reads AND writes continue). This avoids the
-- long scan-under-strong-lock that a plain ADD CONSTRAINT would take.
--
-- NOTE: NOT VALID still enforces the constraint on NEW/updated rows immediately —
-- it only skips checking pre-existing rows until VALIDATE. That is why the new
-- server MUST already be live (it never writes a violating row); NOT VALID is a
-- lock optimisation, not a backward-compat shim.
--
-- Idempotent: each ADD is guarded by a catalog check; VALIDATE on an
-- already-valid constraint is a cheap no-op. Safe to re-run.
--
-- Guards filter pg_constraint by BOTH conname AND conrelid: conname is unique
-- only per table, not per schema, so a same-named constraint on an unrelated
-- table would otherwise false-skip the ADD and make the following VALIDATE throw.
--
-- MATCH SIMPLE caveat: the composite FK (constraint 2) exempts any tuple with a
-- NULL column from the reference check, so the FK ALONE does not forbid a
-- one-null row. chk_category_pair (constraint 3) is the ONLY thing that forbids
-- (category set, primary_category NULL). Never drop the CHECK on its own while
-- keeping the FK — that reopens the one-null hole. The rollback script drops all
-- three together for this reason.
--
-- Freeze note: run this file inside the category-admin edit freeze (see runbook).
-- A categories.slug rename landing in the gap between constraint 1 and constraint
-- 2 below would cascade into service_categories.primary_category with no
-- downstream FK yet to reach services -> orphaned pair. The freeze covers it.

-- 1) fk_sc_primary : service_categories.primary_category -> categories.slug -----
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_sc_primary' AND conrelid = 'service_categories'::regclass
  ) THEN
    ALTER TABLE service_categories
      ADD CONSTRAINT fk_sc_primary FOREIGN KEY (primary_category)
      REFERENCES categories (slug) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;
ALTER TABLE service_categories VALIDATE CONSTRAINT fk_sc_primary;

-- 2) fk_services_category : (primary_category, category) -> service_categories --
--    Target key is service_categories UNIQUE (primary_category, slug) from v3.53.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_services_category' AND conrelid = 'services'::regclass
  ) THEN
    ALTER TABLE services
      ADD CONSTRAINT fk_services_category FOREIGN KEY (primary_category, category)
      REFERENCES service_categories (primary_category, slug)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;
ALTER TABLE services VALIDATE CONSTRAINT fk_services_category;

-- 3) chk_category_pair : both set or both null (the ONLY guard vs one-null) -----
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_category_pair' AND conrelid = 'services'::regclass
  ) THEN
    ALTER TABLE services
      ADD CONSTRAINT chk_category_pair
      CHECK ((category IS NULL) = (primary_category IS NULL)) NOT VALID;
  END IF;
END $$;
ALTER TABLE services VALIDATE CONSTRAINT chk_category_pair;
