-- ============================================================
-- v3.165 — Two-plan model: Starter (free) + Pro (premium)
-- NOTE: the SQL literals below use the plans' original names; the live rows are
-- now named Starter / Pro (renamed outside this file). Applied history: do not edit SQL.
-- ------------------------------------------------------------
-- Collapses the Starter / Host+ / Studio ladder into exactly two public plans.
-- Every legacy plan row SURVIVES (nobody is migrated off their slug) and is
-- simply hidden from the public catalogue via active=false.
--
--   free     "Starter"         ₹0            commission 5%   PUBLIC
--   premium  "Pro"  ₹399 / ₹3,599 commission 0%   PUBLIC
--
--   starter / starter_legacy   → same generous limits as `free`, hidden
--   creator                    → Pro entitlements at the OLD price,
--                                hidden but still sellable by direct link
--                                (partner / custom-offer channel)
--   professional               → Pro entitlements, hidden
--   supreme                    → UNTOUCHED (internal god tier)
--
-- ── PRICING: why the *_price numbers look odd ───────────────────────────────
-- subscription_plans stores the price EX-GST. computeSubscriptionBreakdown()
-- adds 18% on top, and cadenceAmountPaise() is what Razorpay actually debits.
-- The published prices are GST-INCLUSIVE, so the stored values are back-solved:
--
--   monthly_price 338.13  → 338.13 + round2(60.8634) = ₹398.99   (shown "₹399")
--   annual_price  3050.00 → 3050.00 + 549.00         = ₹3,599.00 (shown "₹3,599")
--
-- ₹399.00 is NOT reachable from a 2-decimal ex-GST value (399 / 1.18 =
-- 338.1355…), so 338.13 is deliberate: it charges one paisa UNDER the
-- advertised price. Never round up — charging above the listed price is the
-- one direction that generates complaints. Annual is exact (3050 × 0.18 = 549).
--
-- Annual saves ₹1,189/yr vs 12 × monthly (24.83%, advertised as "Save 25%").
-- ₹3,599 / 365 = ₹9.86/day — the "under ₹10 a day" headline.
--
-- ── SLUGS ARE FROZEN ────────────────────────────────────────────────────────
-- Razorpay stores `notes.plan = '<slug>'` on every live mandate, and
-- subscriptionService.activateFromSubscription() writes that value straight
-- back to profiles.plan on each renewal. Renaming a slug that has live
-- subscriptions silently downgrades a PAYING host to the free tier on their
-- next charge. Display names are safe to change; slugs are not.
-- `creator` currently carries 3 live mandates — do not touch its slug.
--
-- APPLY ORDER: deploy the code (planService FREE_SLUGS/PREMIUM_SLUGS +
-- themeUtils labels) FIRST, THEN run this. planService keeps its schema
-- fallback, so a pre-migration DB is safe either way.
--
-- APPLY TO BOTH DBs (Tokyo staging + Mumbai prod). Idempotent, additive,
-- non-destructive: no row is deleted and no host's `plan` value is rewritten.
-- ============================================================

-- 1) Allow the two new slugs. Every legacy value is preserved.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan = ANY (ARRAY[
    'free','premium',
    'explorer','starter','starter_legacy','creator','professional','supreme'
  ]));

-- 2) Starter — the free plan. Generous by design: it is the acquisition engine.
--    Only the two limits with real marginal cost stay capped (ai_generations
--    burns Anthropic credits, digital_products burns storage). Commission is
--    5%, so a free host who earns nothing costs nothing and a free host who
--    earns a lot is already paying us.
INSERT INTO subscription_plans
  (name, slug, annual_price, monthly_price, billing_cycle, commission_percentage,
   limits, features, integrations, support_type, sort_order, active)
VALUES
  ('Sloth', 'free', 0, 0, 'yearly', 5,
   '{"services":-1,"free_services":-1,"bookings_per_year":-1,"digital_products":3,"categories":-1,"calendar_integrations":1,"profile_theme_colors":-1,"reminder_flows":1,"followup_flows":0,"crm":0,"ai_generations":10}'::jsonb,
   '{"booking_page":true,"online_appointments":true,"offline_appointments":true,"payment_collection":true,"booking_confirmation":true,"booking_cancellation":true,"booking_completion_notifications":true,"email_notifications":true,"whatsapp_notifications":true,"booking_history":true,"auto_invoices":true,"invoice_history":true,"basic_reports":true,"client_records":false,"client_history":false,"client_notes":false,"custom_fields":false,"recurring_clients":false,"advanced_reports":false,"data_export":false,"multiple_schedules":false,"priority_feature_access":false,"custom_branding":"standard"}'::jsonb,
   '{"calendar_apps":["google_calendar"]}'::jsonb,
   'standard', 1, true)
ON CONFLICT (slug) DO NOTHING;

-- 3) Pro — the paid plan. Everything unlimited except the second
--    calendar integration, which is a genuine per-account integration cost.
INSERT INTO subscription_plans
  (name, slug, annual_price, monthly_price, billing_cycle, commission_percentage,
   limits, features, integrations, support_type, sort_order, active)
VALUES
  ('Sloth Active', 'premium', 3050.00, 338.13, 'yearly', 0,
   '{"services":-1,"free_services":-1,"bookings_per_year":-1,"digital_products":-1,"categories":-1,"calendar_integrations":2,"profile_theme_colors":-1,"reminder_flows":-1,"followup_flows":-1,"crm":-1,"ai_generations":-1}'::jsonb,
   '{"booking_page":true,"online_appointments":true,"offline_appointments":true,"payment_collection":true,"booking_confirmation":true,"booking_cancellation":true,"booking_completion_notifications":true,"email_notifications":true,"whatsapp_notifications":true,"booking_history":true,"auto_invoices":true,"invoice_history":true,"basic_reports":true,"client_records":true,"client_history":true,"client_notes":true,"custom_fields":true,"recurring_clients":true,"advanced_reports":true,"data_export":true,"multiple_schedules":true,"priority_feature_access":true,"custom_branding":"premium"}'::jsonb,
   '{"calendar_apps":["google_calendar","ical"],"allow_primary_platform_selection":true}'::jsonb,
   'priority', 2, true)
ON CONFLICT (slug) DO NOTHING;

-- 3b) Re-assert price + limits on re-run (ON CONFLICT above skips updates, so a
--     second run after a numbers change would otherwise be a silent no-op).
UPDATE subscription_plans SET
  name = 'Sloth Active',
  annual_price = 3050.00,
  monthly_price = 338.13,
  commission_percentage = 0,
  limits = '{"services":-1,"free_services":-1,"bookings_per_year":-1,"digital_products":-1,"categories":-1,"calendar_integrations":2,"profile_theme_colors":-1,"reminder_flows":-1,"followup_flows":-1,"crm":-1,"ai_generations":-1}'::jsonb,
  active = true, sort_order = 2
WHERE slug = 'premium';

UPDATE subscription_plans SET
  name = 'Sloth', annual_price = 0, monthly_price = 0, commission_percentage = 5,
  limits = '{"services":-1,"free_services":-1,"bookings_per_year":-1,"digital_products":3,"categories":-1,"calendar_integrations":1,"profile_theme_colors":-1,"reminder_flows":1,"followup_flows":0,"crm":0,"ai_generations":10}'::jsonb,
  active = true, sort_order = 1
WHERE slug = 'free';

-- 4) Existing free hosts (35 on 'explorer' → reads the `starter` row, 31 on
--    'starter_legacy') get the SAME new Starter limits. Nobody is moved; their
--    row is simply upgraded underneath them, and both rows leave the catalogue.
UPDATE subscription_plans SET
  limits = '{"services":-1,"free_services":-1,"bookings_per_year":-1,"digital_products":3,"categories":-1,"calendar_integrations":1,"profile_theme_colors":-1,"reminder_flows":1,"followup_flows":0,"crm":0,"ai_generations":10}'::jsonb,
  commission_percentage = 5,
  active = false
WHERE slug IN ('starter', 'starter_legacy');

-- 5) Legacy paid tiers keep their PRICE (live Razorpay mandates debit a fixed
--    amount and cannot be repriced without fresh customer authorisation) but
--    gain full Pro entitlements. `creator` stays sellable by direct
--    link as the partner / custom-offer price; `professional` is comps only.
UPDATE subscription_plans SET
  name = 'Sloth Active (Partner)',
  limits = '{"services":-1,"free_services":-1,"bookings_per_year":-1,"digital_products":-1,"categories":-1,"calendar_integrations":2,"profile_theme_colors":-1,"reminder_flows":-1,"followup_flows":-1,"crm":-1,"ai_generations":-1}'::jsonb,
  commission_percentage = 0,
  active = false
WHERE slug = 'creator';

UPDATE subscription_plans SET
  name = 'Sloth Active (Legacy Studio)',
  limits = '{"services":-1,"free_services":-1,"bookings_per_year":-1,"digital_products":-1,"categories":-1,"calendar_integrations":2,"profile_theme_colors":-1,"reminder_flows":-1,"followup_flows":-1,"crm":-1,"ai_generations":-1}'::jsonb,
  commission_percentage = 0,
  active = false
WHERE slug = 'professional';

-- 6) New signups land on `free`. (vendorOnboardingController also writes this
--    explicitly; the default is the backstop for any direct insert.)
ALTER TABLE profiles ALTER COLUMN plan SET DEFAULT 'free';

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Public catalogue must be exactly Starter + Pro:
SELECT slug, name, active, sort_order, monthly_price, annual_price,
       commission_percentage,
       round(monthly_price * 1.18, 2) AS monthly_charged,
       round(annual_price  * 1.18, 2) AS annual_charged
FROM subscription_plans ORDER BY active DESC, sort_order;

-- Nobody stranded on a slug the CHECK rejects:
SELECT plan, count(*) FROM profiles GROUP BY plan ORDER BY count(*) DESC;
