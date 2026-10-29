-- v3.157 — Email engagement tracking on email_logs (opens + clicks).
--
-- Extends v3.138 (which added delivered_at/bounced_at). The Resend webhook is
-- already subscribed to email.opened / email.clicked; this gives those events a
-- column to land in so a campaign's open/click counts show in the admin
-- Campaigns history — not just delivered/bounced.
--
--   opened_at   first email.opened for the row (first-touch wins; not overwritten).
--   clicked_at  first email.clicked for the row.
--
-- Unlike delivered/bounced these DON'T change email_logs.status — an opened or
-- clicked email is still 'delivered'. They're pure engagement timestamps.
--
-- Apply on BOTH DBs (prod Mumbai + staging Tokyo). Additive/nullable; the webhook
-- no-ops gracefully (schema fallback in communicationEngine.recordEmailLogDelivery)
-- if the columns are absent.

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS opened_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
