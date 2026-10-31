-- v3.178 — Lifecycle cutover to team.meeticulous.com
-- Flip tithi/shubham persona senders onto the verified team. subdomain (Resend).
-- Templates already carry sender_key tithi/shubham — migration-only.
-- Tithi replies → team@; Shubham's founder notes → shubham@. Needs v3.176.
-- Idempotent. Rollback: restore mail.meeticulous.in on these rows.
update email_senders set from_email = 'tithi@team.meeticulous.com',   reply_to = 'team@meeticulous.com',    provider = 'resend', active = true where sender_key = 'tithi';
update email_senders set from_email = 'shubham@team.meeticulous.com', reply_to = 'shubham@meeticulous.com', provider = 'resend', active = true where sender_key = 'shubham';
