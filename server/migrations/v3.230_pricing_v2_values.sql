-- ============================================================
-- v3.230 — Pricing v2 VALUES  (docs/pricing-v2-spec.md §1, §2, §3)
-- ------------------------------------------------------------
-- Split from v3.229 so the schema could ship early. Read v3.229's header for
-- the GST regimes, the back-solved prices and the legacy-row rules.
--
-- APPLIED 2026-11-28 on the Meeticulous DB (spquowzrefozmrzoszkf) right after the
-- release-to-main deploy (#475) went live, and verified.
-- Was: PENDING — apply AT RELEASE MERGE, not before. Live within planService's 60s
-- cache, and before the code ships it would:
--   - charge ₹199 / ₹1,199 while the site still advertises the old prices
--   - open Creator Intelligence for Pro (limits.insights)
--   - turn on the host reschedule alert for Starter (reminder_flows 2 trips
--     rescheduleNotifyForPlan's >= 2 check until §4 item 8 lands)
-- Requires v3.229 (commission_rates column). Idempotent, re-runnable.
-- ============================================================

-- 2) Starter (+ legacy free rows) ──────────────────────────────────────────
--    jsonb || merges only the keys named, so any other limit key survives.
--    categories = profile categories, primary included (hostController
--    updateCategories). Founder ruling 2026-11-27: Starter is 1 (spec said 2).
-- commission_percentage is the scalar fallback getRate uses when a row has no map;
-- it is also what the upgrade page / onboarding print as "N% commission", so it
-- carries the appointments rate (9). Applied on its own 2026-11-28 after the values.
UPDATE subscription_plans SET
  commission_percentage = 9,
  limits = COALESCE(limits, '{}'::jsonb)
        || '{"crm":50,"reminder_flows":2,"followup_flows":1,"categories":1,"free_services":2,"digital_products":-1}'::jsonb,
  commission_rates = '{"appointments":9,"products":12,"courses":12,"memberships":12,"appointment_band_inr":null,"appointment_rate_above_band":null}'::jsonb
WHERE slug IN ('free', 'starter', 'starter_legacy');

-- 3) Pro + founding ────────────────────────────────────────────────────────
UPDATE subscription_plans SET
  limits = COALESCE(limits, '{}'::jsonb)
        || '{"crm":-1,"reminder_flows":-1,"followup_flows":-1,"categories":-1,"free_services":-1,"digital_products":-1,"insights":-1}'::jsonb,
  commission_rates = '{"appointments":0,"products":4,"courses":4,"memberships":4,"appointment_band_inr":25000,"appointment_rate_above_band":3}'::jsonb
WHERE slug IN ('premium', 'premium_founding');

-- 4) Prices — and drop the immutable Razorpay plan only when the price moves.
UPDATE subscription_plans SET
  razorpay_plan_id_monthly = CASE WHEN monthly_price IS DISTINCT FROM 168.64  THEN NULL ELSE razorpay_plan_id_monthly END,
  razorpay_plan_id_annual  = CASE WHEN annual_price  IS DISTINCT FROM 1016.10 THEN NULL ELSE razorpay_plan_id_annual  END,
  monthly_price = 168.64,
  annual_price  = 1016.10
WHERE slug = 'premium';

UPDATE subscription_plans SET
  razorpay_plan_id_monthly = CASE WHEN monthly_price IS DISTINCT FROM 168.64 THEN NULL ELSE razorpay_plan_id_monthly END,
  razorpay_plan_id_annual  = CASE WHEN annual_price  IS DISTINCT FROM 761.86 THEN NULL ELSE razorpay_plan_id_annual  END,
  monthly_price = 168.64,
  annual_price  = 761.86
WHERE slug = 'premium_founding';

-- 5) Legacy paid tiers keep Pro-equivalent entitlements (Intelligence included).
UPDATE subscription_plans SET
  limits = COALESCE(limits, '{}'::jsonb) || '{"insights":-1}'::jsonb
WHERE slug IN ('creator', 'professional', 'supreme');

-- ── Verify ──────────────────────────────────────────────────────────────────
SELECT slug, active, monthly_price, annual_price,
       round(monthly_price + round(monthly_price * 0.18, 2), 2) AS monthly_charged,
       round(annual_price  + round(annual_price  * 0.18, 2), 2) AS annual_charged,
       commission_percentage, commission_rates,
       limits->'crm' AS crm, limits->'reminder_flows' AS rem, limits->'followup_flows' AS fu,
       limits->'categories' AS cat, limits->'free_services' AS free_svc,
       limits->'digital_products' AS dp, limits->'insights' AS insights,
       razorpay_plan_id_monthly, razorpay_plan_id_annual
FROM subscription_plans ORDER BY active DESC, sort_order, slug;
