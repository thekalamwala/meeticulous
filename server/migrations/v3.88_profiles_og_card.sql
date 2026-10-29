-- v3.88_profiles_og_card.sql
-- Generated 1200x630 social share cards for host profiles.
--
-- A shared bookasloth.com/:username link previews as og:image. Today that is the
-- host's Google avatar — a SQUARE image that letterboxes under a
-- summary_large_image card. This adds a per-host generated card (the same
-- pattern blogs.og_image uses) plus the state machine to keep it fresh without
-- regenerating on every read.
--
-- Columns:
--   og_image        the generated card URL (Supabase images bucket, host-og/).
--                   Null => not generated yet; serve the default host card.
--   og_status       lifecycle: 'none' (never generated) | 'generating' | 'ready'
--                   | 'dirty' (a visible field changed; serve the stale card and
--                   regenerate on the next generator sweep).
--   og_generated_at when the current card was rendered.
--   og_version      bumped on each successful generation — cache-bust + audit.
--   og_hash         hash of the exact fields the card renders (name, profession,
--                   photo, stats bucket). The generator skips a row whose hash is
--                   unchanged, so a no-op profile save doesn't re-render.
--   og_error        last generation failure message, for the admin/log trail.
--
-- Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo
-- xwvciqkayammbvsidqig). All nullable / defaulted, so existing rows are valid
-- immediately: og_status defaults to 'none' => everyone serves the default card
-- until their first generation.

alter table public.profiles add column if not exists og_image        text;
alter table public.profiles add column if not exists og_status       text not null default 'none';
alter table public.profiles add column if not exists og_generated_at timestamptz;
alter table public.profiles add column if not exists og_version      integer not null default 0;
alter table public.profiles add column if not exists og_hash         text;
alter table public.profiles add column if not exists og_error        text;

-- Guard the lifecycle values at the DB, not just in app code.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_og_status_chk') then
    alter table public.profiles
      add constraint profiles_og_status_chk
      check (og_status in ('none', 'generating', 'ready', 'dirty'));
  end if;
end $$;

-- The generator sweeps rows needing work (dirty or never-generated). A partial
-- index keeps that scan cheap as the table grows — mirrors the intent of the
-- host paid-booking partial indexes (v3.57).
create index if not exists idx_profiles_og_pending
  on public.profiles (og_generated_at)
  where og_status in ('none', 'dirty');

comment on column public.profiles.og_image is
  'Generated 1200x630 social share card (og:image only). Null => serve the default host card. See v3.88.';
comment on column public.profiles.og_status is
  'OG card lifecycle: none | generating | ready | dirty. dirty => a visible field changed; serve stale, regenerate next sweep.';
