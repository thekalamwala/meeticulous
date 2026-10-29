-- v3.83_bot_knowledge.sql — "Bolt 958" support bot: doc knowledge base + chat log.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
-- Retrieval is Postgres full-text search (tsvector + ts_rank) — NO embeddings/pgvector.
-- Server-only: RLS is ENABLED with no policies so anon/authenticated PostgREST roles are
-- denied (Supabase grants SELECT on new public tables by default); service_role bypasses RLS.

-- ── Knowledge base: one row per doc chunk ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS kb_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file TEXT NOT NULL,                 -- e.g. 'docs/architecture.md'
  heading     TEXT,                          -- nearest markdown heading for the chunk
  content     TEXT NOT NULL,
  -- Weighted FTS vector: heading (A) ranks above body (B). Generated + stored so
  -- ts_rank stays server-side and inserts never have to compute it.
  tsv         TSVECTOR GENERATED ALWAYS AS (
                setweight(to_tsvector('english', coalesce(heading, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(content, '')), 'B')
              ) STORED,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kb_chunks_tsv_idx ON kb_chunks USING GIN (tsv);

-- ── Conversations + messages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_ref TEXT,                          -- logged-in user id OR anonymous token (nullable)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bot_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES bot_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  cited_sources   JSONB,                     -- [{source_file, heading}] on assistant rows
  escalated       BOOLEAN NOT NULL DEFAULT false,
  feedback        TEXT CHECK (feedback IN ('up','down')),  -- nullable; set via /bot/feedback
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bot_messages_conv_idx ON bot_messages (conversation_id, created_at);

-- ── Retrieval RPC: top-N chunks by ts_rank for a plain query ────────────────────
-- Keeps ranking in Postgres (PostgREST .textSearch() returns no rank). Callable by
-- the service via supabaseAdmin.rpc('search_kb_chunks', { query_text, match_count }).
--
-- plainto_tsquery ANDs every lexeme, so a long natural-language question ("how many
-- services can a Creator vs Professional host have?") demands ONE chunk containing
-- every word and usually matches nothing. We flip the & operators to | so it's an
-- OR match instead — ts_rank still floats the chunks that hit more (and rarer)
-- terms to the top, and the caller's MIN_RANK + top-N cap keep weak hits out.
CREATE OR REPLACE FUNCTION search_kb_chunks(query_text TEXT, match_count INT DEFAULT 5)
RETURNS TABLE (id UUID, source_file TEXT, heading TEXT, content TEXT, rank REAL)
LANGUAGE sql STABLE AS $$
  WITH q AS (
    SELECT replace(plainto_tsquery('english', query_text)::text, '&', '|')::tsquery AS tsq
  )
  SELECT c.id, c.source_file, c.heading, c.content, ts_rank(c.tsv, q.tsq) AS rank
  FROM kb_chunks c, q
  WHERE q.tsq::text <> '' AND c.tsv @@ q.tsq
  ORDER BY rank DESC
  LIMIT GREATEST(match_count, 1);
$$;

-- ── Lock out client roles (deny-all RLS + revoke default grants) ────────────────
ALTER TABLE kb_chunks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_messages      ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kb_chunks, bot_conversations, bot_messages FROM anon, authenticated;
-- The RPC runs as the invoker; only service_role calls it, and it only reads kb_chunks.
REVOKE ALL ON FUNCTION search_kb_chunks(TEXT, INT) FROM anon, authenticated;
