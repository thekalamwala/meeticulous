-- v3.60 — Service Category integrity: ROLLBACK (enforce phase only)
--
-- Drops the three constraints added by v3.63. Use if enforcement causes an
-- unforeseen problem and you must return to the post-backfill state WITHOUT
-- reverting data. Dropping a constraint is instant (catalog-only) and takes a
-- brief ACCESS EXCLUSIVE lock; no table scan, no data change.
--
-- After this, the new server keeps working (it tolerates the columns being
-- unconstrained) and the OLD server also works again (nothing rejects its
-- category-only writes). This is the safe fallback if v3.63 must be undone.
--
-- The expand columns (services.primary_category, service_categories.description /
-- icon) and the index are intentionally NOT dropped here: they are additive,
-- harmless, and dropping them would force a matching server rollback. To fully
-- contract, use v3.6X_service_category_contract.sql in a LATER release (see
-- runbook), never as an emergency step.

BEGIN;
ALTER TABLE services            DROP CONSTRAINT IF EXISTS chk_category_pair;
ALTER TABLE services            DROP CONSTRAINT IF EXISTS fk_services_category;
ALTER TABLE service_categories  DROP CONSTRAINT IF EXISTS fk_sc_primary;
COMMIT;
