-- v3.79 — global session invalidation stamp (Google Cross-Account Protection / RISC)
--
-- When Google RISC notifies us that a host's Google account is compromised
-- (sessions-revoked / tokens-revoked / account-disabled / account-purged), we
-- stamp sessions_valid_after = now() on their profile. authMiddleware.protect
-- then rejects any Supabase access token whose `iat` predates the stamp — a true
-- "sign out everywhere" that supabase-js's admin API can't do by user id.
--
-- Nullable, no default: an unstamped profile (the normal case) is never affected,
-- so the auth hot path stays a no-op for everyone until an incident stamps a row.
alter table profiles add column if not exists sessions_valid_after timestamptz;

comment on column profiles.sessions_valid_after is
  'RISC/global-logout watermark: reject access tokens issued (iat) before this time. Set on Google account-compromise events. See controllers/securityRiscController.js.';
