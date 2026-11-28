-- ============================================================
-- v3.229 — Pricing & Plan Gating v2  (docs/pricing-v2-spec.md §8 step 1)
-- ------------------------------------------------------------
-- Additive, idempotent, non-destructive. No column dropped, no host's `plan`
-- rewritten, no historical booking touched.
--
-- SCHEMA (dormant until the code reads it — safe to apply any time):
--   subscription_plans.commission_rates  per-surface rate map (§2). NULL on any
--       row = planService.getRate falls back to the commission_percentage
--       scalar, so a partially-migrated DB can never break checkout.
--   bookings.platform_fee_gross          what the guest paid for the fee (§2.1).
--
-- VALUES (§1 prices, §2 rate maps, §3 limits) are in v3.230_pricing_v2_values.sql,
--   which goes live within planService's 60s cache — so it waits for the release.
--
-- ── GST: three regimes, on purpose (§0). Do not normalise. ──────────────────
--   subscription prices  stored EX-GST, engine adds 18%  (prices: v3.230)
--   commission           GST-INCLUSIVE, backed out       (pricingEngine — untouched)
--   platform fee         flips EX-GST → INCLUSIVE        (§2.1, step 3 code)
--
-- ── Platform-fee snapshot contract on bookings (from step 3 onward) ─────────
--   platform_fee_gross   = gross the guest pays           (NEW, e.g. 10.00)
--   platform_fee_amount  = taxable value, ex-GST          (e.g. 8.47)
--   platform_fee_gst     = gross − taxable, the REMAINDER (e.g. 1.53)
--   platform_fee_amount keeps its existing meaning (the ex-GST fee), so
--   customer_total = service + amount + gst stays true and every reader of
--   those two columns (invoices, ledger, GST export) keeps working unchanged.
--   platform_fee_gross is NULL on pre-v2 rows: there, gross = amount + gst.
--
-- ── Applied commission rate: reuse bookings.commission_percentage ───────────
--   Spec §2 asks for a new bookings.commission_rate_applied. bookings already
--   has commission_percentage (v2.8 snapshot, written by createBooking at
--   bookingController:648, read by refunds/payouts). Step 4 writes the rate the
--   map resolved into THAT column instead of adding a duplicate.
--
-- ── Prices (§1): back-solved, never rounded up (v3.165 convention) ──────────
--   168.64  + 30.36  = ₹199.00   Pro monthly
--   1016.10 + 182.90 = ₹1,199.00 Pro yearly
--   761.86  + 137.13 = ₹898.99   founding yearly (₹899.00 not reachable from a
--                                2-dp base; 761.87 would charge ₹899.01)
--   Verified through computeSubscriptionBreakdown on 2026-11-27.
--   Razorpay Plan objects are immutable, so a price change NULLs the cached
--   razorpay_plan_id_* (as planAdminController does on an admin edit); the next
--   checkout mints a new plan. Live subscriptions stay on their old object.
--
-- ── Legacy rows ─────────────────────────────────────────────────────────────
--   starter / starter_legacy get the same Starter values as `free` (v3.165
--   precedent: legacy free rows track Starter). creator / professional /
--   supreme get `insights` only (test 19: Pro-equivalent); prices, scalar 0%
--   commission and Razorpay ids untouched. No commission_rates on them → scalar
--   fallback = 0% everywhere, which is their grandfathered deal.
--
-- APPLIED 2026-11-27 (schema only) on the Meeticulous DB (spquowzrefozmrzoszkf).
-- The VALUES live in v3.230_pricing_v2_values.sql, applied at release merge.
-- ============================================================

-- 1) Schema ─────────────────────────────────────────────────────────────────
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS commission_rates jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS platform_fee_gross numeric(10,2);

COMMENT ON COLUMN subscription_plans.commission_rates IS
  'Per-surface commission % (GST-inclusive): appointments, products, courses, memberships, '
  'appointment_band_inr, appointment_rate_above_band. NULL → commission_percentage scalar. v3.229';
COMMENT ON COLUMN bookings.platform_fee_gross IS
  'Pricing snapshot: platform fee the guest paid, GST-inclusive (= platform_fee_amount + platform_fee_gst). '
  'NULL on bookings before v3.229. Immutable after insert.';
COMMENT ON COLUMN bookings.platform_fee_amount IS
  'Pricing snapshot: platform fee TAXABLE value (ex-GST). From v3.229 backed out of platform_fee_gross. '
  'Immutable after the booking row is inserted.';

-- ── Verify ──────────────────────────────────────────────────────────────────
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'subscription_plans' AND column_name = 'commission_rates')
    OR (table_name = 'bookings' AND column_name = 'platform_fee_gross'));
