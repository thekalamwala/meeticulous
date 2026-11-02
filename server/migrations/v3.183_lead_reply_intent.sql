-- ============================================================
-- v3.183 — leads.last_reply_intent: the AI label on the lead's latest reply.
--
-- Written by brevoInboundController (CRM email replies via Brevo inbound
-- parsing → replyClassifier). The Sales Desk "Replied — unanswered" queue sorts
-- by it (interested/question first) and shows it as the queue reason. The full
-- label (confidence, summary, text) lives on the email_reply lead_activities row.
--
-- Free text, no CHECK: the label set lives in replyClassifier.INTENTS and may grow.
-- Additive, RLS unchanged. Code is schema-fallback safe (the stamp is skipped
-- when the column is missing).
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_reply_intent TEXT;
