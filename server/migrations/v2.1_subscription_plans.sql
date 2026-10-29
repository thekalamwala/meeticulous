-- ============================================================
-- v2.1 — Database-driven Vendor Subscription Plans (spec v1.1)
-- No plan logic in code: limits, features, integrations and
-- commission all live here. Applied via MCP on 2026-06-10.
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(100) NOT NULL UNIQUE,
  slug                  VARCHAR(50)  NOT NULL UNIQUE,
  annual_price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_cycle         TEXT NOT NULL DEFAULT 'yearly',
  commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  limits                JSONB NOT NULL DEFAULT '{}',   -- services, bookings_per_year, digital_products, calendar_integrations, profile_theme_colors, reminder_flows, followup_flows (-1 = unlimited)
  features              JSONB NOT NULL DEFAULT '{}',   -- boolean feature flags
  integrations          JSONB NOT NULL DEFAULT '{}',   -- { calendar_apps: [], allow_primary_platform_selection }
  support_type          TEXT DEFAULT 'standard',
  sort_order            INTEGER DEFAULT 0,
  active                BOOLEAN DEFAULT TRUE,           -- archived = false; existing subscribers unaffected
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Seed the three v1.1 plans (idempotent). Values verbatim from spec JSON.
INSERT INTO subscription_plans (name, slug, annual_price, billing_cycle, commission_percentage, limits, features, integrations, support_type, sort_order) VALUES
(
  'Starter', 'starter', 0, 'yearly', 5,
  '{"services":10,"bookings_per_year":1000,"digital_products":3,"calendar_integrations":1,"profile_theme_colors":3,"reminder_flows":0,"followup_flows":0}',
  '{"booking_page":true,"online_appointments":true,"offline_appointments":true,"payment_collection":true,"email_notifications":true,"whatsapp_notifications":true,"booking_confirmation":true,"booking_cancellation":true,"booking_completion_notifications":true,"client_records":true,"booking_history":true,"auto_invoices":false,"basic_reports":false,"advanced_reports":false,"client_notes":false,"data_export":false}',
  '{"calendar_apps":["google_calendar"]}',
  'standard', 1
),
(
  'Creator', 'creator', 999, 'yearly', 0,
  '{"services":20,"bookings_per_year":2000,"digital_products":10,"calendar_integrations":2,"profile_theme_colors":16,"reminder_flows":1,"followup_flows":1}',
  '{"booking_page":true,"online_appointments":true,"offline_appointments":true,"payment_collection":true,"email_notifications":true,"whatsapp_notifications":true,"booking_confirmation":true,"booking_cancellation":true,"booking_completion_notifications":true,"client_records":true,"booking_history":true,"client_history":true,"auto_invoices":true,"basic_reports":true,"advanced_reports":false,"client_notes":false,"data_export":false}',
  '{"calendar_apps":["google_calendar","zoom"],"allow_primary_platform_selection":true}',
  'priority_email', 2
),
(
  'Professional', 'professional', 3650, 'yearly', 0,
  '{"services":30,"bookings_per_year":3000,"digital_products":20,"calendar_integrations":3,"profile_theme_colors":-1,"reminder_flows":2,"followup_flows":2}',
  '{"booking_page":true,"online_appointments":true,"offline_appointments":true,"payment_collection":true,"email_notifications":true,"whatsapp_notifications":true,"booking_confirmation":true,"booking_cancellation":true,"booking_completion_notifications":true,"client_records":true,"booking_history":true,"client_history":true,"client_notes":true,"auto_invoices":true,"invoice_history":true,"basic_reports":true,"advanced_reports":true,"data_export":true}',
  '{"calendar_apps":["google_calendar","zoom","ical"],"allow_primary_platform_selection":true}',
  'priority', 3
)
ON CONFLICT (slug) DO NOTHING;
