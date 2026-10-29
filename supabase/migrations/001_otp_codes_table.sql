-- ============================================================
-- Migration 001: Create otp_codes table
-- Run this in Supabase SQL Editor → fixes the booking OTP error
-- ============================================================

create table if not exists public.otp_codes (
  id          bigint generated always as identity primary key,
  email       text not null unique,
  otp         text not null,
  phone       text default '',
  type        text default 'login',
  expires_at  timestamptz not null,
  created_at  timestamptz default now()
);

create index if not exists otp_codes_email_idx   on public.otp_codes (email);
create index if not exists otp_codes_expires_idx on public.otp_codes (expires_at);

alter table public.otp_codes enable row level security;
drop policy if exists "deny_all" on public.otp_codes;
create policy "deny_all" on public.otp_codes for all using (false);
