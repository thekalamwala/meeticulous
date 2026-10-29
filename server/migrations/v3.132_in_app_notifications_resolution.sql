-- v3.132 — In-app notification resolution.
--
-- Adds in_app_notifications.resolved_at so a notification can be closed out once
-- the host fixes the underlying problem (KYC re-approved resolves KYC_REJECTED;
-- a successful charge resolves SUBSCRIPTION_HALTED). resolveInApp() marks matching
-- unresolved rows read + stamps resolved_at, so the notice stops "shouting" — the
-- unread badge (and any banner keyed on it) clears.
--
-- Apply on BOTH DBs (prod Mumbai + staging Tokyo). inAppNotify.resolveInApp keeps a
-- schema fallback: with the column absent it just marks the rows read, so nothing
-- breaks before this runs.
--
-- Note: the migration-number space has a cosmetic collision — v3.130 exists as both
-- the CRM merge_lead_rows fn and the notification in_app_channel migration (both
-- already applied). This file uses v3.132 to sit after v3.131 (dedupe).

ALTER TABLE in_app_notifications
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
