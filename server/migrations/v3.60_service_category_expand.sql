-- v3.60 — Service Category integrity: PHASE 1 of 4 = EXPAND (additive only)
--
-- Part of the zero-downtime split (Expand -> Deploy -> Backfill -> Validate ->
-- Enforce). This file is 100% backward-compatible: it adds only NULLABLE columns
-- and an index. The currently-deployed (old) server ignores the new columns, and
-- NO constraint here can reject any write it makes. Safe to apply BEFORE the new
-- server is live.
--
-- Sequence: v3.60 (this) -> deploy new server -> v3.61 backfill ->
--           v3.62 validate (gate) -> v3.63 enforce.
-- Full runbook: docs/releases/2026-07-03-service-category-v3.60-release.md
--
-- Idempotent: re-running is a no-op (IF NOT EXISTS / CONCURRENTLY IF NOT EXISTS).

BEGIN;

-- services gains its profession slug (nullable; the pair is completed by v3.61
-- backfill for old rows and by the new server for new writes).
ALTER TABLE services ADD COLUMN IF NOT EXISTS primary_category text;

-- SEO columns for the /services landing pages (nullable; template fallback in code).
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS icon text;

COMMIT;

-- Read index for pair-scoped explore queries. CONCURRENTLY so the build never
-- blocks writes on services. MUST run outside a transaction block — that is why
-- it sits after COMMIT and is not wrapped in BEGIN/COMMIT. If your SQL client
-- forces an implicit transaction, run this single statement on its own.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_prof_cat
  ON services (primary_category, category) WHERE category IS NOT NULL;
