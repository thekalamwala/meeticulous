-- v3.75 — enterprise lead capture (public /enterprise page)
create table if not exists enterprise_leads (
  id                uuid primary key default gen_random_uuid(),
  org_name          text not null,
  website           text,
  industry          text,
  team_size         text,
  locations         text,
  monthly_bookings  text,
  current_software  text,
  integrations      text,
  phone             text,
  email             text not null,
  requirements      text,
  source            text default 'enterprise_page',
  status            text default 'new',
  created_at        timestamptz default now()
);
alter table enterprise_leads enable row level security;
-- No public policy: writes go through server service_role only. Admin reads via service_role.
create index if not exists idx_enterprise_leads_created_at on enterprise_leads (created_at desc);
