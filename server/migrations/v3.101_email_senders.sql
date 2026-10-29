-- v3.101_email_senders.sql
-- Persona senders for lifecycle email. Each email_templates row may carry a
-- sender_key pointing at a person here; communicationEngine resolves it to a
-- From name / address / reply-to at send time. Fully additive + schema-safe:
-- senderRegistry falls back to the global email_settings sender when a template
-- has no sender_key, the key is unknown, or this table is absent — so nothing
-- breaks if the code deploys before this migration runs.
--
-- Apply on BOTH databases (prod Mumbai + staging Tokyo), then reseed templates:
--   node scripts/seedEmailTemplates.js   (carries sender_key onto the rows)

create table if not exists email_senders (
  sender_key        text primary key,
  from_name         text not null,
  from_email        text not null,
  reply_to          text,
  stream            text not null default 'transactional',
  list_unsubscribe  boolean not null default false,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

alter table email_templates add column if not exists sender_key text;

-- Persona roster (idempotent). Names/addresses per the sender-separation plan.
insert into email_senders (sender_key, from_name, from_email, reply_to, stream, list_unsubscribe) values
  ('system',  'Book A Sloth',                       'noreply@bookasloth.in',  null,                     'system',       false),
  ('tithi',   'Tithi | Book A Sloth',               'tithi@bookasloth.in',    'tithi@bookasloth.in',    'relationship', false),
  ('durga',   'Durga | Operations, Book A Sloth',   'durga@bookasloth.in',    'durga@bookasloth.in',    'engagement',   false),
  ('sujata',  'Sujata | Marketing, Book A Sloth',   'sujata@bookasloth.in',   'sujata@bookasloth.in',   'marketing',    true),
  ('shubham', 'Shubham | Founder, Book A Sloth',    'shubham@bookasloth.in',  'shubham@bookasloth.in',  'founder',      false)
on conflict (sender_key) do nothing;
