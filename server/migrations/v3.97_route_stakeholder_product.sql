-- v3.97_route_stakeholder_product.sql — Razorpay Route Phase 0.5: stakeholder +
-- product (settlement) bookkeeping on the KYC row.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- Phase 0 (v3.95) stored the linked-account id. Phase 0.5 extends onboarding to
-- attach the individual's PAN via a STAKEHOLDER and enable the 'route' PRODUCT
-- with a settlement bank account. We record the resulting ids so onboarding is
-- resumable + idempotent (each step is skipped when its id is already present).
--   razorpay_stakeholder_id   sth_... — the individual stakeholder (holds PAN)
--   razorpay_product_id       acc_prd_... — the enabled 'route' product config
--   route_activation_status   Razorpay product activation_status
--                             (e.g. 'needs_clarification' | 'under_review' | 'activated')
--
-- Additive only; code keeps a schema fallback until applied on both DBs. Still
-- dormant behind fee_only_mode — no money moves as a result of this migration.

ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS razorpay_stakeholder_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_product_id     TEXT,
  ADD COLUMN IF NOT EXISTS route_activation_status TEXT;
