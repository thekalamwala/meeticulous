-- ============================================================
-- v3.34 — Supreme membership (admin-only god-tier)
--
-- Supreme is a hidden, admin-assigned plan that:
--   • unlocks every feature, unlimited limits, 0% commission
--   • bypasses admin kill-switches (except the hardcoded SAFETY_KEYS
--     denylist enforced in code — see server/config/featureRegistry.js)
--   • is NEVER shown on the public pricing page / onboarding / upgrade flow
--
-- Hiding mechanism: active = false. That single property excludes Supreme
-- from publicPlans (filters active !== false) AND from the 2–3 active-plan
-- rule (countActive counts active = true), while planService.getPlan still
-- loads it (loads ALL plans regardless of active) so limits/commission and
-- the bypass capability resolve normally for assigned holders.
--
-- Apply via Supabase MCP to BOTH databases (Mumbai prod + Tokyo staging).
-- ============================================================

-- 1. Generic capability column. The kill-switch bypass keys off THIS flag,
--    not a magic slug — a future bypass tier just sets it true.
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS bypasses_kill_switches BOOLEAN NOT NULL DEFAULT false;

-- 2. Seed the Supreme plan (idempotent). All limits -1 (unlimited), commission
--    0, every feature on, free (no Razorpay), active = false (hidden), bypass on.
INSERT INTO subscription_plans
  (name, slug, annual_price, monthly_price, billing_cycle, commission_percentage,
   limits, features, integrations, support_type, active, sort_order, bypasses_kill_switches)
VALUES
  ('Supreme', 'supreme', 0, 0, 'yearly', 0,
   '{"services":-1,"bookings_per_year":-1,"digital_products":-1,"calendar_integrations":-1,"profile_theme_colors":-1,"reminder_flows":-1,"followup_flows":-1,"categories":-1}',
   '{"booking_page":true,"online_appointments":true,"offline_appointments":true,"payment_collection":true,"email_notifications":true,"whatsapp_notifications":true,"booking_confirmation":true,"booking_cancellation":true,"booking_completion_notifications":true,"client_records":true,"booking_history":true,"client_history":true,"client_notes":true,"auto_invoices":true,"invoice_history":true,"basic_reports":true,"advanced_reports":true,"data_export":true}',
   '{"calendar_apps":["google_calendar","zoom","ical"],"allow_primary_platform_selection":true}',
   'priority', false, 99, true)
ON CONFLICT (slug) DO UPDATE
  SET bypasses_kill_switches = true,
      active                 = false,
      commission_percentage  = 0,
      limits                 = EXCLUDED.limits,
      features               = EXCLUDED.features,
      integrations           = EXCLUDED.integrations,
      updated_at             = now();

-- 3. Allow 'supreme' as a profiles.plan value. The original CHECK
--    (v1.2 / v1.6_catchup) enumerated plan values inline; Postgres stores
--    `plan IN (...)` normalized as `plan = ANY (ARRAY[...])` and auto-names the
--    constraint `profiles_plan_check`. Drop it by name AND defensively drop any
--    other CHECK that enumerates plan values (match the normalized form), then
--    re-add. Also folds in 'starter' (planService normalizes explorer→starter;
--    the original CHECK never allowed the canonical 'starter' value).
--    Existing plan values (explorer/creator/professional/NULL) all satisfy the
--    new set, so the ADD never trips on existing rows.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'profiles'::regclass
       AND contype  = 'c'
       AND (pg_get_constraintdef(oid) ILIKE '%(plan = ANY%'
         OR pg_get_constraintdef(oid) ILIKE '%plan % IN %')
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('explorer','starter','creator','professional','supreme'));
