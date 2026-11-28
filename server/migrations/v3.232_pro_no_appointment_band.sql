-- ============================================================
-- v3.232 — Pro: no ₹25,000 appointment band (founder ruling 2026-11-28)
-- ------------------------------------------------------------
-- v3.230 gave Pro 0% on appointments until the host's month-to-date bookings
-- reached ₹25,000, then 3% on whole bookings. Founder decision: no ceiling —
-- "let them earn whatever they can; don't gate Pro." Pro (and founding Pro) is
-- now 0% on appointments however much the host earns. Products, courses and
-- memberships stay at 4%.
--
-- Clears the band keys only; every other rate key survives (jsonb ||). The
-- band mechanism stays in code (planService.appointmentRateFor,
-- lib/appointmentGmv): with both keys null it returns the base rate and the
-- booking path skips the month-to-date read.
--
-- APPLIED 2026-11-28 on the Meeticulous DB (spquowzrefozmrzoszkf) and verified.
-- Idempotent. Rollback: set the two keys back to 25000 / 3.
-- ============================================================

UPDATE subscription_plans
   SET commission_rates = commission_rates
       || '{"appointment_band_inr":null,"appointment_rate_above_band":null}'::jsonb
 WHERE slug IN ('premium', 'premium_founding');

-- ── Verify ──────────────────────────────────────────────────────────────────
SELECT slug, commission_rates FROM subscription_plans
 WHERE slug IN ('premium', 'premium_founding');
