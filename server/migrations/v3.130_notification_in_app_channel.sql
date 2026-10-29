-- v3.130 — In-app as a first-class NotificationEngine channel.
--
-- Adds notification_events.in_app_enabled so the engine can fan a semantic event
-- out to in-app (the bell) alongside email/WhatsApp, gated per event exactly like
-- whatsapp_enabled. Also seeds two previously-silent host events:
--   SUBSCRIPTION_HALTED       — a renewal charge kept failing (plan at risk)
--   REFERRAL_REWARD_RELEASED  — the host earned a referral bonus
--
-- Apply on BOTH DBs (prod Mumbai + staging Tokyo). The engine keeps a schema
-- fallback: with the column/rows absent it defaults in-app ON when a caller
-- explicitly passes data.inApp, so nothing breaks before this runs. After it is
-- applied on both, admins control in-app per event from the notifications console.
--
-- Email for the two new events needs their templates seeded too:
--   node server/scripts/seedEmailTemplates.js   (run against BOTH DBs)
-- Until seeded, communicationEngine logs 'no_template' and the in-app note still
-- fires — safe degradation, no throw.

ALTER TABLE notification_events
  ADD COLUMN IF NOT EXISTS in_app_enabled BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO notification_events
  (event_key, display_name, email_enabled, whatsapp_enabled, in_app_enabled, is_active, email_subject)
VALUES
  ('SUBSCRIPTION_HALTED',      'Subscription payment failed', TRUE, FALSE, TRUE, TRUE, 'Your renewal didn''t go through'),
  ('REFERRAL_REWARD_RELEASED', 'Referral reward released',    TRUE, FALSE, TRUE, TRUE, 'You earned a referral reward')
ON CONFLICT (event_key) DO UPDATE
  SET in_app_enabled = EXCLUDED.in_app_enabled,
      email_enabled  = EXCLUDED.email_enabled,
      is_active      = EXCLUDED.is_active;
