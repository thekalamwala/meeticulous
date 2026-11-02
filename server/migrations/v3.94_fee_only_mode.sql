-- v3.94 — Interim fee-only mode (no Razorpay Route yet)
--
-- Meeticulous is not yet a licensed payment aggregator and Razorpay Route is
-- pending approval, so no host money may be collected-and-remitted. Until Route
-- goes live the platform runs in FEE-ONLY mode:
--   • hosts cannot list a paid service — all service prices are ₹0;
--   • every booking still collects Meeticulous's own booking fee + GST, with a
--     guest tax invoice, into the BAS account — no host money moves.
--
-- This migration does two things:
--   1. Zeroes every existing service price (existing paid listings become ₹0).
--   2. Seeds the `fee_only_mode` platform setting = true. (Code already defaults
--      to true when the row is absent, so this row exists mainly so an admin can
--      SEE and later FLIP it to false on Route go-live.)
--
-- Enforcement lives in code (serviceController + hostController force price 0;
-- pricingEngine chargeFeeOnFree; bookingController branches on customerTotal;
-- paymentController order guard). Flip fee_only_mode → false to re-enable host
-- pricing + payouts once Route is approved. Idempotent — safe to re-run on BOTH DBs.

-- 1. Zero all existing service prices.
update services
   set price = 0,
       updated_at = now()
 where price is distinct from 0;

-- 2. Seed the flag (do NOT overwrite an admin's later choice).
insert into platform_settings (key, value)
values ('fee_only_mode', 'true'::jsonb)
on conflict (key) do nothing;
