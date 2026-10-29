-- v3.39 — In-app notifications feed (bell panel).
-- Distinct from notification_logs (email/WhatsApp delivery telemetry) and from
-- the external NotificationEngine. Rows are written server-side via service_role
-- only; per the security sweep, anon/authenticated get NO direct grants.

create table if not exists in_app_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  role        text not null default 'guest' check (role in ('guest','host')),
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_in_app_notif_feed
  on in_app_notifications (user_id, role, created_at desc);
create index if not exists idx_in_app_notif_unread
  on in_app_notifications (user_id, role) where read_at is null;

alter table in_app_notifications enable row level security;
revoke all on in_app_notifications from anon, authenticated;
