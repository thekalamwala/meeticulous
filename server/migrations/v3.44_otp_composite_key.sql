-- v3.44 — otp_codes composite primary key (email, type) (audit P1-9)
--
-- BEFORE: PRIMARY KEY (email) — exactly one OTP row per email, SHARED between
-- booking/login codes (type='booking') and password-reset codes
-- (type='password_reset'). Consequences:
--   * An unauthenticated POST /auth/send-otp for a victim's email clobbered an
--     in-flight password-reset code → reset silently failed ("Invalid reset code").
--   * otpStore.set reset locked_until/attempts to null, clearing the reset
--     brute-force lockout that resetPassword deliberately enforces.
--
-- FIX: make (email, type) the primary key so booking and reset codes live in
-- separate rows and never overwrite each other. Application code (otpStore.js,
-- authController forgotPassword/resetPassword) is updated to scope every
-- read/write/delete by `type`, and to upsert ON CONFLICT (email, type).
--
-- DEPLOY ORDER — apply this migration AFTER the new server build is live, NOT
-- before:
--   * The NEW code is backward-compatible: it upserts ON CONFLICT (email,type)
--     and falls back to ON CONFLICT (email) when the composite key is absent, so
--     it runs correctly on the OLD (email-PK) schema.
--   * The OLD code only does ON CONFLICT (email). Once this migration drops the
--     single-column PK, `email` is no longer a standalone unique key, so the old
--     code's send-otp / forgot-password upserts would error (42P10).
-- Therefore: deploy the new build first (it tolerates both schemas), then run
-- this migration. On Render free tier a deploy is a full restart (no old+new
-- overlap), so there is no window of old code meeting the new schema.

ALTER TABLE public.otp_codes ALTER COLUMN type SET DEFAULT 'booking';
UPDATE public.otp_codes SET type = 'booking' WHERE type IS NULL;
ALTER TABLE public.otp_codes ALTER COLUMN type SET NOT NULL;

ALTER TABLE public.otp_codes DROP CONSTRAINT IF EXISTS otp_codes_pkey;
ALTER TABLE public.otp_codes ADD CONSTRAINT otp_codes_pkey PRIMARY KEY (email, type);
