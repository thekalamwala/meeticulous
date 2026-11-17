-- v3.220 — membership notification events (M8). In-app first (email/WhatsApp OFF;
-- flip email on once templates exist). Idempotent. APPLY TO the Meeticulous DB.
INSERT INTO notification_events
  (event_key, display_name, email_enabled, whatsapp_enabled, in_app_enabled, is_active, email_subject)
VALUES
  ('MEMBERSHIP_NEW_MEMBER',     'New member joined',        FALSE, FALSE, TRUE, TRUE, 'You have a new member'),
  ('MEMBERSHIP_PAYMENT_FAILED', 'Membership payment failed', FALSE, FALSE, TRUE, TRUE, 'Your membership payment failed'),
  ('MEMBERSHIP_RENEWED',        'Membership renewed',       FALSE, FALSE, TRUE, TRUE, 'Your membership renewed'),
  ('MEMBERSHIP_NEW_POST',       'New members-only post',    FALSE, FALSE, TRUE, TRUE, 'New members-only post')
ON CONFLICT (event_key) DO UPDATE
  SET in_app_enabled = EXCLUDED.in_app_enabled, is_active = EXCLUDED.is_active;
