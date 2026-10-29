-- ============================================================
-- Book A Sloth — v1.2 Migration
-- Run in Supabase SQL Editor before deploying v1.2
-- ============================================================

-- ── PLANS on profiles ───────────────────────────────────────
alter table profiles
  add column if not exists plan             text default 'explorer' check (plan in ('explorer','creator','professional')),
  add column if not exists plan_expires_at  timestamptz,
  add column if not exists plan_updated_at  timestamptz;

-- ── Flat platform fee on bookings (replaces % system) ───────
alter table bookings
  add column if not exists platform_fee_amount numeric default 10;

-- ── Subscription purchase log ───────────────────────────────
create table if not exists plan_purchases (
  id                  uuid primary key default gen_random_uuid(),
  vendor_id           uuid references profiles(id) on delete cascade,
  plan                text not null check (plan in ('creator','professional')),
  amount_paid         integer not null,     -- in paise
  razorpay_order_id   text,
  razorpay_payment_id text,
  activated_at        timestamptz default now(),
  expires_at          timestamptz not null,
  created_at          timestamptz default now()
);

-- ── Digital products ────────────────────────────────────────
create table if not exists products (
  id              uuid primary key default gen_random_uuid(),
  host_id         uuid references profiles(id) on delete cascade,
  title           text not null,
  description     text,
  type            text default 'pdf' check (type in ('pdf','template','ebook','prompt_pack','resource','other')),
  price           numeric not null default 0,
  currency        text default 'INR',
  file_url        text,          -- direct file URL (Cloudinary, S3, Drive, etc.)
  thumbnail_url   text,
  is_active       boolean default true,
  purchase_count  integer default 0,
  slug            text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Digital product purchases ────────────────────────────────
create table if not exists product_purchases (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid references products(id) on delete cascade,
  host_id             uuid references profiles(id) on delete set null,
  buyer_id            uuid references profiles(id) on delete set null,
  buyer_name          text,
  buyer_email         text,
  amount_paid         numeric not null,
  platform_fee        numeric default 10,
  payment_status      text default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  razorpay_order_id   text,
  razorpay_payment_id text,
  download_token      text unique,         -- one-time UUID for secure download
  download_token_expires_at timestamptz,
  download_count      integer default 0,
  created_at          timestamptz default now()
);

-- ── Platform settings cleanup (remove old % fee) ─────────────
-- Replace percentage-based fee with flat ₹10 per booking
insert into platform_settings (key, value)
  values ('platform_fee_flat', '10')
  on conflict (key) do update set value = '10';

-- Plan prices (in paise for Razorpay)
insert into platform_settings (key, value)
  values ('plan_price_creator', '99900')      -- ₹999 in paise
  on conflict (key) do nothing;

insert into platform_settings (key, value)
  values ('plan_price_professional', '365000') -- ₹3,650 in paise
  on conflict (key) do nothing;

-- Plan limits
insert into platform_settings (key, value)
  values ('plan_limits', '{"explorer":{"services":3,"bookings_per_month":20,"products":0},"creator":{"services":15,"bookings_per_month":-1,"products":5},"professional":{"services":-1,"bookings_per_month":-1,"products":-1}}')
  on conflict (key) do nothing;

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists idx_products_host on products(host_id);
create index if not exists idx_product_purchases_token on product_purchases(download_token);
create index if not exists idx_product_purchases_product on product_purchases(product_id);
create index if not exists idx_plan_purchases_vendor on plan_purchases(vendor_id);
