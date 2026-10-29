-- ============================================================
-- v3.56 — Grandfather existing free users onto pre-v3.55 limits
-- ------------------------------------------------------------
-- v3.55 reduced the free tier (services 5→3, bookings 1000→300, dropped
-- offline appts / client records). New free signups (slug 'explorer', which
-- reads the new 'starter' row) get the reduced tier — intended. But existing
-- free users were on the SAME 'explorer' slug, so they got silently downgraded.
--
-- Fix: a hidden `starter_legacy` plan row carrying the OLD free limits, and
-- reassign every CURRENT free user (plan='explorer') onto it. New signups keep
-- landing on 'explorer' (new limits). Slug is NOT aliased in planService, so it
-- reads its own row; planService.isFreeSlug() recognises it as free (commission,
-- onboarding, UI all treat it like Starter).
--
-- APPLY ORDER: deploy the code (planService.isFreeSlug + paymentController +
-- themeUtils) FIRST, THEN run this. Otherwise the reassigned users briefly read
-- as "paid" in paymentController's commission check.
--
-- APPLY TO BOTH DBs (Tokyo staging + Mumbai prod). Idempotent.
-- ============================================================

-- 1) Allow the new slug on profiles.plan.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan = ANY (ARRAY['explorer','starter','starter_legacy','creator','professional','supreme']));

-- 2) Hidden legacy free plan = pre-v3.55 free limits/benefits.
INSERT INTO subscription_plans
  (name, slug, annual_price, monthly_price, billing_cycle, commission_percentage,
   limits, features, integrations, support_type, sort_order, active)
VALUES
  ('Starter (Legacy)', 'starter_legacy', 0, 0, 'yearly', 5,
   '{"services":5,"bookings_per_year":1000,"digital_products":3,"categories":0,"calendar_integrations":1,"profile_theme_colors":3,"reminder_flows":0,"followup_flows":0,"free_services":2}'::jsonb,
   '{"booking_page":true,"online_appointments":true,"offline_appointments":true,"payment_collection":true,"booking_confirmation":true,"booking_cancellation":true,"booking_completion_notifications":true,"email_notifications":true,"whatsapp_notifications":true,"client_records":true,"booking_history":true,"client_history":false,"client_notes":false,"auto_invoices":false,"invoice_history":false,"basic_reports":false,"advanced_reports":false,"data_export":false}'::jsonb,
   '{"calendar_apps":["google_calendar"]}'::jsonb,
   'standard', 0, false)
ON CONFLICT (slug) DO NOTHING;

-- 3) Grandfather every existing free user. New signups stay on 'explorer'.
UPDATE profiles SET plan = 'starter_legacy', updated_at = now()
WHERE plan = 'explorer';

-- Verify
SELECT plan, count(*) FROM profiles GROUP BY plan ORDER BY plan;
