-- ============================================================
-- v3.201 — community sender (Brevo, news.* root)
-- ------------------------------------------------------------
-- Separates community lifecycle mail from Tithi's existing lifecycle
-- (tithi@team.meeticulous.com on Resend) by routing it via Brevo on the
-- already-verified news.meeticulous.com root. Same reputation bucket as
-- `crm_tithi`, same provider, zero new DNS.
--
-- Prerequisite: the Brevo-side sender `community@news.meeticulous.com`
-- must be VERIFIED in the Brevo dashboard before merging — else prod
-- would try to send from an unverified Brevo address and get bounced.
--
-- After this migration applies AND the matching code change lands
-- (sender_key flip on the 4 community templates in config/emailTemplates.js),
-- the next prod boot's templateSync picks the new sender up and community
-- mail starts leaving from Brevo. No reseed needed for rows whose content
-- still matches their last seed_hash (v3.187 flow). Idempotent.
-- ============================================================

INSERT INTO email_senders
  (sender_key, from_name, from_email, reply_to, stream, provider, list_unsubscribe, active)
VALUES
  ('community',
   'Tithi at Meeticulous',
   'community@news.meeticulous.com',
   'team@meeticulous.com',
   'community',
   'brevo',
   TRUE,
   TRUE)
ON CONFLICT (sender_key) DO UPDATE
  SET from_name        = EXCLUDED.from_name,
      from_email       = EXCLUDED.from_email,
      reply_to         = EXCLUDED.reply_to,
      stream           = EXCLUDED.stream,
      provider         = EXCLUDED.provider,
      list_unsubscribe = EXCLUDED.list_unsubscribe,
      active           = EXCLUDED.active;
