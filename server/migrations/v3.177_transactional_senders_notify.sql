-- v3.177 — Transactional cutover to notify.meeticulous.com
-- ---------------------------------------------------------------------------
-- Activates the four transactional senders on the VERIFIED notify. subdomain
-- (Resend). Templates are repointed to these sender_keys in
-- config/emailTemplates.js — run `node scripts/seedEmailTemplates.js` after this
-- so the email_templates rows carry the new sender_key.
--
-- Reply-to = team@meeticulous.com (live Workspace inbox). Provider = resend
-- (notify. is verified there). Requires the email_senders.provider column
-- (migration v3.176). Idempotent. Apply on every live DB.
--
-- PRECONDITION: notify.meeticulous.com is VERIFIED in Resend. Rollback: set these
-- rows active=false (sends fall back to email_settings) — so flip is instant.

insert into email_senders (sender_key, from_name, from_email, reply_to, stream, list_unsubscribe, active, provider) values
  ('verify',   'Meeticulous', 'verify@notify.meeticulous.com',   'team@meeticulous.com', 'transactional', false, true, 'resend'),
  ('bookings', 'Meeticulous', 'bookings@notify.meeticulous.com', 'team@meeticulous.com', 'transactional', false, true, 'resend'),
  ('payments', 'Meeticulous', 'payments@notify.meeticulous.com', 'team@meeticulous.com', 'transactional', false, true, 'resend'),
  ('account',  'Meeticulous', 'account@notify.meeticulous.com',  'team@meeticulous.com', 'transactional', false, true, 'resend')
on conflict (sender_key) do update set
  from_name = excluded.from_name, from_email = excluded.from_email, reply_to = excluded.reply_to,
  stream = excluded.stream, active = true, provider = excluded.provider;

-- Global default + system fallback onto notify (so even an un-keyed send is on-brand/on-domain).
update email_settings set from_email = 'verify@notify.meeticulous.com';
update email_senders set from_email = 'verify@notify.meeticulous.com', reply_to = 'team@meeticulous.com', provider = 'resend'
  where sender_key = 'system';
