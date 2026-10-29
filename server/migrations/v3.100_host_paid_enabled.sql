-- v3.100_host_paid_enabled.sql — per-host paid-mode override (pilot rollout).
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- fee_only_mode is a GLOBAL interim switch: while true, NO host can list a paid
-- service and NO host payout moves. To pilot paid bookings with a single host
-- (instead of flipping the whole platform live), we add a per-host override:
--   profiles.paid_enabled = true  → this host behaves as if fee-only mode were OFF
--   (may list paid services + receives automatic Route payouts), while every other
--   host stays fee-only.
--
-- Effective rule (code, services/paidMode.js):
--   feeOnlyForHost(host) = global fee_only_mode AND NOT profiles.paid_enabled
--
-- Additive, default false (everyone stays fee-only). Code keeps a schema fallback
-- (treats a missing column as paid_enabled=false) until applied on both DBs.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS paid_enabled BOOLEAN NOT NULL DEFAULT false;
