-- v3.77_referral_program.sql
-- Host-refers-host "Refer & Earn". One-sided, reward-on-payment, admin-configurable.
--
-- Two tables:
--   referral_reward_rules — admin config ("what's paid for what, per plan+cadence").
--   referrals             — one row per referred host, walks a state machine:
--     pending → qualified → rewarded            (happy path)
--             ↘ rejected (self/cap/churn)       (clawback / fraud)
--
-- Reward flow: referred host makes a real plan payment → referral QUALIFIES using
-- the matching rule (retention-gated for monthly via min_qualifying_charges) →
-- after hold_days with the referred host still paying, a cron RELEASES it:
-- posts a ledger entry (Referral Expense → Vendor Payables) and the cash surfaces
-- in the referrer's withdrawable balance (settlementService), withdrawn via the
-- normal payout_requests rail (KYC-gated).
--
-- Reads go through the Express API via supabaseAdmin (service role); anon/auth get
-- no direct grants. APPLY ON BOTH DBs (prod Mumbai + staging Tokyo).

-- ── Admin config: what's paid, per (plan, cadence) ────────────────────────────
create table if not exists public.referral_reward_rules (
  id                    uuid primary key default gen_random_uuid(),
  referred_plan         text not null,                       -- plan SLUG: 'creator' (Host+) | 'professional' (Studio)
  cadence               text not null,                       -- 'monthly' | 'annual'
  reward_type           text not null default 'cash_inr'
                          check (reward_type in ('cash_inr','account_credit')),
  reward_value          numeric(10,2) not null default 0,    -- ₹ (0 = disabled for this row)
  min_qualifying_charges int   not null default 1,           -- real paid charges before reward (monthly=2 gates churn)
  hold_days             int    not null default 14,          -- refund/churn window before release
  monthly_cap           int    not null default 10,          -- max rewards per referrer per calendar month (0 = unlimited)
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (referred_plan, cadence)
);

-- ── Ledger: one row per referred host ─────────────────────────────────────────
create table if not exists public.referrals (
  id                 uuid primary key default gen_random_uuid(),
  referrer_id        uuid not null references public.profiles(id) on delete cascade,
  referred_id        uuid not null references public.profiles(id) on delete cascade,
  status             text not null default 'pending'
                       check (status in ('pending','qualified','rewarded','rejected')),
  referred_plan      text,                                   -- snapshot at qualify
  cadence            text,                                   -- snapshot at qualify
  reward_type        text,                                   -- snapshot at qualify
  reward_value       numeric(10,2) not null default 0,       -- snapshot at qualify
  qualifying_charges int not null default 0,                 -- real paid charges seen so far (retention counter)
  qualified_at       timestamptz,
  release_at         timestamptz,                            -- qualified_at + hold_days
  rewarded_at        timestamptz,
  rejected_reason    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (referred_id)                                       -- attribution lock: one referrer per referred, write-once
);

create index if not exists idx_referrals_referrer on public.referrals (referrer_id);
-- Hot path for the release cron: due qualified rows.
create index if not exists idx_referrals_release  on public.referrals (release_at) where status = 'qualified';
-- Hot path for the settlement balance: a host's released cash rewards.
create index if not exists idx_referrals_rewarded on public.referrals (referrer_id) where status = 'rewarded';

alter table public.referral_reward_rules enable row level security;
alter table public.referrals             enable row level security;
revoke all on public.referral_reward_rules from anon, authenticated;
revoke all on public.referrals             from anon, authenticated;

-- ── Seed rules (matches sales-commission structure; all admin-editable live) ──
-- Yearly: first payment qualifies (min 1). Monthly: retention-gated (min 2 charges),
-- smaller reward — a monthly signup that churns must not out-cost its margin.
insert into public.referral_reward_rules
  (referred_plan, cadence, reward_type, reward_value, min_qualifying_charges, hold_days, monthly_cap, active) values
  ('creator',      'annual',  'cash_inr', 200, 1, 14, 10, true),
  ('professional', 'annual',  'cash_inr', 500, 1, 14, 10, true),
  ('creator',      'monthly', 'cash_inr',  50, 2, 14, 10, true),
  ('professional', 'monthly', 'cash_inr', 100, 2, 14, 10, true)
on conflict (referred_plan, cadence) do nothing;

-- ── Ledger account for the marketing expense (mirrors v2.8 chart_of_accounts) ─
insert into public.chart_of_accounts (code, name, type) values
  ('5400', 'Referral Rewards', 'EXPENSE')
on conflict (code) do nothing;
