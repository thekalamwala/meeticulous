-- ============================================================
-- v3.113 — leads.last_reply_at for the Sales Desk "unanswered replies" queue.
--
-- webhookEvents stamps this on an actual inbound reply (whatsapp_reply) — NOT on
-- passive opens/clicks (those bump last_engaged_at). The Desk's Replies / Needs-
-- Attention queues compare last_reply_at > coalesce(last_contacted_at, created_at)
-- to surface leads who answered and haven't been answered back.
--
-- Additive, RLS unchanged. Run staging (Tokyo) → prod (Mumbai).
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ;

-- Partial index: only leads that have ever replied (the small hot set the queue scans).
CREATE INDEX IF NOT EXISTS idx_leads_last_reply
  ON leads (last_reply_at DESC) WHERE last_reply_at IS NOT NULL;
