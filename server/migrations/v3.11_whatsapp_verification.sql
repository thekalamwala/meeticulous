-- v3.11_whatsapp_verification.sql
-- WhatsApp number verification for hosts (onboarding + dashboard).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number     TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_verified    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ;

-- Dedicated WhatsApp OTP notification event.
-- campaign_name is left blank: admin sets it (and approves the AiSensy template)
-- in the Super Admin notifications UI before live delivery works.
INSERT INTO notification_events
  (event_key, display_name, whatsapp_enabled, email_enabled, campaign_name, email_subject)
VALUES
  ('WHATSAPP_VERIFY_OTP', 'Vendor WhatsApp Registration OTP', true, false, '', NULL)
ON CONFLICT (event_key) DO NOTHING;
