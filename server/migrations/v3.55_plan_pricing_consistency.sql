-- ============================================================
-- v3.55 — Plan pricing & feature consistency (matrix 2026-06-30)
-- ------------------------------------------------------------
-- Aligns subscription_plans with the published pricing matrix so the DISPLAYED
-- plans (homepage + /pricing, sourced from static client/src/data/plans.js) match
-- the ENFORCED limits exactly — no more advertise-vs-enforce drift.
--
-- JSONB-merge (||) only overwrites the keys in the matrix; keys NOT listed
-- (profile_theme_colors, followup_flows, allow_primary_platform_selection) are
-- preserved as-is. Idempotent — safe to re-run.
--
-- Prices CHANGE: Host+ ₹199→₹229 / ₹999→₹1,499 (both cadences); Studio monthly
-- ₹499→₹555 (annual ₹3,650 unchanged). Stale razorpay_plan_id_* are NULLed for the
-- changed cadences so ensureRazorpayPlan() (paymentController) regenerates them at
-- the new amount on the next subscription. Existing subscribers stay on their
-- current Razorpay mandate (grandfathered) — only NEW subs use the new price.
--
-- NOTE: existing paid hosts who today exceed the new (lower) Host+ caps
-- (services 20→5, calendar 2→1) keep their current services — middleware blocks
-- NEW creation past the cap, it does not disable what's already live.
--
-- APPLY TO BOTH DBs: Tokyo (staging) AND Mumbai (prod). After applying, the
-- planService 60s cache self-busts; admin saves also call clearCache().
-- ============================================================

-- ── STARTER (free) ──────────────────────────────────────────
UPDATE subscription_plans SET
  monthly_price         = 0,
  annual_price          = 0,
  commission_percentage = 5,
  support_type          = 'standard',
  limits   = limits   || '{"services":3,"bookings_per_year":300,"digital_products":1,"categories":1,"calendar_integrations":1,"reminder_flows":0,"free_services":2}'::jsonb,
  features = features || '{"booking_page":true,"online_appointments":true,"offline_appointments":false,"payment_collection":true,"booking_confirmation":true,"booking_cancellation":true,"booking_completion_notifications":true,"email_notifications":true,"whatsapp_notifications":true,"client_records":false,"booking_history":false,"client_history":false,"client_notes":false,"auto_invoices":false,"invoice_history":false,"basic_reports":false,"advanced_reports":false,"data_export":false,"multiple_schedules":false,"priority_feature_access":false,"custom_fields":false,"recurring_clients":false,"custom_branding":"none"}'::jsonb,
  integrations = integrations || '{"calendar_apps":["google_calendar"]}'::jsonb,
  updated_at = now()
WHERE slug = 'starter';

-- ── CREATOR (Host+) ─────────────────────────────────────────
UPDATE subscription_plans SET
  monthly_price         = 229,
  annual_price          = 1499,
  commission_percentage = 0,
  support_type          = 'priority_email',
  razorpay_plan_id_monthly = NULL,   -- monthly price changed (₹199 → ₹229)
  razorpay_plan_id_annual  = NULL,   -- annual price changed (₹999 → ₹1,499)
  limits   = limits   || '{"services":5,"bookings_per_year":1000,"digital_products":5,"categories":2,"calendar_integrations":1,"reminder_flows":1,"free_services":-1}'::jsonb,
  features = features || '{"booking_page":true,"online_appointments":true,"offline_appointments":true,"payment_collection":true,"booking_confirmation":true,"booking_cancellation":true,"booking_completion_notifications":true,"email_notifications":true,"whatsapp_notifications":true,"client_records":false,"booking_history":false,"client_history":false,"client_notes":false,"auto_invoices":true,"invoice_history":true,"basic_reports":true,"advanced_reports":false,"data_export":false,"multiple_schedules":false,"priority_feature_access":false,"custom_fields":false,"recurring_clients":false,"custom_branding":"standard"}'::jsonb,
  integrations = integrations || '{"calendar_apps":["google_calendar"]}'::jsonb,
  updated_at = now()
WHERE slug = 'creator';

-- ── PROFESSIONAL (Studio) ───────────────────────────────────
UPDATE subscription_plans SET
  monthly_price         = 555,
  annual_price          = 3650,
  commission_percentage = 0,
  support_type          = 'priority',
  razorpay_plan_id_monthly = NULL,   -- monthly price changed (₹499 → ₹555); annual ₹3,650 unchanged → keep its id
  limits   = limits   || '{"services":-1,"bookings_per_year":-1,"digital_products":-1,"categories":-1,"calendar_integrations":2,"reminder_flows":-1,"free_services":-1}'::jsonb,
  features = features || '{"booking_page":true,"online_appointments":true,"offline_appointments":true,"payment_collection":true,"booking_confirmation":true,"booking_cancellation":true,"booking_completion_notifications":true,"email_notifications":true,"whatsapp_notifications":true,"client_records":true,"booking_history":true,"client_history":true,"client_notes":true,"auto_invoices":true,"invoice_history":true,"basic_reports":true,"advanced_reports":true,"data_export":true,"multiple_schedules":true,"priority_feature_access":true,"custom_fields":true,"recurring_clients":true,"custom_branding":"premium"}'::jsonb,
  integrations = integrations || '{"calendar_apps":["google_calendar","ical"]}'::jsonb,
  updated_at = now()
WHERE slug = 'professional';
