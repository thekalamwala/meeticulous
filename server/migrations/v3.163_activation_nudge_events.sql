-- v3.163 — Host activation nudge events (WhatsApp campaigns wired, ALL OFF)
-- ---------------------------------------------------------------------------
-- Four NotificationEngine events for the activation funnel. Each carries its
-- AiSensy campaign_name in the house format ("<Title Case> - Vendor", matching
-- Booking Reminder - Vendor etc). Seeded with EVERY channel OFF and is_active
-- FALSE — nothing sends until the founder:
--   1. Creates + gets Meta approval for each campaign in AiSensy (exact name),
--   2. Flips whatsapp_enabled + is_active true for that row.
-- WhatsApp template params (both): {{1}} = host first name, {{2}} = deep link.
-- Upsert by event_key; never re-enables a row an admin already turned on.

insert into notification_events
  (event_key, display_name, campaign_name, email_subject, whatsapp_enabled, email_enabled, in_app_enabled, is_active)
values
  ('HOST_ADD_SERVICE_NUDGE',   'Host — add first service',     'Add Your First Service - Vendor',  'Your Book A Sloth page is empty',       false, false, false, false),
  ('HOST_SHARE_LINK_NUDGE',    'Host — share booking link',    'Share Your Booking Link - Vendor', 'Your page is live — now share it',      false, false, false, false),
  ('HOST_FIRST_BOOKING_NUDGE', 'Host — get first booking',     'Get Your First Booking - Vendor',  'Still no bookings? Here''s the fastest fix', false, false, false, false),
  ('HOST_PAYOUT_WAITING_NUDGE','Host — payout waiting (KYC)',  'Payout Waiting - Vendor',          'You have a payout waiting',             false, false, false, false)
on conflict (event_key) do update set
  display_name  = excluded.display_name,
  campaign_name = excluded.campaign_name,
  email_subject = excluded.email_subject;
