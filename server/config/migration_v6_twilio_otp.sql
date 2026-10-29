-- Run in Supabase SQL Editor
-- Stores the WhatsApp phone used for OTP delivery alongside email fallback.

ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

ALTER TABLE product_purchases ADD COLUMN IF NOT EXISTS buyer_phone TEXT DEFAULT '';
