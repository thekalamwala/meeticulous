-- v3.74_blogs.sql
-- DB-backed blog. Replaces the static client/src/data/blogPosts.js source.
-- `body` stores the SAME typed block array the renderer already understands
-- ({p}/{h2}/{ul}/{ol}/{steps}/{quote}/{info}/{table}) as jsonb — no reformatting.
-- Public reads go through the Express API via supabaseAdmin (service role), so
-- anon/authenticated get no direct grants. Apply on BOTH DBs.

create table if not exists public.blogs (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  excerpt      text,
  body         jsonb not null default '[]'::jsonb,   -- block array, renderer-native
  category     text,
  author       text default 'Book A Sloth Team',
  image        text,
  icons        jsonb not null default '[]'::jsonb,
  read_mins    int,
  status       text not null default 'draft',         -- draft | published
  published_at timestamptz,                            -- publish date (sort + display)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Hot path: published posts newest-first.
create index if not exists idx_blogs_published
  on public.blogs (published_at desc) where status = 'published';

alter table public.blogs enable row level security;
revoke all on public.blogs from anon, authenticated;
