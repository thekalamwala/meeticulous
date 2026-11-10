-- ============================================================
-- v3.192 — Enable the 4 host activation nudge events (email channel only)
-- ------------------------------------------------------------
-- The host activation ladder was seeded in v3.163 with every channel OFF.
-- All four code paths exist: services/activationNudges.js runs on cron
-- (server.js:356 `activation-nudges`), notificationEngine routes, templates
-- live in email_templates (seeded by v3.164). But the funnel's been silent
-- since v3.163 because notification_events.is_active=false short-circuits
-- the engine.
--
-- This migration flips email ON for the 4 events, leaving WhatsApp OFF
-- (AiSensy templates not yet approved — unchanged, same pattern as v3.163).
-- It ALSO seeds the feature_flag `activation_nudges` as OFF so the cron
-- stays short-circuited at the service level. One flip in admin
-- (`UPDATE feature_flags SET enabled=true WHERE key='activation_nudges'`)
-- turns the whole track live. Fail-closed.
--
-- Two gates on every send after this migration:
--   1. feature_flags.activation_nudges (this migration seeds OFF)
--   2. notification_events.is_active + email_enabled (this migration: ON for email)
--
-- WhatsApp stays OFF per event until AiSensy campaigns land, matching the
-- PLAN_GIFT_* pattern in CLAUDE.md.
--
-- Additive. Idempotent. APPLY TO BOTH DBs (currently Meeticulous DB only).
-- ============================================================

UPDATE notification_events
   SET is_active      = true,
       email_enabled  = true,
       updated_at     = now()
 WHERE event_key IN (
         'HOST_ADD_SERVICE_NUDGE',
         'HOST_SHARE_LINK_NUDGE',
         'HOST_FIRST_BOOKING_NUDGE',
         'HOST_PAYOUT_WAITING_NUDGE'
       );

-- Seed the master switch. Off by default — ops flips when the host_activation
-- view has been eyeballed and support is ready for the first wave of replies.
INSERT INTO feature_flags (key, label, category, scope, enabled, description)
VALUES ('activation_nudges',
        'Host activation nudges',
        'Notifications',
        'global',
        false,
        'Master switch for services/activationNudges.js. OFF = no sends. ON = cron runs the 4-stage ladder (email now, WhatsApp when AiSensy templates land).')
ON CONFLICT (key) DO NOTHING;
