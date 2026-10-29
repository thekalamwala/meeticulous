-- v3.85_kb_embeddings.sql — Bolt SIE phase B: pgvector semantic retrieval.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
-- Adds an embedding column to kb_chunks + a cosine-similarity match RPC. Retrieval
-- becomes HYBRID: existing FTS (search_kb_chunks) UNION vector (match_kb_chunks),
-- merged in the service. Embeddings are voyage-3.5-lite (1024-dim), populated by
-- re-running scripts/seedKnowledgeBase.js with VOYAGE_API_KEY set. Until then the
-- column is NULL and the vector RPC returns nothing → the bot stays FTS-only.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- No ANN index (ivfflat/hnsw): the help corpus is tiny (~23 rows) so a sequential
-- scan beats maintaining an index. Add one only if kb_chunks grows into the thousands.

-- Cosine-similarity top-N. Returns similarity = 1 - cosine_distance so higher is
-- better, matching the caller's MIN_SIMILARITY floor. Rows without an embedding are
-- skipped so a partially-seeded table can't surface garbage.
CREATE OR REPLACE FUNCTION match_kb_chunks(query_embedding vector(1024), match_count int DEFAULT 5)
RETURNS TABLE (id UUID, source_file TEXT, heading TEXT, content TEXT, similarity REAL)
LANGUAGE sql STABLE AS $$
  SELECT c.id, c.source_file, c.heading, c.content,
         (1 - (c.embedding <=> query_embedding))::real AS similarity
  FROM kb_chunks c
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;

-- Server-only, like search_kb_chunks: the service calls it as service_role.
REVOKE ALL ON FUNCTION match_kb_chunks(vector, INT) FROM anon, authenticated;
