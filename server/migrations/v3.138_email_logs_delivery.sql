-- v3.138 — Email delivery tracking on email_logs.
--
-- The Resend webhook already funnels delivered/bounced/opened events into the
-- CRM (crm_messages). This lets the SAME events also update the transactional
-- email_logs row, so a campaign's per-recipient delivery status is visible in
-- the admin Campaigns history — not just "sent" at send time.
--
--   provider_message_id  the Resend email id, stored at delivery so the webhook
--                        can match the row (email_logs had only provider_response
--                        jsonb before — not queryable).
--   delivered_at         set on email.delivered.
--   bounced_at           set on email.bounced / email.complained.
--
-- email_logs.status gains 'delivered' / 'bounced' (no CHECK constraint on the
-- column, so no constraint change needed).
--
-- Apply on BOTH DBs (prod Mumbai + staging Tokyo). Additive/nullable; the send
-- path and webhook both no-op gracefully if the columns are absent.

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS email_logs_provider_message_id_idx
  ON email_logs (provider_message_id)
  WHERE provider_message_id IS NOT NULL;
