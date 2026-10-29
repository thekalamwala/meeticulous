-- v3.145 — seo_audit: read-only SEO Audit Engine (P1) storage.
--
-- A nightly/on-demand crawler records one seo_crawls row per run, one
-- seo_crawl_pages row per URL, deterministic seo_issues, and a per-category
-- seo_score_snapshot. seo_issue_mutes lets an admin silence a rule (or a
-- rule+url). Nothing here writes to live SEO fields — it is an audit store.
--
-- Server-only (service_role); RLS-on / no policy, like job_runs + webhook_events.
-- Apply on BOTH DBs. Idempotent.

CREATE TABLE IF NOT EXISTS seo_crawls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text NOT NULL DEFAULT 'running',   -- running | done | failed | skipped
  trigger       text NOT NULL DEFAULT 'manual',    -- nightly | manual
  triggered_by  text,
  url_count     int NOT NULL DEFAULT 0,
  page_count    int NOT NULL DEFAULT 0,
  issue_count   int NOT NULL DEFAULT 0,
  error         text,
  progress      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS seo_crawl_pages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id       uuid NOT NULL REFERENCES seo_crawls(id) ON DELETE CASCADE,
  url            text NOT NULL,
  page_type      text NOT NULL DEFAULT 'other',
  http_status    int,
  final_url      text,
  redirect_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_ms    int,
  title          text,
  meta_description text,
  canonical      text,
  robots         text,
  h1             jsonb NOT NULL DEFAULT '[]'::jsonb,
  word_count     int,
  indexable      boolean,
  in_sitemap     boolean NOT NULL DEFAULT false,
  raw_signals    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_crawl_pages_crawl ON seo_crawl_pages(crawl_id);
CREATE INDEX IF NOT EXISTS idx_seo_crawl_pages_type  ON seo_crawl_pages(crawl_id, page_type);

CREATE TABLE IF NOT EXISTS seo_issues (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id           uuid NOT NULL REFERENCES seo_crawls(id) ON DELETE CASCADE,
  page_id            uuid REFERENCES seo_crawl_pages(id) ON DELETE CASCADE,
  rule_key           text NOT NULL,
  category           text NOT NULL,
  severity           text NOT NULL,           -- P0 | P1 | P2 | P3 | P4
  priority_score     numeric NOT NULL DEFAULT 0,
  confidence         numeric NOT NULL DEFAULT 1,
  title              text NOT NULL,
  detail             text,
  evidence           jsonb NOT NULL DEFAULT '{}'::jsonb,
  affected_url       text,
  auto_fixable       boolean NOT NULL DEFAULT false,
  status             text NOT NULL DEFAULT 'open',   -- open | ignored
  first_seen_crawl_id uuid,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_issues_crawl_sev ON seo_issues(crawl_id, severity);
CREATE INDEX IF NOT EXISTS idx_seo_issues_rule_url  ON seo_issues(rule_key, affected_url);

CREATE TABLE IF NOT EXISTS seo_score_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id         uuid NOT NULL REFERENCES seo_crawls(id) ON DELETE CASCADE,
  taken_at         timestamptz NOT NULL DEFAULT now(),
  overall          int NOT NULL,
  technical        int NOT NULL,
  onpage           int NOT NULL,
  content          int NOT NULL,
  indexability     int NOT NULL,
  internal_linking int NOT NULL,
  breakdown        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS seo_issue_mutes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key    text NOT NULL,
  url_pattern text,                 -- NULL = mute the whole rule type
  muted_by    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_issue_mutes ON seo_issue_mutes(rule_key, COALESCE(url_pattern, ''));

ALTER TABLE seo_crawls          ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_crawl_pages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_issues          ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_issue_mutes     ENABLE ROW LEVEL SECURITY;
