-- v3.72_explore_service_scoring.sql
-- Explore rebuild — precomputed per-SERVICE quality score (0–100) + discovery analytics.
--
-- Apply in Supabase SQL editor on BOTH DBs (staging Tokyo first, then prod Mumbai)
-- per the project migration workflow. Safe to run as one transaction (no CONCURRENTLY).
--
-- SCORING is 100% in SQL and runs only at compute time (backfill / recompute / trigger).
-- Request time NEVER calls compute_service_score — it reads service_scores.effective_score.
--
-- Rubric is implemented to the full 100-mark spec, BUT the current schema has no data
-- source for several inputs. Those marks degrade to 0 and are listed in
-- score_components.unavailable_inputs so scores auto-improve as data lands, no rewrite:
--   * 0 reviews platform-wide      → all of section A (30) is 0 today
--   * no views/impressions table   → view→booking conversion (B, 8) = 0
--   * no response-time data         → response rate + speed (C, 12) = 0
--   * single thumbnail, no gallery  → photos caps at 1/2 (D)
--   * no service tags column        → category+tags caps at 1/2 (D)
--   * no instant-book flag          → instant (E, 2) = 0
--   * no dispute table              → dispute penalty (×0.7) never fires
--   * host cancel rate cannot be attributed to host vs guest → approximated as all cancels
--
-- effective_score = quality_score × penalty_multiplier (penalties applied at compute time
-- from flags; re-derived on every recompute). Ordering reads effective_score directly.

-- ── Tables ───────────────────────────────────────────────────────────────────
create table if not exists public.service_scores (
  service_id       uuid primary key references public.services(id) on delete cascade,
  quality_score    numeric not null default 0,   -- 0..100, pre-penalty
  effective_score  numeric not null default 0,   -- quality_score × penalty_multiplier
  score_components jsonb   not null default '{}'::jsonb,
  computed_at      timestamptz not null default now()
);
create index if not exists idx_service_scores_effective
  on public.service_scores (effective_score desc);

create table if not exists public.search_events (
  id         bigint generated always as identity primary key,
  session_id text,
  user_id    uuid,                                -- nullable (guests); no FK
  query      text,
  filters    jsonb not null default '{}'::jsonb,
  page       int   not null default 1,
  results    jsonb not null default '[]'::jsonb,  -- [{service_id, rank, score}]
  created_at timestamptz not null default now()
);
create index if not exists idx_search_events_created on public.search_events (created_at);

create table if not exists public.explore_clicks (
  id              bigint generated always as identity primary key,
  search_event_id bigint references public.search_events(id) on delete set null,
  service_id      uuid   references public.services(id) on delete cascade,
  rank            int,
  created_at      timestamptz not null default now()
);
create index if not exists idx_explore_clicks_service on public.explore_clicks (service_id);
create index if not exists idx_explore_clicks_event   on public.explore_clicks (search_event_id);

-- Locked to the service role (server writes via supabaseAdmin, which bypasses RLS).
-- Anon/auth get nothing: scores + analytics are not public reads.
alter table public.service_scores enable row level security;
alter table public.search_events  enable row level security;
alter table public.explore_clicks enable row level security;
revoke all on public.service_scores, public.search_events, public.explore_clicks
  from anon, authenticated;

-- ── compute_service_score(service_id) ────────────────────────────────────────
create or replace function public.compute_service_score(p_service_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record; h record; av record;
  v_reviews int := 0; r_avg numeric := 0; c_mean numeric := 0;
  last_review timestamptz; bayes numeric := 0; repeat_rate numeric := 0;
  b30 int := 0; b_total int := 0; b_completed int := 0; b_noshow int := 0;
  b_cancelled int := 0; b_cancel7 int := 0; comp_rate numeric; cancel_rate numeric := 0;
  active_days int := 0; kyc_ok boolean := false; desc_text text;
  mA_rating int; mA_recency int; mA_count int; mA_repeat int;
  mB_recent int; mB_conv int := 0; mB_completion int;
  mC_rate int := 0; mC_speed int := 0; mC_cancel int;
  mD_title int; mD_meta int; mD_photos int; mD_desc int; mD_price int;
  mD_cat int; mD_area int; mD_faq int; mD_verified int;
  mE_slots int; mE_cal int; mE_instant int := 0; mE_active int;
  q numeric; pen_mult numeric := 1; pen jsonb; comp jsonb;
begin
  select * into s from services where id = p_service_id;
  if not found then return; end if;
  select * into h from profiles where id = s.host_id;
  select * into av from availability where host_id = s.host_id order by updated_at desc limit 1;

  select coalesce(avg(rating),0) into c_mean
    from reviews where coalesce(status,'published') not in ('rejected','removed');
  select count(*), coalesce(avg(rating),0), max(created_at)
    into v_reviews, r_avg, last_review
    from reviews
    where service_id = p_service_id and coalesce(status,'published') not in ('rejected','removed');
  if v_reviews > 0 then
    bayes := (v_reviews * r_avg + 5 * c_mean) / (v_reviews + 5);
  end if;

  select coalesce(count(*) filter (where cnt > 1)::numeric / nullif(count(*),0), 0)
    into repeat_rate
    from (select guest_id, count(*) cnt from bookings
          where service_id = p_service_id and guest_id is not null and status <> 'cancelled'
          group by guest_id) g;

  select
    count(*) filter (where status <> 'cancelled' and created_at > now() - interval '30 days'),
    count(*),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'no_show'),
    count(*) filter (where status = 'cancelled'),
    count(*) filter (where status = 'cancelled' and created_at > now() - interval '7 days')
    into b30, b_total, b_completed, b_noshow, b_cancelled, b_cancel7
    from bookings where service_id = p_service_id;

  if av.weekly_schedule is not null then
    select count(*) into active_days from jsonb_each(av.weekly_schedule) e
      where jsonb_typeof(e.value) = 'array' and jsonb_array_length(e.value) > 0;
  end if;

  -- payout_requests is empty; approved KYC (carries bank details) proxies payout-readiness
  select exists(select 1 from kyc_submissions where user_id = s.host_id and status = 'approved')
    into kyc_ok;

  -- A. Customer Satisfaction (30)
  mA_rating := case when bayes >= 4.8 then 12 when bayes >= 4.5 then 9
                    when bayes >= 4.0 then 6 when bayes >= 3.5 then 3 else 0 end;
  mA_recency := case when last_review is null then 0
                     when last_review > now() - interval '30 days'  then 8
                     when last_review > now() - interval '90 days'  then 5
                     when last_review > now() - interval '180 days' then 2 else 0 end;
  mA_count := case when v_reviews >= 25 then 6 when v_reviews >= 10 then 4
                   when v_reviews >= 3 then 2 else 0 end;
  mA_repeat := case when repeat_rate >= 0.20 then 4 when repeat_rate >= 0.10 then 2 else 0 end;

  -- B. Booking Performance (25)
  mB_recent := case when b30 >= 15 then 10 when b30 >= 8 then 7
                    when b30 >= 3 then 4 when b30 >= 1 then 2 else 0 end;
  mB_conv := 0; -- no views/impressions data
  if (b_completed + b_noshow) > 0 then
    comp_rate := b_completed::numeric / (b_completed + b_noshow);
    mB_completion := case when comp_rate >= 0.95 then 7 when comp_rate >= 0.85 then 4 else 0 end;
  else comp_rate := null; mB_completion := 0; end if;

  -- C. Reliability (20)
  mC_rate := 0; mC_speed := 0; -- no response-time data
  if b_total > 0 then cancel_rate := b_cancelled::numeric / b_total; end if;
  mC_cancel := case when cancel_rate = 0 then 8 when cancel_rate < 0.03 then 5
                    when cancel_rate <= 0.07 then 2 else 0 end;

  -- D. Listing Quality (15; photos & tags each cap 1 below max — no gallery/tags column)
  mD_title := case when s.title is not null and char_length(s.title) between 30 and 60 then 2 else 0 end;
  mD_meta := case when s.seo_description is not null
                   and char_length(s.seo_description) between 120 and 160 then 2 else 0 end;
  mD_photos := case when coalesce(s.thumbnail_url,'') <> '' then 1 else 0 end;
  desc_text := coalesce(s.long_description, s.description, '');
  mD_desc := case when char_length(desc_text) >= 150 then 2 else 0 end;
  mD_price := case when s.price is null then 0 when s.price > 0 then 2 else 1 end;
  -- no service `tags` column → mark caps at 1; base on category presence alone so the
  -- function is robust to DBs missing the v3.60 services.primary_category column (staging).
  mD_cat := case when coalesce(s.category,'') <> '' then 1 else 0 end;
  mD_area := case when coalesce(h.location,'') <> '' then 1 else 0 end;
  mD_faq := case when jsonb_typeof(s.faqs) = 'array' and jsonb_array_length(s.faqs) >= 3 then 1 else 0 end;
  mD_verified := case when kyc_ok then 1 else 0 end;

  -- E. Availability & Activity (10; instant-book flag absent → 0)
  mE_slots := case when active_days >= 7 then 4 when active_days >= 3 then 3
                   when active_days >= 1 then 2 else 0 end;
  mE_cal := case when av.updated_at is not null and av.updated_at > now() - interval '7 days' then 2 else 0 end;
  mE_instant := 0;
  mE_active := case when h.updated_at is not null and h.updated_at > now() - interval '14 days' then 2 else 0 end;

  q := mA_rating+mA_recency+mA_count+mA_repeat
     + mB_recent+mB_conv+mB_completion
     + mC_rate+mC_speed+mC_cancel
     + mD_title+mD_meta+mD_photos+mD_desc+mD_price+mD_cat+mD_area+mD_faq+mD_verified
     + mE_slots+mE_cal+mE_instant+mE_active;
  q := least(greatest(q,0),100);

  pen := jsonb_build_object(
    'cancel_recent',     (b_cancel7 > 0),
    'dispute',           false,
    'inactive',          (h.updated_at is null or h.updated_at < now() - interval '45 days'),
    'zero_availability', (active_days = 0));
  pen_mult := 1
    * case when (b_cancel7 > 0) then 0.85 else 1 end
    * case when (h.updated_at is null or h.updated_at < now() - interval '45 days') then 0.6 else 1 end
    * case when (active_days = 0) then 0.3 else 1 end;

  comp := jsonb_build_object(
    'A', jsonb_build_object('rating',mA_rating,'recency',mA_recency,'count',mA_count,'repeat',mA_repeat,
                            'bayes',round(bayes,3),'reviews',v_reviews),
    'B', jsonb_build_object('recent',mB_recent,'conversion',mB_conv,'completion',mB_completion,
                            'bookings_30d',b30,'completion_rate',comp_rate),
    'C', jsonb_build_object('response_rate',mC_rate,'response_speed',mC_speed,'cancel',mC_cancel,
                            'cancel_rate',round(cancel_rate,3)),
    'D', jsonb_build_object('title',mD_title,'meta',mD_meta,'photos',mD_photos,'description',mD_desc,
                            'pricing',mD_price,'category',mD_cat,'area',mD_area,'faq',mD_faq,'verified',mD_verified),
    'E', jsonb_build_object('slots',mE_slots,'calendar',mE_cal,'instant',mE_instant,'active',mE_active,
                            'active_days',active_days),
    'penalties', pen,
    'penalty_multiplier', round(pen_mult,4),
    'unavailable_inputs', jsonb_build_array(
        'reviews','view_conversion','response_rate','response_speed',
        'photo_gallery','service_tags','instant_book_flag','dispute_signal'));

  insert into service_scores(service_id, quality_score, effective_score, score_components, computed_at)
  values (p_service_id, q, round(q * pen_mult, 3), comp, now())
  on conflict (service_id) do update
    set quality_score = excluded.quality_score,
        effective_score = excluded.effective_score,
        score_components = excluded.score_components,
        computed_at = excluded.computed_at;
end;
$$;

-- ── recompute_all_service_scores() — backfill / nightly full pass ─────────────
-- Prunes scores for inactive/deleted services, then (re)computes every active one.
-- Called by the backfill below and by the server's recompute endpoint/cron hook.
create or replace function public.recompute_all_service_scores()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare r record; n int := 0;
begin
  delete from service_scores ss
   where not exists (select 1 from services s where s.id = ss.service_id and s.is_active);
  for r in select id from services where is_active loop
    perform compute_service_score(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ── Backfill now ─────────────────────────────────────────────────────────────
select public.recompute_all_service_scores();
