-- v3.51 — IP blocking system: blocked_ips + ip_allowlist (app-layer auto-ban).
--
-- Companion to the rate limiters in middleware/security.js. The app auto-bans IPs
-- that repeatedly trip rate limits (source='auto'), instantly bans attack-pattern
-- hits (source='auto_attack'), and locks out admin-login brute-force per IP
-- (source='admin_lockout'). Admins can also ban/unban manually (source='manual').
--
-- IP column is `inet` (not text): native validation, and free CIDR-range support
-- later via `inet <<= cidr` (enforcement is exact-match in v1). The app keeps both
-- tables cached in-memory and writes here via service_role only — no anon/auth
-- grants (post-audit posture). expires_at NULL = a permanent ban. ip_allowlist
-- entries can NEVER be auto-banned (checked first) — seed it with the founder/office
-- IP + UptimeRobot before relying on auto-ban, or you can lock yourself out.

create table if not exists blocked_ips (
  id          uuid primary key default gen_random_uuid(),
  ip          inet not null unique,
  reason      text,
  source      text not null default 'manual',   -- manual | auto | auto_attack | admin_lockout
  created_by  text,                              -- admin username, or null for auto
  created_at  timestamptz not null default now(),
  expires_at  timestamptz                        -- NULL = permanent
);
create index if not exists idx_blocked_ips_expires on blocked_ips(expires_at);

create table if not exists ip_allowlist (
  id          uuid primary key default gen_random_uuid(),
  ip          inet not null unique,
  note        text,
  created_by  text,
  created_at  timestamptz not null default now()
);

alter table blocked_ips  enable row level security;
alter table ip_allowlist enable row level security;
revoke all on blocked_ips  from anon, authenticated;
revoke all on ip_allowlist from anon, authenticated;
