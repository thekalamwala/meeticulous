-- v3.23 — Move host Google OAuth tokens out of the anon-exposed `profiles` table
-- into a SERVER-ONLY `profile_private` table.
--
-- Context: the emergency_lock_anon_api_exposure(_fix) migration already revoked
-- anon/authenticated SELECT on profiles.google_access_token / google_refresh_token
-- (and they were already AES-256-GCM encrypted at rest). This migration is the
-- structural defense-in-depth: a future accidental `GRANT SELECT ON profiles`
-- can never re-expose secrets that no longer live on that table.
--
-- ADDITIVE ONLY. Creates the table, backfills, pins flagged function search_paths.
-- The column DROP from profiles is a SEPARATE post-deploy migration
-- (v3.24_drop_profile_secret_columns.sql) applied AFTER this code ships — the
-- currently-live server still reads profiles.google_*, so dropping now would 500 it.

create table if not exists public.profile_private (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  google_access_token  text,
  google_refresh_token text,
  updated_at           timestamptz not null default now()
);

alter table public.profile_private enable row level security;

-- Server-only. RLS with no anon/authenticated policy => deny by default.
-- Belt-and-suspenders: also strip the default table grants and grant only the
-- service role (the server uses service_role, which bypasses RLS anyway).
revoke all on public.profile_private from anon, authenticated, public;
grant  all on public.profile_private to service_role;

drop policy if exists service_role_full_access_profile_private on public.profile_private;
create policy service_role_full_access_profile_private
  on public.profile_private for all to service_role using (true) with check (true);

-- Backfill existing (encrypted) tokens. Idempotent.
insert into public.profile_private (user_id, google_access_token, google_refresh_token)
select id, google_access_token, google_refresh_token
  from public.profiles
 where coalesce(google_access_token, '') <> '' or coalesce(google_refresh_token, '') <> ''
on conflict (user_id) do update
  set google_access_token  = excluded.google_access_token,
      google_refresh_token = excluded.google_refresh_token,
      updated_at           = now();

-- Hardening (advisor lint 0011): pin search_path on flagged functions. Matches
-- every overload by exact signature so a wrong guess can't abort the migration.
do $sp$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('forbid_financial_mutation','generate_service_slug',
                         'handle_new_user','increment_product_purchase_count',
                         'admin_category_stats')
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $sp$;
