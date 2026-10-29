-- v3.7_email_unsubscribes.sql — marketing email opt-out list.
--
-- Keyed by EMAIL (not user_id): guests book without an account, so the opt-out
-- must work for an address that may have no profile row.
--
-- Only MARKETING/lifecycle emails honor this list (badges, milestones, birthday,
-- anniversary, profile-completion nudges, campaigns). Transactional email — OTP,
-- booking confirmations, payment receipts, security alerts — always sends and is
-- NOT gated by this table (CAN-SPAM / GDPR transactional carve-out).
--
-- Enforcement lives in server/services/email/communicationEngine.js
-- (isUnsubscribed + MARKETING_EVENTS). If this table is missing, the engine
-- treats everyone as subscribed (fails open — never silently drops mail).
--
-- email_logs.status also gains the value 'suppressed' for sends skipped here.
-- status is a free-text column, so no enum change is required.

create table if not exists email_unsubscribes (
  email           text primary key,
  unsubscribed_at timestamptz not null default now(),
  source          text                 default 'email_link'
);

-- Service-role only: the public unsubscribe endpoint goes through the server
-- (supabaseAdmin), never the browser anon client.
alter table email_unsubscribes enable row level security;
