-- v3.40 — Dedicated SERVICE categories (admin-managed marketplace taxonomy).
-- Separate from `categories` (host industry/profession taxonomy, v3.21) and from
-- per-service `services.category` slug. Supports parent/sub, icon, description,
-- display order, activation, SEO. Service-side is read-only (vendors pick, never
-- create). Server writes via service_role only (no anon/authenticated grants).

create table if not exists service_categories (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  description     text,
  icon_url        text,
  parent_id       uuid references service_categories(id) on delete set null,
  display_order   int not null default 0,
  is_active       boolean not null default true,
  seo_title       text,
  seo_description text,
  seo_keywords    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_service_categories_parent on service_categories(parent_id);
create index if not exists idx_service_categories_active on service_categories(is_active, display_order);

alter table services add column if not exists service_category_id uuid
  references service_categories(id) on delete set null;
create index if not exists idx_services_service_category on services(service_category_id);

alter table service_categories enable row level security;
revoke all on service_categories from anon, authenticated;
