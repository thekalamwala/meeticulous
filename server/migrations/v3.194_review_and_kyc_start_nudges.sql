-- ============================================================
-- v3.194 — Two new engagement events: HOST_START_KYC_NUDGE + GUEST_REVIEW_NUDGE
-- ------------------------------------------------------------
-- From docs/email-journey-map.md PR-4. Two independent gaps:
--
--   HOST_START_KYC_NUDGE  tithi    Fires 2d after signup, onboarding not complete.
--                                  Served by services/activationNudges.js (new rule).
--                                  Gated by feature flag `activation_nudges` (v3.192).
--
--   GUEST_REVIEW_NUDGE    tithi    Fires 48h after a completed, paid booking
--                                  with no review row from the guest.
--                                  Served by services/reviewNudges.js (new).
--                                  Gated by feature flag `review_nudges` (seeded OFF here).
--
-- Both ship:
--   is_active       = true
--   email_enabled   = true
--   whatsapp_enabled= false
--   in_app_enabled  = false
--
-- Nothing sends until each service's master feature flag is flipped on.
--
-- Additive. Idempotent. Apply to the Meeticulous DB (spquowzrefozmrzoszkf).
-- ============================================================

INSERT INTO notification_events
  (event_key, display_name, campaign_name, email_subject,
   whatsapp_enabled, email_enabled, in_app_enabled, is_active)
VALUES
  ('HOST_START_KYC_NUDGE',
   'Host — start KYC',
   NULL,
   'Finish your Meeticulous setup, {{first_name}}',
   false, true, false, true),
  ('GUEST_REVIEW_NUDGE',
   'Guest — review nudge',
   NULL,
   'How was your session with {{vendor_name}}?',
   false, true, false, true)
ON CONFLICT (event_key) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  email_subject = EXCLUDED.email_subject,
  updated_at    = now();

INSERT INTO feature_flags (key, label, category, scope, enabled, description)
VALUES ('review_nudges',
        'Guest review nudges',
        'Notifications',
        'global',
        false,
        'Master switch for services/reviewNudges.js. OFF = no sends. ON = hourly cron asks guests for a review 48h after a completed paid booking with no review yet.')
ON CONFLICT (key) DO NOTHING;
