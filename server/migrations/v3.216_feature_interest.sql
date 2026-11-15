-- v3.216_feature_interest.sql
-- One-click "notify me" demand signal for unlaunched host features shown as
-- "Coming to Pro" teasers (courses / coupons / membership). Additive, RLS-on /
-- no-policy / service_role-only, matching the project's additive-table convention.
--
-- HELD: apply on BOTH DBs via a founder-run migration. Until applied, the write
-- path (controllers/featureInterestController.js) is schema-fallback safe — a
-- "missing relation" is treated as a successful no-op, so the button never 500s.

create table if not exists feature_interest (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid not null references profiles(id) on delete cascade,
  feature    text not null check (feature in ('courses', 'coupons', 'membership')),
  created_at timestamptz not null default now(),
  unique (host_id, feature)
);

-- One host's interest per feature; the admin reads the counts to gauge demand.
create index if not exists feature_interest_feature_idx on feature_interest (feature);

alter table feature_interest enable row level security;
-- No policies: service_role (supabaseAdmin) only, like host_nudges / bot_escalations.
