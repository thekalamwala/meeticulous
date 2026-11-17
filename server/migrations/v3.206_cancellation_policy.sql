-- v3.206 Pro cancellation policy — plumbing (ships DORMANT behind `pro_cancellation_policy`).
--
-- Lets a Pro host keep more of a late-cancelled / no-show booking by refunding LESS of
-- money ALREADY collected upfront — via the existing Razorpay refund rail. No card on
-- file, no wallet, no post-hoc charge (see the no-wallet-no-card rule). Additive + the
-- code reads these with schema-fallback, so a boot before this migration is safe.
--
-- Columns:
--   services.cancellation_policy  — a Pro host's per-service override (P4 writes it);
--                                   NULL = use the plan default.
--   bookings.cancellation_policy  — the RESOLVED policy SNAPSHOT at booking time. This is
--                                   the fairness anchor: refunds read this snapshot, never
--                                   the live service/plan, so a host editing their policy
--                                   later can't change terms a guest already agreed to.
-- Shape (both): {"tiers":[{"hours":48,"pct":1},{"hours":24,"pct":0.5},{"hours":0,"pct":0}]}
--   tiers = refund fraction of the SERVICE PRICE when the guest cancels ≥ `hours` before start.

ALTER TABLE services ADD COLUMN IF NOT EXISTS cancellation_policy jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_policy jsonb;

-- Money-gating flag ships OFF (fail-open isFeatureEnabled → must be pre-seeded disabled).
-- When OFF: resolveCancellationPolicy returns today's 24h/6h tiers for everyone (no change).
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'pro_cancellation_policy',
  'Pro Cancellation Policy',
  'Pro hosts get stricter, customizable cancellation refund tiers (keep more on late cancels/no-shows). Off = the standard 24h/6h tiers apply to everyone.',
  'Bookings',
  'both',
  false
)
ON CONFLICT (key) DO NOTHING;
