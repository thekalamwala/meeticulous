-- v3.146 — seo_gsc_urls: Google Search Console sync store (P1.5).
--
-- gscSync.run() (SCHEDULED_JOBS 'gsc-sync') upserts one row per URL, merging
-- URL Inspection (index coverage) + Search Analytics (performance) results.
-- URL-keyed (no crawl_id) so it survives crawls on its own daily cadence;
-- rules/gsc.js reads it via buildContext's ctx.gscByUrl to emit gsc.* issues.
--
-- Server-only (service_role); RLS-on / no policy, like seo_crawls / job_runs.
-- Apply on BOTH DBs. Idempotent.

CREATE TABLE IF NOT EXISTS seo_gsc_urls (
  url text PRIMARY KEY,
  coverage_state text,
  indexing_state text,
  google_canonical text,
  user_canonical text,
  robots_txt_state text,
  last_crawl_time timestamptz,
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  position numeric,
  inspection_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  analytics_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_gsc_urls_coverage ON seo_gsc_urls(coverage_state);

ALTER TABLE seo_gsc_urls ENABLE ROW LEVEL SECURITY;
