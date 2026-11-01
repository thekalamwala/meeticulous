-- v3.91_invite_links.sql
-- Lead-source attribution "Invite Links". Attribution-only — NO payouts, fully
-- separate from Refer & Earn (referrals table). Sales/marketing share pretty
-- links like meeticulous.com/invite/social; new HOST signups get stamped with the
-- slug so acquisition source is queryable in admin.
--
--   invite_links         — one row per shareable link (admin-created, slug immutable).
--   profiles.invite_slug — first-touch source, stamped once at host-account creation.
--
-- Reads go through the Express API via supabaseAdmin (service role); anon/auth get
-- no direct grants. Code keeps a schema-fallback until this is confirmed applied,
-- so shipping the feature before the migration lands is safe.
-- APPLY ON BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).

create table if not exists public.invite_links (
  slug          text primary key,                      -- URL segment, immutable
  label         text not null,                          -- shown in landing greeting + admin
  assigned_to   text,                                   -- free-text owner/source (rep, campaign, platform, "QR")
  active        boolean not null default true,          -- off -> landing redirects to /
  unique_visits bigint  not null default 0,             -- de-botted + IP/day deduped estimate
  metadata      jsonb   not null default '{}'::jsonb,   -- free-form campaign details
  created_by    uuid,                                   -- admin who created it (audit)
  created_at    timestamptz not null default now()
);

-- First-touch attribution, write-once. NULL for every host not from an invite link.
alter table public.profiles
  add column if not exists invite_slug text;

-- Signup-count-per-slug hot path + honest "only stamped rows".
create index if not exists idx_profiles_invite_slug
  on public.profiles (invite_slug) where invite_slug is not null;

alter table public.invite_links enable row level security;
revoke all on public.invite_links from anon, authenticated;

-- Atomic visit bump (avoids read-add-write races under concurrent hits).
create or replace function public.increment_invite_visit(p_slug text)
returns void language sql security definer as $$
  update public.invite_links set unique_visits = unique_visits + 1 where slug = p_slug;
$$;
revoke all on function public.increment_invite_visit(text) from anon, authenticated;
