-- ============================================================
-- v3.197 — Empathy track (Humanity track, PR-8)
-- ------------------------------------------------------------
-- Closes the Humanity track from docs/email-journey-map.md.
--
-- Two new events + two template reframes (reframes are code-only;
-- templateSync picks them up on prod boot).
--
-- NEW EVENTS:
--   HOST_LOW_RATINGS_RUN     shubham, Founder frame, no CTA.
--                            Fires when a host receives 3 ratings in a
--                            row <= 3 stars. Private note, offers a call.
--   ACCOUNT_PAUSED_BY_USER   shubham, Founder frame.
--                            Fires when a host disables their own hosting
--                            mode. "We'll keep it safe." Detection
--                            deferred — needs profiles.host_paused_at
--                            (no such column today). Event seeded so the
--                            trigger can be wired without a second migration.
--
-- Both ship:
--   is_active       = true
--   email_enabled   = true
--   whatsapp_enabled= false
--   in_app_enabled  = false
--
-- Nothing sends until the master feature flag `empathy_track` is
-- flipped on, AND (for ACCOUNT_PAUSED_BY_USER) a follow-up PR adds the
-- schema + trigger. HOST_LOW_RATINGS_RUN wires through a new scan on
-- services/humanMoments.js in this PR.
--
-- Additive. Idempotent. Apply to the Meeticulous DB (spquowzrefozmrzoszkf).
-- ============================================================

INSERT INTO notification_events
  (event_key, display_name, campaign_name, email_subject,
   whatsapp_enabled, email_enabled, in_app_enabled, is_active)
VALUES
  ('HOST_LOW_RATINGS_RUN',
   'Host — 3 low ratings in a row',
   NULL,
   'Hey {{first_name}}, a private note',
   false, true, false, true),
  ('ACCOUNT_PAUSED_BY_USER',
   'Host — paused their own page',
   NULL,
   'We''ll keep it safe, {{first_name}}',
   false, true, false, true)
ON CONFLICT (event_key) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  email_subject = EXCLUDED.email_subject,
  updated_at    = now();

INSERT INTO feature_flags (key, label, category, scope, enabled, description)
VALUES ('empathy_track',
        'Empathy track (low-ratings + paused)',
        'Notifications',
        'global',
        false,
        'Master switch for the empathy-track scans in services/humanMoments.js. OFF = no sends. ON = enables HOST_LOW_RATINGS_RUN scan + (future) ACCOUNT_PAUSED_BY_USER trigger.')
ON CONFLICT (key) DO NOTHING;
