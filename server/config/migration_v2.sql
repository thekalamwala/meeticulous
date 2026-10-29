-- Run this in Supabase SQL Editor AFTER schema.sql
-- Adds Google Calendar OAuth fields for vendors and OTP support

-- Add Google OAuth tokens to profiles (for vendor Google Calendar integration)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_access_token TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_refresh_token TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT FALSE;

-- Add OTP fields for guest booking verification
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS otp_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_otp_verified BOOLEAN DEFAULT FALSE;

-- Add phone number (optional, useful for OTP via SMS later)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

-- Add meeting_mode to services (online = Google Meet link, offline = no link)
ALTER TABLE services ADD COLUMN IF NOT EXISTS meeting_mode TEXT DEFAULT 'online' CHECK (meeting_mode IN ('online', 'offline'));
