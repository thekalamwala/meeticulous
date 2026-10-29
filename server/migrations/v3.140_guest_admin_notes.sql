-- v3.140 — Guest 360 admin notes (Phase 3 write actions).
-- Guests are not always a profiles row (logged-out OTP bookings), so notes are
-- keyed by the CRM customer key (utils/customerKey: 'p:<10digits>' | 'e:<email>')
-- as TEXT, not a profile FK — mirroring how Guest 360 resolves identity.
-- RLS-enabled with NO policies = service-role only (reached via supabaseAdmin),
-- same posture as host_admin_notes (v3.80).
-- Apply to BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).

create table if not exists guest_admin_notes (
  id          uuid primary key default gen_random_uuid(),
  guest_key   text not null,
  admin_id    uuid,
  admin_email text,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table guest_admin_notes enable row level security;
create index if not exists idx_guest_admin_notes_key on guest_admin_notes(guest_key, created_at desc);
