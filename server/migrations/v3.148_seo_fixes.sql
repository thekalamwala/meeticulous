-- v3.148 — seo_fixes: the SEO fix queue + change log (Phase 2).
--
-- One row per proposed fix. Deterministic proposals (safe technical/metadata) and
-- content "context packs" (no generated text — Claude Code writes the copy) both
-- land here as status='proposed'. Nothing in Phase 2 touches live pages; this is
-- the review queue and, once fixes are applied in Phase 3, the change log.
-- old_value is always captured before anything can be applied, so every change is
-- reversible (rollback jsonb holds the restore handle / PR ref).
--
-- Server-only (service_role); RLS-on / no policy, like seo_audit (v3.145).
-- Apply on BOTH DBs. Idempotent. Code keeps a schema fallback until confirmed.

CREATE TABLE IF NOT EXISTS seo_fixes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id         uuid REFERENCES seo_crawls(id) ON DELETE SET NULL,
  issue_id         uuid REFERENCES seo_issues(id) ON DELETE SET NULL,
  url              text NOT NULL,
  page_type        text,
  category         text,
  rule_key         text NOT NULL,
  target           text NOT NULL,            -- db_field | meta_builder | prerender | content
  field            text,                     -- meta_description | canonical | alt | h1 | body | ...
  old_value        text,
  new_value        text,                     -- NULL for content packs (drafted later by Claude Code)
  diff             jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason           text,
  confidence       numeric NOT NULL DEFAULT 0,
  approval_level   text NOT NULL,            -- AUTO | REVIEW | DO_NOT
  status           text NOT NULL DEFAULT 'proposed', -- proposed | approved | applied | failed | rejected | rolled_back
  evidence_maturity text,                    -- NEW | DEVELOPING | ESTABLISHED | STRONG (at proposal time)
  context          jsonb NOT NULL DEFAULT '{}'::jsonb, -- content context pack (entity/topic/intent/siblings/…)
  source           text,                     -- generator id + version
  test_before      jsonb NOT NULL DEFAULT '{}'::jsonb,
  test_after       jsonb NOT NULL DEFAULT '{}'::jsonb,
  rollback         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  approved_at      timestamptz,
  approved_by      text,
  applied_at       timestamptz,
  applied_by       text
);
CREATE INDEX IF NOT EXISTS idx_seo_fixes_crawl    ON seo_fixes(crawl_id);
CREATE INDEX IF NOT EXISTS idx_seo_fixes_status   ON seo_fixes(status);
CREATE INDEX IF NOT EXISTS idx_seo_fixes_approval ON seo_fixes(approval_level, status);
-- Re-running the generator for the same crawl must not duplicate a page's fix for
-- the same rule+field — upsert on this key instead.
CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_fixes_dedupe
  ON seo_fixes(crawl_id, url, rule_key, COALESCE(field, ''));

ALTER TABLE seo_fixes ENABLE ROW LEVEL SECURITY;
