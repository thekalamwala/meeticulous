-- v3.169_guest_welcome_event.sql
-- Guest welcome email (founder voice, from Shubham) — NotificationEngine event.
-- Fired once when a brand-new guest account is created (OTP or email/password).
-- Additive + idempotent + schema-safe: the NotificationEngine falls back to
-- email-only if this row is absent, and the email_templates row (seeded by
-- scripts/seedEmailTemplates.js) carries sender_key='shubham', which senderRegistry
-- resolves to the founder From identity.
--
-- Apply on BOTH databases (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo
-- xwvciqkayammbvsidqig), then reseed templates so the email_templates row exists:
--   node scripts/seedEmailTemplates.js
--
-- Email ON, WhatsApp OFF, in-app OFF, active. Upsert by event_key; never disturbs
-- an existing row an admin may have tuned.

insert into notification_events
  (event_key, display_name, whatsapp_enabled, email_enabled, in_app_enabled, is_active, email_subject)
values
  ('GUEST_WELCOME', 'Guest Welcome', false, true, false, true, 'Welcome to Book A Sloth')
on conflict (event_key) do update set
  display_name  = excluded.display_name,
  email_subject = excluded.email_subject;
