-- v3.58 — Generic follow-up engine ledger (Rebook Nudge #3).
-- One row = one scheduled nudge (a single step of a flow for one source entity).
-- Vertical-agnostic: source_type/source_id keep it decoupled from bookings.
create table if not exists public.scheduled_followups (
  id                 uuid primary key default gen_random_uuid(),
  source_type        text        not null,
  source_id          uuid        not null,
  host_id            uuid        not null,
  recipient_user_id  uuid,
  flow_key           text        not null,
  step               integer     not null,
  audience           text        not null default 'customer',
  event_key          text        not null,
  due_at             timestamptz not null,
  status             text        not null default 'pending'
                       check (status in ('pending','sent','skipped','cancelled','failed')),
  skip_reason        text,
  sent_at            timestamptz,
  attempts           integer     not null default 0,
  payload            jsonb       not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists scheduled_followups_dedup_idx
  on public.scheduled_followups (source_type, source_id, flow_key, step);

create index if not exists scheduled_followups_due_pending_idx
  on public.scheduled_followups (due_at)
  where status = 'pending';

alter table public.scheduled_followups enable row level security;
-- Deny-all: service-role (supabaseAdmin) bypasses RLS; no anon/auth policy added.
