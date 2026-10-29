-- v3.161 — Host activation funnel (read-only views)
-- ---------------------------------------------------------------------------
-- The activation funnel is the North Star for host success: a host is
-- "activated" when they receive their first PAYOUT, not when they sign up.
-- These views derive each host's current stage from existing signals only
-- (no new columns, no cron) so they are always fresh and zero-risk.
--
-- Stages (a host is at the HIGHEST one they've reached):
--   1_signed_up → 2_onboarded → 3_listed → 4_booked → 5_paid → 6_payout → 7_activated
-- A future "shared" stage (host actually shared their link) slots between
-- 3_listed and 4_booked once the share signal is instrumented (PR2) — the
-- view is written so adding it later is a one-line CASE change.
--
-- `is_internal` is a heuristic flag (BAS/Timewheel/Greyhawks/demo accounts) so
-- the funnel board can exclude test data without deleting it. Additive only.

create or replace view host_activation as
with hb as (
  select
    p.id                                             as host_id,
    p.name,
    p.email,
    coalesce(p.whatsapp_number, p.phone)             as phone,
    p.profession,
    p.plan,
    p.created_at                                     as signed_up_at,
    coalesce(p.onboarding_completed, false)          as onboarded,
    -- "listed" means a REAL offer: active AND priced (a ₹0 service is someone
    -- poking around, not a host putting their time up for sale).
    exists (select 1 from services s
            where s.host_id = p.id and s.is_active and coalesce(s.price,0) > 0) as has_priced_service,
    (select count(*) from services s
            where s.host_id = p.id and s.is_active and coalesce(s.price,0) > 0) as priced_services,
    exists (select 1 from bookings b where b.host_id = p.id)                    as has_booking,
    (select count(*) from bookings b
            where b.host_id = p.id and b.payment_status = 'paid')              as paid_bookings,
    (select coalesce(sum(b.customer_total),0) from bookings b
            where b.host_id = p.id and b.payment_status = 'paid')              as gmv,
    (select min(b.paid_at) from bookings b
            where b.host_id = p.id and b.payment_status = 'paid')              as first_paid_at,
    (select min(coalesce(b.transfer_released_at, b.transfer_settled_at)) from bookings b
            where b.host_id = p.id and b.payment_status = 'paid'
              and (b.transfer_released_at is not null or b.transfer_settled_at is not null)) as first_payout_at,
    (lower(coalesce(p.email,'')) like '%@bookasloth%'
       or lower(coalesce(p.email,'')) like '%@timewheel%'
       or lower(coalesce(p.email,'')) like '%greyhawks%'
       or lower(coalesce(p.email,'')) like '%demo.bookasloth%'
       or lower(coalesce(p.name,'')) in ('sloth','bolt 958','bolt the sloth','timewheel team')) as is_internal
  from profiles p
  where p.is_host = true and coalesce(p.is_banned, false) = false
)
select
  hb.*,
  (paid_bookings >= 2)                                    as retained,
  greatest(0, extract(day from now() - signed_up_at))::int as days_since_signup,
  case
    when first_payout_at is not null and paid_bookings >= 2 then '7_activated'
    when first_payout_at is not null                        then '6_payout'
    when paid_bookings > 0                                  then '5_paid'
    when has_booking                                        then '4_booked'
    when has_priced_service                                 then '3_listed'
    when onboarded                                          then '2_onboarded'
    else                                                        '1_signed_up'
  end                                                       as stage
from hb;

-- Aggregate funnel — one row, the whole board. Pass real_only via the WHERE in
-- callers (e.g. `select * from host_activation_funnel`); a second view gives the
-- external-only cut used for the North Star.
create or replace view host_activation_funnel as
select
  false                                                          as real_only,
  count(*)                                                       as total,
  count(*) filter (where onboarded)                             as onboarded,
  count(*) filter (where has_priced_service)                    as listed,
  count(*) filter (where has_booking)                           as booked,
  count(*) filter (where paid_bookings > 0)                     as paid,
  count(*) filter (where first_payout_at is not null)           as payout,
  count(*) filter (where retained)                              as activated,
  coalesce(sum(gmv),0)                                          as total_gmv
from host_activation
union all
select
  true,
  count(*),
  count(*) filter (where onboarded),
  count(*) filter (where has_priced_service),
  count(*) filter (where has_booking),
  count(*) filter (where paid_bookings > 0),
  count(*) filter (where first_payout_at is not null),
  count(*) filter (where retained),
  coalesce(sum(gmv),0)
from host_activation
where not is_internal;
