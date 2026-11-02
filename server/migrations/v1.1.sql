-- ============================================================
-- Meeticulous — v1.1 Migration
-- Run this in your Supabase SQL Editor before deploying v1.1
-- ============================================================

-- Task 2: OTP storage table (replaces in-memory store)
create table if not exists otp_codes (
  email        text primary key,
  otp          text not null,
  expires_at   timestamptz not null,
  created_at   timestamptz default now()
);

-- Task 7: Razorpay order tracking on bookings
alter table bookings
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text;

-- Task 8: Platform fee tracking on bookings
alter table bookings
  add column if not exists vendor_amount numeric default 0,
  add column if not exists platform_fee_percent numeric default 0;

-- Task 6: Reminder tracking on bookings
alter table bookings
  add column if not exists reminder_24h_sent boolean default false,
  add column if not exists reminder_1h_sent  boolean default false;

-- Task 12: Service thumbnail
alter table services
  add column if not exists thumbnail_url text;

-- Task 13: Buffer time on availability
alter table availability
  add column if not exists buffer_minutes integer default 0;

-- Task 9: Reviews table
create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references bookings(id) on delete cascade,
  reviewer_id uuid references profiles(id) on delete set null,
  host_id     uuid references profiles(id) on delete cascade,
  rating      integer not null check (rating >= 1 and rating <= 5),
  comment     text,
  created_at  timestamptz default now(),
  unique(booking_id)  -- one review per booking
);

-- Platform settings seed: add platform_fee_percent if missing
insert into platform_settings (key, value)
  values ('platform_fee_percent', '10')
  on conflict (key) do nothing;

-- Useful indexes
create index if not exists idx_bookings_host_scheduled on bookings(host_id, scheduled_at);
create index if not exists idx_bookings_reminders on bookings(status, reminder_24h_sent, reminder_1h_sent, scheduled_at);
create index if not exists idx_reviews_host on reviews(host_id);
create index if not exists idx_otp_codes_expires on otp_codes(expires_at);
