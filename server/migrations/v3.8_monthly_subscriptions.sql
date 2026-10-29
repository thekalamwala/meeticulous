-- ============================================================
-- v3.8 — Monthly subscription plans + auto-renewing subscriptions
-- (design: docs/superpowers/specs/2026-06-15-monthly-plans-design.md)
--
-- Cadence is a property of the vendor's SUBSCRIPTION, not the plan:
-- one plan row carries both monthly_price and annual_price. Razorpay
-- Subscriptions drive auto-renewal for both cadences.
--
-- Schema-fallback pattern: planService + controllers tolerate these
-- columns being absent until this migration is applied in Supabase.
-- ============================================================

-- ── Plans: monthly price + Razorpay Plan object ids (per cadence) ──
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS monthly_price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS razorpay_plan_id_monthly TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_plan_id_annual  TEXT;
-- NOTE: billing_cycle column retained for back-compat; no longer drives logic.

-- ── Vendor subscription state ──
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_cadence          TEXT,          -- 'monthly' | 'annual'
  ADD COLUMN IF NOT EXISTS subscription_status      TEXT,          -- 'active' | 'pending' | 'halted' | 'cancelled'
  ADD COLUMN IF NOT EXISTS current_period_end       TIMESTAMPTZ;   -- mirrors plan_expires_at

-- ── Per-charge traceability on the existing payments ledger source ──
ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_cadence          TEXT,
  ADD COLUMN IF NOT EXISTS kind                     TEXT DEFAULT 'initial'; -- initial | renewal | proration

-- ── Backfill existing paid vendors onto the annual cadence ──
-- They stay on the legacy one-time model (no mandate on file) until they
-- re-subscribe via the Phase C migration prompt. current_period_end mirrors
-- the access gate so reconciliation has a period boundary to read.
UPDATE profiles
   SET billing_cadence     = 'annual',
       subscription_status = 'active',
       current_period_end  = plan_expires_at
 WHERE plan_expires_at IS NOT NULL
   AND plan IS NOT NULL
   AND lower(plan) NOT IN ('starter', 'explorer')
   AND billing_cadence IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_rzp_subscription
  ON profiles (razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subpay_rzp_subscription
  ON subscription_payments (razorpay_subscription_id);
