-- v3.86_semantic_cache.sql — Bolt SIE phase B part 2: semantic answer cache.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
-- A near-identical past question reuses its grounded answer WITHOUT calling Claude —
-- the core "reduce AI dependency" mechanism. Requires pgvector (v3.85) + VOYAGE_API_KEY
-- (the question embedding is reused from the retrieval leg). Empty + inert until the
-- bot starts writing rows, so it's safe to ship before the migration is applied.

CREATE TABLE IF NOT EXISTS bot_semantic_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question      TEXT NOT NULL,               -- the question whose answer this caches
  embedding     vector(1024) NOT NULL,       -- voyage-3.5-lite embedding of the question
  answer        TEXT NOT NULL,               -- the grounded answer to serve verbatim
  cited_sources JSONB,                        -- [{source_file, heading}] from the original answer
  hits          INT NOT NULL DEFAULT 0,      -- times this cached answer was reused
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);
-- No ANN index yet: the cache starts empty and grows slowly. Add ivfflat/hnsw only
-- once it holds thousands of rows.

-- Best match at/above a cosine-similarity threshold (default 0.93 — deliberately
-- high so only a near-identical question reuses an answer). Returns at most one row.
CREATE OR REPLACE FUNCTION match_semantic_cache(query_embedding vector(1024), similarity_threshold REAL DEFAULT 0.93)
RETURNS TABLE (id UUID, question TEXT, answer TEXT, cited_sources JSONB, similarity REAL)
LANGUAGE sql STABLE AS $$
  SELECT c.id, c.question, c.answer, c.cited_sources,
         (1 - (c.embedding <=> query_embedding))::real AS similarity
  FROM bot_semantic_cache c
  WHERE (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT 1;
$$;

-- Increment a hit counter (fire-and-forget from the service).
CREATE OR REPLACE FUNCTION bump_cache_hit(cache_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE bot_semantic_cache SET hits = hits + 1, last_used_at = now() WHERE id = cache_id;
$$;

-- Server-only (service_role): deny-all RLS + revoke default grants + lock the RPCs.
ALTER TABLE bot_semantic_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bot_semantic_cache FROM anon, authenticated;
REVOKE ALL ON FUNCTION match_semantic_cache(vector, REAL) FROM anon, authenticated;
REVOKE ALL ON FUNCTION bump_cache_hit(UUID) FROM anon, authenticated;
