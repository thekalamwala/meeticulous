-- v3.10_appearance_settings.sql — admin-managed site appearance (navbar logo).
--
-- Single-row table (id = 1). Holds the active navbar logo mode and the image
-- URLs for each mode. Image files live in Supabase Storage / CDN; this row is
-- the source of truth for which one is shown.
--
-- navbar_logo_mode:
--   'icon_text' — square mark (icon_url) + "Book A Sloth" wordmark  [default]
--   'image'     — single full lockup image (logo_image_url)
--   'festive'   — seasonal lockup image (festive_logo_url), manual toggle
--
-- Read publicly via GET /api/appearance (server, not the browser anon client);
-- written only via the admin API. If this table is missing, the API returns
-- defaults and the navbar falls back to the text wordmark — nothing breaks.
--
-- The email header logo is intentionally NOT here: it is a fixed image set on
-- email_settings.logo_url, decoupled from these navbar modes.

create table if not exists appearance_settings (
  id               int primary key default 1 check (id = 1),
  navbar_logo_mode text not null default 'icon_text'
                   check (navbar_logo_mode in ('icon_text', 'image', 'festive')),
  icon_url         text not null default 'https://company-assets.bookasloth.in/images/email/sloth-icon-sqr.png',
  logo_image_url   text not null default '',
  festive_logo_url text not null default '',
  updated_at       timestamptz not null default now()
);

-- Seed the single row (no-op if it already exists).
insert into appearance_settings (id) values (1)
  on conflict (id) do nothing;

-- Writes go through the server (service role); enable RLS with no public policy.
alter table appearance_settings enable row level security;
