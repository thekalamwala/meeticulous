-- v3.73_explore_score_automation.sql
-- Keep service_scores fresh without a request-time cost. Two mechanisms:
--   1. On-write triggers — recompute the ONE affected service the moment a booking
--      or review changes (instant freshness where it matters). Fires for ANY writer
--      (both backends), and is exception-guarded so a scoring bug can NEVER break a
--      booking/review write.
--   2. Weekly pg_cron full pass — ages the time-window flags (recent-cancel 7d,
--      calendar-fresh 7d, host-active 14d, inactive 45d, bookings-30d) that no write
--      touches. Fri 23:30 IST = 18:00 UTC (35 services finish in ms).
--
-- Depends on v3.72 (compute_service_score / recompute_all_service_scores).
-- Apply on BOTH DBs (staging then prod).

-- ── 1. On-write triggers ─────────────────────────────────────────────────────
create or replace function public.trg_recompute_service_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- AFTER trigger: an uncaught error here would roll back the booking/review write,
  -- so swallow everything — score freshness must never block a critical-path write.
  begin
    perform compute_service_score(coalesce(NEW.service_id, OLD.service_id));
  exception when others then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists recompute_score_on_booking on public.bookings;
create trigger recompute_score_on_booking
  after insert or update of status on public.bookings
  for each row execute function public.trg_recompute_service_score();

drop trigger if exists recompute_score_on_review on public.reviews;
create trigger recompute_score_on_review
  after insert or update on public.reviews
  for each row execute function public.trg_recompute_service_score();

-- ── 2. Weekly full pass (pg_cron) ────────────────────────────────────────────
-- pg_cron schedules in UTC. '0 18 * * 5' = Friday 18:00 UTC = Friday 23:30 IST.
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('recompute-service-scores-weekly');
exception when others then
  null;  -- not scheduled yet
end $$;

select cron.schedule(
  'recompute-service-scores-weekly',
  '0 18 * * 5',
  $cron$select public.recompute_all_service_scores()$cron$
);
