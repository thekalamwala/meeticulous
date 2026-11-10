-- ============================================================
-- v3.202 — Community onboarding email sequence
-- ------------------------------------------------------------
-- Seed 5 notification_events + master flag for the 14-day welcome sequence.
--
--   COMMUNITY_WELCOME                 Day 0  (instant on acceptTerms)
--   COMMUNITY_ONBOARD_HOW             Day 2  (cron, 48h after member.created_at)
--   COMMUNITY_ONBOARD_HOT             Day 5
--   COMMUNITY_ONBOARD_FIRSTPOST       Day 9  (only if post_count + comment_count == 0)
--   COMMUNITY_ONBOARD_WINDDOWN        Day 14 (only if still zero activity)
--
-- Master flag `community_email_onboarding` (OFF). WELCOME still fires at Day 0
-- only when this flag is ON (same double-gate as every other track).
--
-- All 5 events share sender_key = 'community' (news.meeticulous.com via Brevo,
-- seeded in v3.201). WhatsApp disabled — onboarding is email-only.
--
-- Idempotent.
-- ============================================================

INSERT INTO notification_events
  (event_key, display_name, email_enabled, whatsapp_enabled, in_app_enabled, is_active, email_subject)
VALUES
  ('COMMUNITY_WELCOME',                'Community — Welcome',             TRUE, FALSE, FALSE, TRUE, 'Welcome to the Meeticulous community'),
  ('COMMUNITY_ONBOARD_HOW',            'Community — How it works',        TRUE, FALSE, FALSE, TRUE, 'How the Meeticulous community works'),
  ('COMMUNITY_ONBOARD_HOT',            'Community — Hot this week',       TRUE, FALSE, FALSE, TRUE, 'What''s hot in the community this week'),
  ('COMMUNITY_ONBOARD_FIRSTPOST',      'Community — First-post nudge',    TRUE, FALSE, FALSE, TRUE, 'Your first post is the hardest one'),
  ('COMMUNITY_ONBOARD_WINDDOWN',       'Community — Sequence wind-down',  TRUE, FALSE, FALSE, TRUE, 'One last note')
ON CONFLICT (event_key) DO UPDATE
  SET email_enabled    = EXCLUDED.email_enabled,
      whatsapp_enabled = EXCLUDED.whatsapp_enabled,
      in_app_enabled   = EXCLUDED.in_app_enabled,
      is_active        = EXCLUDED.is_active;

INSERT INTO feature_flags (key, enabled, description)
VALUES ('community_email_onboarding', false,
        'Community welcome + 4-step onboarding sequence over 14 days (double-gated with per-event is_active/email_enabled). Ships OFF.')
ON CONFLICT (key) DO NOTHING;
