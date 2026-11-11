-- v3.204 Coupons — host-created discount codes. Ships behind the `coupons` flag (OFF).
-- A coupon reduces the SERVICE PRICE at booking time: the host eats their own promo,
-- and commission / TDS / GST all recompute on the discounted price. The booking row is
-- the redemption record (coupon_id + discount_amount); times_redeemed is a fast counter.
-- RLS on, no policies → service-role only (all access via supabaseAdmin), same as peers.

create table if not exists coupons (
  id              uuid primary key default gen_random_uuid(),
  host_id         uuid not null references profiles(id) on delete cascade,
  code            text not null,
  discount_type   text not null check (discount_type in ('percent', 'flat')),
  discount_value  numeric not null check (discount_value > 0),
  active          boolean not null default true,
  expires_at      timestamptz,
  max_redemptions integer,                       -- null = unlimited
  times_redeemed  integer not null default 0,
  min_amount      numeric not null default 0,    -- min service price for the code to apply
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- A percent code can't exceed 100.
alter table coupons add constraint coupons_percent_max
  check (discount_type <> 'percent' or discount_value <= 100) not valid;

-- One code per host, case-insensitive.
create unique index if not exists coupons_host_code_uniq on coupons (host_id, upper(code));
-- Lookup path: active codes for a host.
create index if not exists coupons_host_active_idx on coupons (host_id) where active;

alter table coupons enable row level security;

-- Redemption trace on the booking (the booking IS the redemption record).
alter table bookings add column if not exists coupon_id uuid references coupons(id);
alter table bookings add column if not exists discount_amount numeric not null default 0;

-- Atomic redemption counter (avoids a read-modify-write race on the limit check).
-- SECURITY DEFINER + explicit revoke per the v3.186 anon/RPC lockdown — service_role only.
create or replace function increment_coupon_redemption(c_id uuid)
  returns void language sql security definer as $$
  update coupons set times_redeemed = times_redeemed + 1, updated_at = now() where id = c_id;
$$;
revoke all on function increment_coupon_redemption(uuid) from public, anon, authenticated;

-- Ship behind a flag (OFF). Pre-seed disabled — isFeatureEnabled is fail-open, and this
-- gates money behaviour, so it must never default ON before the registry upsert runs.
insert into feature_flags (key, label, description, category, scope, enabled)
values ('coupons', 'Coupons', 'Host discount codes applied at checkout. Off = codes rejected.', 'Payments', 'both', false)
on conflict (key) do nothing;
