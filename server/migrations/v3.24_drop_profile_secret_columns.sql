-- v3.24 — POST-DEPLOY ONLY. Do NOT apply until the v3.23 code (profileSecrets +
-- dual-write + profile_private reads) is live in production.
--
-- Drops the now-redundant secret columns from `profiles`:
--   * google_access_token / google_refresh_token  -> moved to profile_private (v3.23)
--   * otp_code / otp_expires_at / is_otp_verified  -> DEAD (the live OTP flow uses
--     the `otp_codes` table via utils/otpStore.js; these columns are unreferenced
--     except defensive `delete user.otp_code` scrubs, which become harmless no-ops).
--
-- Sequencing: applying this BEFORE the cleanup code ships would 500 the running
-- server, which still SELECTs profiles.google_*. As of branch fix/security-followup
-- (2026-06-23) the dual-write in authController.attachGoogleToProfile and the
-- profiles.google_* SELECTs (getAvailableSlots, paymentController) are REMOVED —
-- tokens live only in profile_private — so this is safe to apply once that branch
-- is deployed. profile_private verified in sync (prod 23/23, staging 3/3).

alter table public.profiles drop column if exists google_access_token;
alter table public.profiles drop column if exists google_refresh_token;
alter table public.profiles drop column if exists otp_code;
alter table public.profiles drop column if exists otp_expires_at;
alter table public.profiles drop column if exists is_otp_verified;
