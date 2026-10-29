-- ============================================================
-- v1.9 — Dynamic Notification System
-- Run in Supabase SQL Editor.
-- Adds: notification_providers, notification_events,
--       notification_logs, hardened otp_codes columns.
-- ============================================================

-- 1. Provider config (AiSensy etc.) — secrets live here, not in code
CREATE TABLE IF NOT EXISTS notification_providers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL UNIQUE,            -- 'aisensy', 'smtp'
  api_key       TEXT DEFAULT '',
  settings_json JSONB DEFAULT '{}',              -- { connected_number, webhook_url, ... }
  is_active     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE notification_providers ENABLE ROW LEVEL SECURITY;
-- No public policies: only the service role (server) may touch this table.

-- 2. Event registry — code knows event_key; campaign names are admin data
CREATE TABLE IF NOT EXISTS notification_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key        TEXT NOT NULL UNIQUE,
  display_name     TEXT NOT NULL,
  whatsapp_enabled BOOLEAN DEFAULT FALSE,
  email_enabled    BOOLEAN DEFAULT TRUE,
  campaign_name    TEXT DEFAULT '',               -- AiSensy campaign name
  email_subject    TEXT DEFAULT '',
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

-- 3. Delivery logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key   TEXT NOT NULL,
  channel     TEXT NOT NULL,                      -- 'whatsapp' | 'email'
  destination TEXT NOT NULL,                      -- phone or email
  status      TEXT NOT NULL DEFAULT 'pending',    -- 'sent' | 'failed' | 'pending'
  response    JSONB DEFAULT '{}',
  error       TEXT,
  payload     JSONB DEFAULT '{}',                 -- params used (for retry)
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event   ON notification_logs (event_key);
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- 4. Harden otp_codes: hashed OTP + attempt/send tracking + lockout
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS otp_hash      TEXT DEFAULT '';
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempts      INTEGER DEFAULT 0;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS send_count    INTEGER DEFAULT 0;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS first_send_at TIMESTAMPTZ;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS locked_until  TIMESTAMPTZ;

-- 5. Seed events (idempotent). Campaign names are editable in Super Admin.
INSERT INTO notification_events (event_key, display_name, whatsapp_enabled, email_enabled, campaign_name, email_subject) VALUES
  ('BOOKING_OTP',                 'Booking OTP',                       TRUE,  TRUE,  'otp',                          'Your Book A Sloth verification code'),
  ('BOOKING_CONFIRMED_CUSTOMER',  'Booking Confirmed — Customer',      TRUE,  TRUE,  'booking_confirmation_user',    'Booking confirmed'),
  ('BOOKING_CONFIRMED_VENDOR',    'Booking Confirmed — Vendor',        TRUE,  TRUE,  'booking_confirmation_vendor',  'New booking'),
  ('BOOKING_COMPLETED_CUSTOMER',  'Booking Completed — Customer',      TRUE,  TRUE,  '',                             'Thanks for your booking'),
  ('BOOKING_CANCELLED_CUSTOMER',  'Booking Cancelled — Customer',      TRUE,  TRUE,  '',                             'Booking cancelled'),
  ('BOOKING_CANCELLED_VENDOR',    'Booking Cancelled — Vendor',        TRUE,  TRUE,  '',                             'Booking cancelled'),
  ('BOOKING_REMINDER_CUSTOMER',   'Booking Reminder — Customer',       FALSE, TRUE,  '',                             'Upcoming appointment reminder'),
  ('BOOKING_REMINDER_VENDOR',     'Booking Reminder — Vendor',         FALSE, TRUE,  '',                             'Upcoming session reminder'),
  ('BOOKING_RESCHEDULED_CUSTOMER','Booking Rescheduled — Customer',    FALSE, TRUE,  '',                             'Please confirm your rescheduled booking'),
  ('BOOKING_RESCHEDULED_VENDOR',  'Booking Rescheduled — Vendor',      FALSE, TRUE,  '',                             'Booking rescheduled'),
  ('PASSWORD_RESET',              'Password Reset',                    FALSE, TRUE,  '',                             'Your Book A Sloth password reset code'),
  ('VENDOR_WELCOME',              'Vendor Welcome',                    FALSE, TRUE,  '',                             'Welcome to Book A Sloth')
ON CONFLICT (event_key) DO NOTHING;

-- 6. Seed AiSensy provider row (inactive, no key — admin fills it in the UI)
INSERT INTO notification_providers (provider, api_key, settings_json, is_active)
VALUES ('aisensy', '', '{"connected_number":"","webhook_url":""}', FALSE)
ON CONFLICT (provider) DO NOTHING;
