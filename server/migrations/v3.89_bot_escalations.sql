-- v3.89_bot_escalations.sql — Bolt escalation records + admin reply thread.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- Improves the existing escalation flow (AI hands off to a human) WITHOUT building a
-- ticketing system. Today escalation is a fire-and-forget email carrying only the
-- conversation id + "anonymous". These tables give support a real record: who the
-- visitor is, a verified reply channel (WhatsApp/email), a one-sentence AI summary,
-- page/browser, and an admin reply thread.
--
--   bot_escalations         — one row per escalation (snapshot of who + how to reach them)
--   bot_escalation_replies  — admin replies sent back to the visitor (email / wa link / note)
--
-- Additive + schema-fallback-safe: the bot ships and runs fine before this is applied
-- (controller destructures degrade to the old email-only path on "column/table missing").
-- Same posture as every other bot_* table: RLS on, no policies, service_role only.

CREATE TABLE IF NOT EXISTS bot_escalations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID REFERENCES bot_conversations(id) ON DELETE CASCADE,
  reference         TEXT NOT NULL,                    -- human ref e.g. CHAT-8F92AB (derived from conversation id)
  visitor_uuid      TEXT,                             -- anon localStorage id; null for logged-in
  logged_in         BOOLEAN NOT NULL DEFAULT false,
  user_id           UUID,                             -- profiles.id when logged in (no hard FK: keep decoupled)
  is_host           BOOLEAN,                          -- true=host, false=guest, null=anon/unknown
  name              TEXT,
  email             TEXT,
  phone             TEXT,
  contact_channel   TEXT CHECK (contact_channel IN ('whatsapp','email','auto')),  -- auto = logged-in auto-attach
  contact_verified  BOOLEAN NOT NULL DEFAULT false,
  page_url          TEXT,
  user_agent        TEXT,
  reason            TEXT,                             -- sensitive|no_match|retrieval_error|model_unsure|manual
  summary           TEXT,                             -- one-sentence AI summary of the issue
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','replied','closed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bot_escalations_created_idx ON bot_escalations (created_at DESC);
CREATE INDEX IF NOT EXISTS bot_escalations_conv_idx    ON bot_escalations (conversation_id);
ALTER TABLE bot_escalations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bot_escalations FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS bot_escalation_replies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id  UUID NOT NULL REFERENCES bot_escalations(id) ON DELETE CASCADE,
  channel        TEXT NOT NULL CHECK (channel IN ('email','whatsapp','note')),
  body           TEXT NOT NULL,
  sent_by        TEXT,                                -- admin id/email that authored the reply
  delivered      BOOLEAN NOT NULL DEFAULT false,      -- email actually sent (wa/note = false, informational)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bot_escalation_replies_esc_idx ON bot_escalation_replies (escalation_id, created_at);
ALTER TABLE bot_escalation_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bot_escalation_replies FROM anon, authenticated;
