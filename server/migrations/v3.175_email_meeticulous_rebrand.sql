-- v3.175 — Email rebrand: Meeticulous → Meeticulous
-- ---------------------------------------------------------------------------
-- Global email settings + sender personas move to the Meeticulous brand, the
-- maroon palette (#960D32) and the VERIFIED Resend sending domain
-- `mail.meeticulous.in`. (Website links stay meeticulous.com; only the email
-- addresses live on mail.meeticulous.in.)
--
-- Template COPY (subjects/html_content/sender_key) is re-pushed from
-- config/emailTemplates.js by `node scripts/seedEmailTemplates.js`, which must
-- run on each DB right AFTER this migration (see docs/current-work.md).
--
-- Idempotent. Apply on BOTH DBs. NOTE: this flips LIVE email branding the moment
-- it lands — treat it as a deploy-time step, not a dev-time one.

-- 1) Global sender + brand (email_settings is a singleton; UPDATE all rows).
--    Domain stays on the verified mail.meeticulous.in; brand flips to maroon.
update email_settings set
  from_name     = 'Meeticulous',
  from_email    = 'hello@mail.meeticulous.in',
  support_email = 'hello@mail.meeticulous.in',
  website_url   = 'https://meeticulous.com',
  brand_color   = '#960D32';

-- 2) Sender personas (UPSERT — the table may be empty on a fresh DB).
--    • system   → Meeticulous, noreply@mail.meeticulous.in
--    • tithi    → Tithi, tithi@mail.meeticulous.in
--    • shubham  → founder; also carries what durga/sujata used to send
--    • durga/sujata → deactivated (templates repointed to shubham by the seed)
insert into email_senders (sender_key, from_name, from_email, reply_to, stream, list_unsubscribe, active) values
  ('system',  'Meeticulous',                    'noreply@mail.meeticulous.in',  null,                           'system',       false, true),
  ('tithi',   'Tithi | Meeticulous',            'tithi@mail.meeticulous.in',    'tithi@mail.meeticulous.in',    'relationship', false, true),
  ('shubham', 'Shubham | Founder, Meeticulous', 'shubham@mail.meeticulous.in',  'shubham@mail.meeticulous.in',  'founder',      false, true)
on conflict (sender_key) do update set
  from_name = excluded.from_name,
  from_email = excluded.from_email,
  reply_to = excluded.reply_to,
  stream = excluded.stream,
  active = true;

update email_senders set active = false where sender_key in ('durga', 'sujata');
