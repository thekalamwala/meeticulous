-- v3.154_services_og_card.sql
-- Generated 1200x630 social share cards for individual SERVICES.
--
-- The per-service sibling of v3.88 (profiles.og_image). A shared
-- bookasloth.com/:username/:slug link should preview as a proper wide card
-- naming the service, its price and the host — not the service thumbnail
-- letterboxed under a summary_large_image card. This adds a per-service
-- generated card (same pattern as v3.88) plus the state machine to keep it
-- fresh without regenerating on every read.
--
-- Columns (mirror v3.88 on the services table):
--   og_image        the generated card URL (Supabase images bucket, service-og/).
--                   Null => not generated yet; the resolver falls through to
--                   seo_image -> thumbnail_url -> the static /service-og-default.png.
--   og_status       lifecycle: 'none' (never generated) | 'generating' | 'ready'
--                   | 'dirty' (a visible field changed; serve stale, regenerate
--                   on the next generator sweep) | 'error'.
--   og_generated_at when the current card was rendered.
--   og_version      bumped on each successful generation — cache-bust + audit.
--   og_hash         hash of the exact fields the card renders (title, price,
--                   host name/avatar/profession, stats bucket). The generator
--                   skips a row whose hash is unchanged.
--   og_error        last generation failure message, for the admin/log trail.
--
-- Apply on BOTH DBs (staging Tokyo xwvciqkayammbvsidqig first, then prod Mumbai
-- ayjhlwyzszykqtnaktpb). All nullable / defaulted, so existing rows are valid
-- immediately: og_status defaults to 'none' => every service falls through to
-- the static default card until its first generation.

alter table public.services add column if not exists og_image        text;
alter table public.services add column if not exists og_status       text not null default 'none';
alter table public.services add column if not exists og_generated_at timestamptz;
alter table public.services add column if not exists og_version      integer not null default 0;
alter table public.services add column if not exists og_hash         text;
alter table public.services add column if not exists og_error        text;

-- Guard the lifecycle values at the DB, not just in app code. 'error' is included
-- (the generator can leave a row 'error' on repeated failure); the host pipeline's
-- v3.88 omitted it, but the service generator records it, so the CHECK allows it.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'services_og_status_chk') then
    alter table public.services
      add constraint services_og_status_chk
      check (og_status in ('none', 'generating', 'ready', 'dirty', 'error'));
  end if;
end $$;

-- The generator sweeps rows needing work (dirty or never-generated). A partial
-- index keeps that scan cheap as the table grows — mirrors v3.88's profile index.
create index if not exists idx_services_og_pending
  on public.services (og_generated_at)
  where og_status in ('none', 'dirty');

comment on column public.services.og_image is
  'Generated 1200x630 social share card (og:image only). Null => fall through to seo_image/thumbnail_url/static default. See v3.154.';
comment on column public.services.og_status is
  'OG card lifecycle: none | generating | ready | dirty | error. dirty => a visible field changed; serve stale, regenerate next sweep.';
