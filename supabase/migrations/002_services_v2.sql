-- ============================================================
-- Migration 002: Extend services table for Service Module v2
-- Run AFTER 001. Safe to run multiple times (all IF NOT EXISTS).
-- ============================================================

-- Short description (for cards, meta, search results)
alter table public.services
  add column if not exists short_description text default '';

-- Long description (rich text, for Overview tab)
alter table public.services
  add column if not exists long_description text default '';

-- Inclusions / exclusions stored as JSONB arrays
alter table public.services
  add column if not exists included_items jsonb default '[]'::jsonb;

alter table public.services
  add column if not exists excluded_items jsonb default '[]'::jsonb;

-- FAQs stored as JSONB array of {question, answer}
alter table public.services
  add column if not exists faqs jsonb default '[]'::jsonb;

-- Optional notes visible on the booking page
alter table public.services
  add column if not exists important_note text default '';

-- Aggregate stats (updated via trigger or server logic)
alter table public.services
  add column if not exists rating numeric(3,2) default 0;

alter table public.services
  add column if not exists total_reviews integer default 0;

alter table public.services
  add column if not exists total_bookings integer default 0;

-- Ensure slug column exists (may already exist)
alter table public.services
  add column if not exists slug text;

-- Unique slug index
create unique index if not exists services_slug_unique_idx on public.services (slug);
