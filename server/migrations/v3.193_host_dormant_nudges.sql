-- ============================================================
-- v3.193 — Host dormant nudge events (30 / 60 / 90 days)
-- ------------------------------------------------------------
-- Adds the dormant / win-back track for hosts who've had activity
-- (completed_bookings >= 1) but have gone quiet. Three stages
-- escalating in voice and tone:
--
--   HOST_DORMANT_30D  tithi, "everything OK?"  (nudge)
--   HOST_DORMANT_60D  shubham, personal note   (ask)
--   HOST_DORMANT_90D  shubham, final one-liner (goodbye-or-stay)
--
-- All three ship:
--   is_active      = true
--   email_enabled  = true    (channel on)
--   whatsapp_enabled = false (AiSensy templates not planned for dormant)
--   in_app_enabled = false
--
-- Nothing sends until the master feature flag `dormant_nudges`
-- (seeded OFF below) is flipped on. Same double-gate as PR-1
-- (v3.192 / activation_nudges).
--
-- The job (services/dormancyNudges.js) reads vendor_metrics
-- (inactive_days + completed_bookings) and emits one event per host
-- per stage, deduped via notification_logs (60-day window).
--
-- Additive. Idempotent. Apply to both DBs (Meeticulous DB only today).
-- ============================================================

INSERT INTO notification_events
  (event_key, display_name, campaign_name, email_subject,
   whatsapp_enabled, email_enabled, in_app_enabled, is_active)
VALUES
  ('HOST_DORMANT_30D',
   'Host — 30 days quiet',
   NULL,
   'Everything ok, {{first_name}}?',
   false, true, false, true),
  ('HOST_DORMANT_60D',
   'Host — 60 days quiet',
   NULL,
   'A note from Shubham',
   false, true, false, true),
  ('HOST_DORMANT_90D',
   'Host — 90 days quiet (final)',
   NULL,
   'Last note from me',
   false, true, false, true)
ON CONFLICT (event_key) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  email_subject = EXCLUDED.email_subject,
  updated_at    = now();

INSERT INTO feature_flags (key, label, category, scope, enabled, description)
VALUES ('dormant_nudges',
        'Host dormant nudges',
        'Notifications',
        'global',
        false,
        'Master switch for services/dormancyNudges.js. OFF = no sends. ON = daily cron fires the 30 / 60 / 90-day dormant track for hosts.')
ON CONFLICT (key) DO NOTHING;
