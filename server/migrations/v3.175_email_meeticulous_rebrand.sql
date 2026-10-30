-- v3.175 — Email rebrand: Book A Sloth → Meeticulous
-- ---------------------------------------------------------------------------
-- Global email settings + sender personas move to the Meeticulous brand, the
-- maroon palette (#960D32) and the verified meeticulous.com sending domain.
--
-- Template COPY (subjects/html_content/sender_key) is NOT changed here — it is
-- re-pushed from config/emailTemplates.js by `node scripts/seedEmailTemplates.js`,
-- which must run on each DB right AFTER this migration (see docs/current-work.md).
--
-- Idempotent UPDATEs. Apply on BOTH DBs (staging first, then prod at deploy).
-- NOTE: this flips LIVE email branding the moment it lands, independent of the
-- client/server code deploy — treat it as a deploy-time step, not a dev-time one.

-- 1) Global sender + brand (email_settings is a singleton; UPDATE all rows).
update email_settings set
  from_name     = 'Meeticulous',
  from_email    = 'hello@meeticulous.com',
  support_email = 'hello@meeticulous.com',
  website_url   = 'https://meeticulous.com',
  brand_color   = '#960D32';

-- 2) Sender personas.
--    • system   → Meeticulous, noreply@meeticulous.com (kept)
--    • tithi    → Tithi, sends from tithi@meeticulous.com
--    • shubham  → founder; now also carries what durga/sujata used to send
--    • durga/sujata → deactivated (templates repointed to shubham by the seed)
update email_senders
  set from_name = 'Meeticulous', from_email = 'noreply@meeticulous.com', reply_to = null
  where sender_key = 'system';

update email_senders
  set from_name = 'Tithi | Meeticulous', from_email = 'tithi@meeticulous.com', reply_to = 'tithi@meeticulous.com', active = true
  where sender_key = 'tithi';

update email_senders
  set from_name = 'Shubham | Founder, Meeticulous', from_email = 'shubham@meeticulous.com', reply_to = 'shubham@meeticulous.com', active = true
  where sender_key = 'shubham';

update email_senders
  set active = false
  where sender_key in ('durga', 'sujata');
