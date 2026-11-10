-- ============================================================
-- v3.200 — Community email floor (ship-day MVP)
-- ------------------------------------------------------------
-- Adds ONE new user-side notification event: COMMUNITY_ANSWER_ACCEPTED.
-- Everything else in docs/community-email-plan.md ships in later PRs with
-- its own cron/service.
--
-- Admin pings (flag / first-post-from-new-member / ban-applied) do NOT need
-- a notification_events row — they reuse utils/adminAlert.js (branded,
-- throttled 15m per key, never throws). No migration surface for them.
--
-- The existing `community` master flag (v3.185) gates the user-side event.
-- email_enabled and in_app_enabled default ON; the event is inert until a
-- controller fires it (see server/controllers/communityController.js
-- acceptAnswer). Idempotent.
-- ============================================================

INSERT INTO notification_events
  (event_key, display_name, email_enabled, whatsapp_enabled, in_app_enabled, is_active, email_subject)
VALUES
  ('COMMUNITY_ANSWER_ACCEPTED',
   'Community answer accepted',
   TRUE, FALSE, TRUE, TRUE,
   'Your answer was accepted')
ON CONFLICT (event_key) DO UPDATE
  SET in_app_enabled = EXCLUDED.in_app_enabled,
      email_enabled  = EXCLUDED.email_enabled,
      is_active      = EXCLUDED.is_active;
