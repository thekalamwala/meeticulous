-- v3.215 — Rebrand leftover "Book A Sloth" text in notification data
--
-- Context (intern bug #6, 2026-11-14): the v3.180 rebrand swept blogs,
-- crm_templates, badges and some column DEFAULTs, but NEVER touched
-- `notification_events`. The only brand-bearing text column there is
-- `email_subject` (there is NO body/otp_message column — WhatsApp message
-- bodies live entirely on the AiSensy platform, keyed by `campaign_name`,
-- so they are NOT fixed by this migration — update them in AiSensy).
--
-- Seed rows still reading "Book A Sloth" (from v1.9_notification_system.sql:60):
--   BOOKING_OTP     'Your Book A Sloth verification code'
--   PASSWORD_RESET  'Your Book A Sloth password reset code'
--   VENDOR_WELCOME  'Welcome to Book A Sloth'
-- GUEST_WELCOME (v3.169) and the activation-nudge rows (v3.163/v3.164) may also
-- carry it. This does a blanket, idempotent replace so any such row is covered.
--
-- Idempotent and additive (UPDATEs only). Safe to run more than once.
-- Run on the live DB (spquowzrefozmrzoszkf). NOT YET APPLIED — see CLAUDE.md.

UPDATE notification_events
   SET email_subject = replace(replace(email_subject, 'Book A Sloth', 'Meeticulous'), 'BookASloth', 'Meeticulous'),
       updated_at    = now()
 WHERE email_subject ILIKE '%book a sloth%'
    OR email_subject ILIKE '%bookasloth%';

-- Defensive: the Tithi/Bolt FAQ self-intro row seeded by v3.84 referenced the old
-- brand ("the Book A Sloth assistant"). botFaqs.json has since been re-synced clean,
-- but a stale row may remain. Replace the company name only (NOT the assistant name).
UPDATE bot_faqs
   SET answer = replace(answer, 'Book A Sloth', 'Meeticulous')
 WHERE answer ILIKE '%book a sloth%';

UPDATE bot_faqs
   SET question = replace(question, 'Book A Sloth', 'Meeticulous')
 WHERE question ILIKE '%book a sloth%';
