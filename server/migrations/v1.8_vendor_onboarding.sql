-- v1.8: Vendor Onboarding — Complete flow with step tracking, OTP, and plan management
-- Adds fields to profiles for onboarding state machine tracking.

-- Alter profiles table to add onboarding fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS onboarding_step_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vendor_type TEXT,
ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS booking_type TEXT,
ADD COLUMN IF NOT EXISTS calendar_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS calendar_skipped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS plan_activated_at TIMESTAMPTZ;

-- Create otp_sessions table for onboarding flow
CREATE TABLE IF NOT EXISTS otp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_slug TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  phone TEXT,
  email_otp TEXT,
  phone_otp TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  email_attempts INTEGER DEFAULT 0,
  phone_attempts INTEGER DEFAULT 0,
  email_locked_until TIMESTAMPTZ,
  phone_locked_until TIMESTAMPTZ,
  email_otp_expires_at TIMESTAMPTZ,
  phone_otp_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create razorpay_orders table for tracking orders and webhook verification
CREATE TABLE IF NOT EXISTS razorpay_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES profiles(id),
  order_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_id TEXT,
  payment_status TEXT,
  payment_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_sessions_slug ON otp_sessions(onboarding_slug);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_slug ON profiles(onboarding_slug);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_vendor ON razorpay_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_order_id ON razorpay_orders(order_id);

-- RLS for otp_sessions: server-only (deny all, only supabaseAdmin can access)
ALTER TABLE otp_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "otp_sessions_deny_all" ON otp_sessions
  FOR ALL
  TO authenticated
  USING (FALSE);

-- RLS for razorpay_orders: server-only
ALTER TABLE razorpay_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "razorpay_orders_deny_all" ON razorpay_orders
  FOR ALL
  TO authenticated
  USING (FALSE);
