-- v3.87_learning_loop.sql — Bolt SIE phase C: learning loop + observability.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
-- Adds:
--   1. bot_messages.source — which layer answered (smalltalk|faq|cache|model|escalation),
--      persisted so the admin can compute AI-usage % / cache-hit % etc.
--   2. bot_doc_versions — per-doc content hash, so a reseed can expire ONLY the cached
--      answers whose source doc actually changed (version-aware cache invalidation),
--      instead of wiping the whole semantic cache.
-- All additive + schema-fallback-safe; ships fine before it's applied.

ALTER TABLE bot_messages ADD COLUMN IF NOT EXISTS source TEXT;

CREATE TABLE IF NOT EXISTS bot_doc_versions (
  source_file  TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE bot_doc_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bot_doc_versions FROM anon, authenticated;
