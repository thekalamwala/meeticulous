-- ============================================================
-- v3.169 — Per-service "Price on request"
-- ------------------------------------------------------------
-- Lets a host hide a service's fee on the public page and book it as a
-- no-payment enquiry (host quotes/discusses fees offline). Motivating case:
-- Chartered Accountants bound by ICAI solicitation rules, who cannot advertise
-- fees. Applies to any service/host — it is a host-set per-service flag, not
-- profession-gated.
--
-- Behaviour when true (all display-gated; the raw `price` column is NOT touched,
-- so nothing is lost and toggling off restores the shown price):
--   * public service card / detail / booking page show "Price on request"
--     instead of the amount
--   * booking takes the existing no-payment path (like a ₹0 service) — no
--     Razorpay step; the host follows up on price
--
-- Default false → every existing service keeps showing its price exactly as
-- today. Additive + NOT NULL DEFAULT false, so the code-side schema fallback in
-- serviceController/hostController is safe before this is applied.
--
-- APPLY TO BOTH DBs (Tokyo staging xwvciqkayammbvsidqig + Mumbai prod
-- ayjhlwyzszykqtnaktpb). Idempotent.
-- ============================================================

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS price_on_request boolean NOT NULL DEFAULT false;

-- Verify
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'services' AND column_name = 'price_on_request';
