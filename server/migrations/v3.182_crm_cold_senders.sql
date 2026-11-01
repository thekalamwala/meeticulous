-- v3.182 — CRM cold-outreach senders on the separate meeticulous.in root (email plan PR-5).
--
-- CRM messages to leads resolve senderRegistry.forCrm(persona): an ACTIVE
-- crm_<persona> row wins, otherwise the persona's normal sender (today's
-- behaviour). Rows ship INACTIVE. Flip each on only after:
--   1. mail.meeticulous.in shows "Authenticated" in Brevo (SPF + DKIM + DMARC), and
--   2. the reply_to mailbox exists and receives mail (Hostinger on meeticulous.in).
-- Turn on:  UPDATE email_senders SET active = true  WHERE sender_key IN ('crm_shubham','crm_tithi');
-- Roll back: UPDATE email_senders SET active = false WHERE sender_key IN ('crm_shubham','crm_tithi');
-- (senderRegistry caches 60s.) Additive, idempotent.

INSERT INTO email_senders (sender_key, from_name, from_email, reply_to, stream, list_unsubscribe, active, provider)
VALUES
  ('crm_shubham', 'Shubham | Meeticulous', 'shubham@mail.meeticulous.in', 'shubham@meeticulous.in', 'crm', true, false, 'brevo'),
  ('crm_tithi',   'Tithi | Meeticulous',   'tithi@mail.meeticulous.in',   'tithi@meeticulous.in',   'crm', true, false, 'brevo')
ON CONFLICT (sender_key) DO NOTHING;
