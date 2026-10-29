-- v3.84_bot_faqs_and_gaps.sql — Bolt SIE phase A: a cheap deterministic FAQ layer
-- (answers served WITHOUT calling Claude) + a learning seed that turns dead 👎 /
-- escalation signal into a reviewable "what's missing" list.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
-- Server-only: RLS ENABLED, no policies → anon/authenticated denied; service_role bypasses.
-- Code carries a schema fallback (best-effort reads/writes), so it is safe to deploy
-- the code BEFORE this migration is applied — the FAQ layer no-ops and gap logging
-- is swallowed until the tables exist.

-- ── FAQ layer: canned answers for high-frequency questions, no LLM ───────────────
-- `pattern` is a normalized (lowercased, punctuation-stripped) substring; a question
-- matches when its normalized form CONTAINS the pattern. Deliberately dumb + explicit
-- so routing is fully explainable and admin-editable. Phase C can auto-promote
-- thumbs-up answers into this table.
CREATE TABLE IF NOT EXISTS bot_faqs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern    TEXT NOT NULL,                  -- normalized substring to match on
  answer     TEXT NOT NULL,                  -- markdown answer served verbatim
  enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bot_faqs_enabled_idx ON bot_faqs (enabled);

-- ── Learning seed: every escalation / 👎 becomes a knowledge gap to review ───────
-- question is filled on escalation (we have the text); message_id is filled on a
-- thumbs-down (we only have the message). Either identifies what to fix next.
CREATE TABLE IF NOT EXISTS knowledge_gaps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question        TEXT,
  reason          TEXT NOT NULL,             -- 'escalated' | 'thumbs_down'
  conversation_id UUID REFERENCES bot_conversations(id) ON DELETE SET NULL,
  message_id      UUID REFERENCES bot_messages(id) ON DELETE SET NULL,
  resolved        BOOLEAN NOT NULL DEFAULT false,  -- admin marks handled
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knowledge_gaps_open_idx ON knowledge_gaps (resolved, created_at);

-- ── Lock out client roles (deny-all RLS + revoke default grants) ────────────────
ALTER TABLE bot_faqs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_gaps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bot_faqs, knowledge_gaps FROM anon, authenticated;

-- ── Seed a few genuinely-canned answers (not better served by the help corpus) ──
-- These are meta/there's-nothing-to-retrieve questions. Prices/policy stay OUT of
-- here (they rot) — those go through retrieval so they track the docs.
INSERT INTO bot_faqs (pattern, answer)
SELECT * FROM (VALUES
  ('are you a bot',
   'Yep, I''m Bolt — the Book A Sloth assistant, not a human. I can answer most things about booking, payments, plans and hosting. If I hit something I can''t, I''ll pull in a real person from the team.'),
  ('are you human',
   'Nope, I''m Bolt — an assistant, not a person. I''ll get you a human the moment something needs one.'),
  ('talk to a human',
   'Totally fair. Tell me what''s going on in one line and I''ll pass it to a human on the team — they''ll follow up over WhatsApp or email.')
) AS v(pattern, answer)
WHERE NOT EXISTS (SELECT 1 FROM bot_faqs);
