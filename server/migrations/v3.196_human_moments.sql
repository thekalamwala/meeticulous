-- ============================================================
-- v3.196 — Human-moment events (Humanity track, PR-7)
-- ------------------------------------------------------------
-- The second stage of the Humanity track (docs/email-journey-map.md).
-- Metric-driven moments where the trigger is a state change in the
-- user's activity, not a calendar date. All Founder frame, Shubham
-- sender, email ON, WhatsApp OFF, in-app OFF.
--
-- 8 of the 9 events from the map ship in PR-7. HOST_PROFESSION_MILESTONE
-- (the profession-flavoured variant of MILESTONE_10/50/100) is deferred
-- to a follow-up PR because it needs template-level conditionals so it
-- doesn't double-send with the existing MILESTONE_* events.
--
-- Services/humanMoments.js runs a daily scan, detects each state and
-- fires the event once per user (deduped forever on notification_logs
-- for the firsts; 90d dedupe for the recurring streak/explorer ones).
--
-- SAFETY — double-gated:
--   1. feature_flag `human_moments` (seeded OFF below).
--   2. notification_events.is_active + email_enabled (ON here).
--
-- Additive. Idempotent. Apply to the Meeticulous DB (spquowzrefozmrzoszkf).
-- ============================================================

INSERT INTO notification_events
  (event_key, display_name, campaign_name, email_subject,
   whatsapp_enabled, email_enabled, in_app_enabled, is_active)
VALUES
  ('HOST_FIRST_REVIEW',
   'Host — first review',
   NULL,
   'Someone said something nice about you',
   false, true, false, true),
  ('HOST_FIRST_FIVE_STAR',
   'Host — first 5-star',
   NULL,
   'Your first five stars, {{first_name}}',
   false, true, false, true),
  ('HOST_PERFECT_MONTH',
   'Host — perfect month',
   NULL,
   'A perfect month, {{first_name}}',
   false, true, false, true),
  ('HOST_BOOKING_STREAK',
   'Host — 3-week booking streak',
   NULL,
   'Three weeks in a row, {{first_name}}',
   false, true, false, true),
  ('HOST_FIRST_REPEAT',
   'Host — first repeat guest',
   NULL,
   'They came back, {{first_name}}',
   false, true, false, true),
  ('GUEST_EXPLORER_5_HOSTS',
   'Guest — explorer (5 hosts)',
   NULL,
   'Five hosts in, {{first_name}}',
   false, true, false, true),
  ('GUEST_COMEBACK',
   'Guest — comeback after 90d',
   NULL,
   'Good to see you again, {{first_name}}',
   false, true, false, true),
  ('GUEST_REVIEW_LANDED',
   'Guest — review landed',
   NULL,
   'Your words reached them',
   false, true, false, true)
ON CONFLICT (event_key) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  email_subject = EXCLUDED.email_subject,
  updated_at    = now();

INSERT INTO feature_flags (key, label, category, scope, enabled, description)
VALUES ('human_moments',
        'Human-moment nudges',
        'Notifications',
        'global',
        false,
        'Master switch for services/humanMoments.js. OFF = no sends. ON = daily cron fires first-review, first-5-star, perfect-month, booking-streak, first-repeat-guest, explorer, comeback and review-landed moments.')
ON CONFLICT (key) DO NOTHING;
