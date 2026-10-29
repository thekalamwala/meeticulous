-- v3.152_seo_gsc_queries.sql
-- SEO control center v2 (PR1). Two additive changes, both safe to apply before code:
--
-- 1) seo_gsc_queries — per (url, query) Search Console rows so the page inspector
--    can show the queries a page ranks for as pills, with current vs previous
--    position/clicks for a trend. gscSync pulls dimensions:['page','query'] over
--    two 28-day windows (current + previous) and upserts here.
--
-- 2) seo_gsc_urls prev_* columns — page-level previous-window metrics so the list
--    and drawer can show position/clicks/impressions change without a second table.
--
-- Both are service_role-only (RLS on, no policy), matching every other seo_* table.
-- Code is schema-fallback safe: gscSync try/catches the query pull and the read
-- helpers fail soft to [] if these objects are missing, so apply order is free.

CREATE TABLE IF NOT EXISTS seo_gsc_queries (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  url           TEXT        NOT NULL,
  query         TEXT        NOT NULL,
  clicks        INTEGER     NOT NULL DEFAULT 0,
  impressions   INTEGER     NOT NULL DEFAULT 0,
  ctr           DOUBLE PRECISION,
  position      DOUBLE PRECISION,
  prev_clicks       INTEGER,
  prev_impressions  INTEGER,
  prev_position     DOUBLE PRECISION,
  last_synced   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- one row per url+query; re-sync overwrites in place.
  CONSTRAINT uq_seo_gsc_queries UNIQUE (url, query)
);

-- Drawer reads all queries for one url, best first. List/opportunity reads scan by
-- impressions. Both are covered here.
CREATE INDEX IF NOT EXISTS idx_seo_gsc_queries_url ON seo_gsc_queries (url, impressions DESC);

ALTER TABLE seo_gsc_queries ENABLE ROW LEVEL SECURITY;

-- Page-level previous-window metrics (current-window columns already exist on this
-- table from v3.146). Nullable + additive; existing rows read NULL until next sync.
ALTER TABLE seo_gsc_urls ADD COLUMN IF NOT EXISTS prev_impressions INTEGER;
ALTER TABLE seo_gsc_urls ADD COLUMN IF NOT EXISTS prev_clicks      INTEGER;
ALTER TABLE seo_gsc_urls ADD COLUMN IF NOT EXISTS prev_position    DOUBLE PRECISION;
