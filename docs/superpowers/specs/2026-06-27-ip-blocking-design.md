# IP Blocking System — Design Spec

**Date:** 2026-06-27
**Branch:** `feat/ip-blocking-system`
**Status:** Approved, implementation in progress

## Goal

Protect the Meeticulous API from abusive/hostile traffic with two complementary
layers:

1. **Edge (Cloudflare)** — block volumetric/DDoS/bot traffic *before* it reaches
   Render. Delivered as an ops runbook the founder executes when the
   `meeticulous.com` DNS move happens. No application code.
2. **App-layer auto-ban** — an in-app IP blocklist that auto-bans IPs which
   repeatedly trip the existing rate limiters, plus a separate stricter tracker
   for admin-login brute-force, plus a full admin page to manage bans and an
   allowlist. This is the code deliverable.

IP blocking is the *weakest* anti-attack layer on its own (attackers rotate IPs;
app-layer blocking still spends Render CPU). It is layered on top of the existing
defenses in `server/middleware/security.js` (per-IP + per-contact rate limiting,
helmet/CSP/HSTS, HPP, body sanitize, suspicious-pattern blocker), not a
replacement for them.

## Non-goals (YAGNI)

- CIDR / range bans — the `inet` column supports it for the future, but v1 does
  **exact-IP** matching only.
- In-app country/ASN blocking — that is Cloudflare's job (edge).
- Geo-IP lookup.
- Live admin editing of thresholds — v1 thresholds are env-driven; surfacing them
  on the admin page is a noted future enhancement.

## Constraints (current deployment)

- API runs on **Render free tier**: single instance, sleeps on idle, restarts on
  every deploy. In-memory state is ephemeral → bans must persist in the DB.
- `RATE_LIMIT_STORE_URL` is unset → rate limiters use in-memory `MemoryStore`.
- `app.set('trust proxy', 1)` in `server.js` → `req.ip` is correct today behind
  Render's single proxy hop.
- Admin auth already has mandatory TOTP (speakeasy) + SQL break-glass recovery.

## Architecture

```
request
  → trust proxy (existing)
  → ipGuard            ← NEW: 403 if banned (in-memory cache, O(1), fail-open)
  → offense tracker    ← NEW: res.on('finish'); 429 → count → auto-ban
  → helmet / sanitize / rate limiters / routes (existing)
```

### Components

| File | Responsibility |
|---|---|
| `server/migrations/v3.51_ip_blocking.sql` | `blocked_ips` + `ip_allowlist` tables (`inet` IP), indexes, RLS |
| `server/config/ipBlockConfig.js` | All thresholds, read from env with documented defaults |
| `server/lib/ipBlocklist.js` | The brain: DB-backed bans/allowlist with in-memory cache; `isBlocked`, add/remove, expiry, refresh; offense counters |
| `server/middleware/ipGuard.js` | Early ban-enforcement middleware + 429 offense tracker middleware + `getClientIp` |
| `server/routes/adminSecurityRoutes.js` + controller | Admin CRUD API for bans + allowlist |
| `client/src/pages/admin/SecurityBlockedIps.jsx` (+ nav) | Admin UI page |
| `docs/cloudflare-edge-setup.md` | Cloudflare runbook (ops, no code) |

## Data model — `v3.51_ip_blocking.sql`

```sql
CREATE TABLE IF NOT EXISTS blocked_ips (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip          inet NOT NULL UNIQUE,
  reason      text,
  source      text NOT NULL DEFAULT 'manual',   -- manual | auto | auto_attack | admin_lockout
  created_by  text,                              -- admin username, or null for auto
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz                        -- NULL = permanent
);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires ON blocked_ips (expires_at);

CREATE TABLE IF NOT EXISTS ip_allowlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip          inet NOT NULL UNIQUE,
  note        text,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

RLS: enable on both; no anon/auth policies (service-role only, matching the
post-audit posture — anon/auth write grants are revoked platform-wide). All
access is via the API using the service-role client.

## Thresholds — `ipBlockConfig.js`

Two independent trackers + an attack rule. All env-tunable (edit env + restart,
no code change):

| Env var | Default | Meaning |
|---|---|---|
| `IP_BAN_GENERAL_MAX` | `10` | rate-limit violations (429s) before a general ban |
| `IP_BAN_GENERAL_WINDOW_MS` | `900000` | 15-min sliding window for the count |
| `IP_BAN_GENERAL_TTL_MS` | `86400000` | 24h ban duration |
| `IP_BAN_ADMIN_MAX` | `5` | failed admin logins before lockout |
| `IP_BAN_ADMIN_WINDOW_MS` | `900000` | 15-min window |
| `IP_BAN_ADMIN_TTL_MS` | `1800000` | 30-min lockout duration |
| `IP_BAN_ATTACK_TTL_MS` | `86400000` | 24h ban on a suspicious-pattern hit |
| `IP_BLOCK_ENABLED` | `true` | master kill-switch for the whole feature |
| `CLIENT_IP_HEADER` | *(blank)* | header to read the real client IP from; blank → `req.ip`. Set to `cf-connecting-ip` once behind Cloudflare |

## Behavior

### Ban enforcement (`ipGuard`)
- Mounted **early**, right after `trust proxy`, before rate limiters.
- `getClientIp(req)`: if `CLIENT_IP_HEADER` set and present, use it (first value);
  else `req.ip`.
- Order: **allowlist wins** → if banned, respond `403 { message: 'Access denied.' }`.
- Cache: bans + allowlist loaded into in-memory `Map`s at boot; refreshed on every
  admin mutation and on a 60s timer; lazy-expired on lookup. No DB hit per request.
- **Exempt paths**: Razorpay webhook route and health check are never blocked
  (webhook is HMAC-verified; a 403 there would break payments).
- **Fail-open**: any error in the blocklist layer → `next()` (a broken blocklist
  must never take the site down). Also skipped when `IP_BLOCK_ENABLED=false` and
  when `skipWhenLoadTest()` is true.

### General auto-ban (offense tracker)
- A middleware using `res.on('finish')`: when `res.statusCode === 429`, increment
  an in-memory offense counter for the client IP within the sliding window.
- At `>= IP_BAN_GENERAL_MAX`, insert a `blocked_ips` row (`source='auto'`,
  TTL = general TTL) and update the cache. Allowlisted IPs are never counted/banned.
- Counter is in-memory (resets on restart) — acceptable: it only accumulates the
  ban decision; actual bans persist in the DB. Documented as the seam to move to a
  shared store when multi-instance.

### Attack-pattern ban
- `blockSuspiciousRequests` already 400s on SQLi/XSS/path-traversal hits. Hook it
  to also auto-ban the IP (`source='auto_attack'`, 24h) — these are unambiguous
  attacks, no repeat threshold needed.

### Admin-login brute-force lockout
- Separate, stricter counter keyed by client IP, incremented on **failed admin
  login** in the admin auth controller.
- At `>= IP_BAN_ADMIN_MAX` within the admin window, insert a `blocked_ips` row
  (`source='admin_lockout'`, 30-min TTL). It is a full-IP ban (visible + clearable
  on the admin page). Allowlisted admin IPs are exempt, and SQL break-glass remains
  the ultimate escape hatch.

## Admin API — `/api/admin/security`

Behind existing admin auth + TOTP + `adminLimiter`.

- `GET    /blocked-ips` — list active bans (ip, reason, source, created_by,
  created_at, expires_at).
- `POST   /blocked-ips` — `{ ip, reason, permanent?, ttlMs? }` manual ban.
- `DELETE /blocked-ips/:ip` — unban.
- `GET    /allowlist` — list.
- `POST   /allowlist` — `{ ip, note }`.
- `DELETE /allowlist/:ip` — remove.

Input validation rejects non-IP strings (the `inet` cast also enforces this at the
DB layer).

## Admin UI — Security / Blocked IPs page

New page in the admin shell: two sections.
1. **Blocked IPs** — table (IP, reason, source badge, expiry countdown / "permanent",
   added-by), manual add form (IP + reason + permanent toggle), remove button.
2. **Allowlist** — table (IP, note, added-by), add form, remove button, with a note
   that allowlisted IPs can never be auto-banned.

Reuses existing admin shell layout + the admin API client patterns.

## Cloudflare runbook — `docs/cloudflare-edge-setup.md`

Step-by-step, executed when DNS moves:
1. Add `meeticulous.com` to Cloudflare; copy assigned nameservers.
2. Update nameservers at the registrar (Hostinger).
3. Recreate DNS records for the public domain (proxied / orange-cloud).
4. Enable WAF managed ruleset.
5. Add edge rate-limiting rules (per-path budgets).
6. Add IP / ASN / country block rules.
7. Document the "Under Attack" mode toggle.
8. **Verification step**: confirm which forwarding header carries the real client
   IP through to Render, then set `CLIENT_IP_HEADER` accordingly (e.g.
   `cf-connecting-ip`) so the app-layer ban keys the right IP. Without this, an
   edge proxy would make all traffic appear as one IP and a single ban would lock
   out everyone.

## Testing

Jest units in `server/tests/unit/` (matching existing rate-limit test style):
- `ipBlocklist`: add/remove ban, lazy expiry, allowlist-wins, refresh.
- `ipGuard`: 403 for banned IP, pass for allowlisted, exempt webhook path,
  fail-open on error, disabled when `IP_BLOCK_ENABLED=false`.
- offense tracker: N 429s → ban inserted; allowlisted IP never banned; attack hit →
  immediate ban.

Then full `server` jest run + `client` build must be green before PR.

## Rollout / safety

- `IP_BLOCK_ENABLED` master switch (default on, but flip off instantly if needed).
- Seed `ip_allowlist` with the founder/office IP + UptimeRobot **before** relying
  on auto-ban.
- Migration `v3.51` to be applied to **staging (Tokyo)** then **prod (Mumbai)**,
  per the project's two-DB process. Code has no hard dependency that breaks before
  the migration (fail-open + the API simply returns empty lists until tables exist).
- Render needs a manual redeploy on merge (per project ops norms).
