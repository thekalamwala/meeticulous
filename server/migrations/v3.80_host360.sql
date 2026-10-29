-- v3.80 — Host 360 admin module
-- Admin operational command-center for a single host. Aggregation layer.
-- New: account_managers, profiles.account_manager_id, host_admin_notes, host_documents.
-- All tables RLS-enabled with NO policies = service-role only (reached via supabaseAdmin).
-- Documents reuse the existing private `kyc` storage bucket (keys namespaced host-docs/<hostId>/).
-- Applied both DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).

create table if not exists account_managers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  phone      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table account_managers enable row level security;

alter table profiles
  add column if not exists account_manager_id uuid references account_managers(id) on delete set null;
create index if not exists idx_profiles_account_manager on profiles(account_manager_id);

create table if not exists host_admin_notes (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references profiles(id) on delete cascade,
  admin_id    uuid,
  admin_email text,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table host_admin_notes enable row level security;
create index if not exists idx_host_admin_notes_host on host_admin_notes(host_id, created_at desc);

create table if not exists host_documents (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references profiles(id) on delete cascade,
  uploaded_by uuid,
  storage_key text not null,
  file_name   text,
  mime_type   text,
  size_bytes  integer,
  doc_type    text,
  created_at  timestamptz not null default now()
);
alter table host_documents enable row level security;
create index if not exists idx_host_documents_host on host_documents(host_id, created_at desc);
