-- ============================================================
-- v3.109 — Lead engagement stamp (behavioural lead score).
--
-- Set by the provider webhooks (Resend open/click, AiSensy read/reply) to the
-- time of the last POSITIVE engagement. Feeds the lead score so a lead who
-- actually opened/replied ranks hotter than one we only messaged.
--
-- Additive. Run staging (Tokyo) → prod (Mumbai).
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_engaged_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_leads_last_engaged ON leads (last_engaged_at DESC);
