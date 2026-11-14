# P0 Load-Health Runbook — pre-launch

**TL;DR:** the code is already right. Cache headers, in-process response cache
(`services/responseCache.js`, host+blog+service), `CLIENT_IP_HEADER` support
(`lib/clientIp.js`), prerender-for-bots + static shell — all built. P0 is **three
dashboard actions**, verified below. No code change ships for P0.

Measured 2026-11-13 (single-IP, read-only, ipGuard-exempt paths, against the
`meeticulous-api.onrender.com` origin):

- `/health` (no DB, outside `/api`): **320 concurrent, 117 rps, 0 errors, ~160ms**
  real latency. Raw request handling is fine.
- `/api/blogs`, `/api/host/:u`: fully CDN-cacheable (`s-maxage` set, **no
  Set-Cookie**) but **`cf-cache-status: DYNAMIC`** — nothing caches them. Browser
  calls the API directly; there is no user-controlled CDN on the API.
- The 429s / 2s latency seen under load were **our own per-IP guards** (`apiLimiter`
  100/min, `speedLimiter` 2s cap), not Render. True infra ceiling is still
  unmeasured (needs the staging box — see `loadtest-staging-setup.md`).

**The one real exposure at launch:** a spike of real visitors → every browser hits
the single Render origin because the cacheable API responses aren't cached at an
edge. Fix = put a caching CDN in front of the API.

---

## State today (verified)

| Thing | State |
|---|---|
| `meeticulous.com` nameservers | **Vercel DNS** (`ns1/ns2.vercel-dns.com`) — not on your Cloudflare |
| `api.meeticulous.com` | CNAME → Render (`*.onrender.com.cdn.cloudflare.net`) — on **Render's** Cloudflare, DYNAMIC, no cache control for you |
| `CLIENT_IP_HEADER` on Render | unset (`ipBlockConfig.js:49` reads it; empty) |
| Instance warm | yes right now (~0.5s) |
| Cache headers on public GETs | correct (`httpCache.js`) |
| In-proc response cache | on, covers host/blog/service (`responseCache.js`) |

---

## P0-A — `CLIENT_IP_HEADER` (quick win, no DNS move) ⚡

Why first: it's independent of the CDN move and fixes per-IP ban/limit keying.
`api.meeticulous.com` already sits behind Render's Cloudflare, which sets
`cf-connecting-ip` to the true client.

1. Render → `meeticulous-api` service → Environment → add:
   ```
   CLIENT_IP_HEADER=cf-connecting-ip
   ```
2. Save → it redeploys.
3. **Verify:** Admin → Security → Blocked IPs. Ban a test IP from a known address;
   confirm the row shows that **real** address, not a `10.x`/Cloudflare IP. Unban.

> If rows still show one shared IP, the header isn't surviving — tell me and I'll
> check `trust proxy` (`server.js:24`, currently `1`) against the real hop count.

## P0-B — Edge-cache the API (the big win, has DNS risk) 🔴

Goal: a CDN in front of the API honors `s-maxage` so a spike is served from edge,
origin untouched. Requires your own Cloudflare zone.

1. **Move `meeticulous.com` DNS to Cloudflare** — follow
   `docs/cloudflare-edge-setup.md` Steps 1–4 exactly (export Vercel DNS records
   first; keep MX/SPF/DKIM **DNS-only**; SSL = Full strict). This is the risky step
   (email + Vercel verification break if a record is missed) — do it off-peak.
2. Ensure `api.meeticulous.com` is a **Proxied** (orange) record → Render origin.
3. Cloudflare → Caching → **Cache Rules** → new rule:
   - When: `(http.host eq "api.meeticulous.com" and starts_with(http.request.uri.path, "/api/blogs"))`
     `or (... "/api/host/") or (... "/sitemap") or (... "/prerender")`
   - Then: **Eligible for cache**, **Respect origin** TTL (honors our `s-maxage`).
   - Leave everything else (auth, bookings, payments, admin) **bypass cache**.
4. **Verify:** `curl -sI https://api.meeticulous.com/api/blogs` twice → second shows
   `cf-cache-status: HIT`. Then re-point `VITE_API_URL` to `https://api.meeticulous.com/api`
   if it isn't already, so browsers use the cached edge.
5. After the move, redo P0-A's header check (the real-client header may change to
   your-Cloudflare `cf-connecting-ip`; it stays `cf-connecting-ip`, just verify).

> I can drive the Cloudflare dashboard (cache rule + verify) via the browser once
> the nameservers are moved and you're signed in. Say the word.

## P0-C — Keep-warm (free) 🟢

Render Free spins down on idle → 30s+ cold start for the first launch visitor.

1. UptimeRobot (or any monitor) → HTTP(s) monitor on
   `https://api.meeticulous.com/health` (or the onrender URL) every **5 min**.
2. Add that monitor's IP + your office IP to Admin → Security → **Allowlist** so the
   probe is never auto-banned.
3. **Verify:** no cold-start stalls in Render logs after an idle hour.

---

## When to spend money (P1, after P0)

- Render Free → **Standard + autoscale** (~$25/mo) = the actual load balancer
  (≥2 instances, no spin-down). Set `REDIS_URL` so `responseCache` is shared across
  them (code already supports it).
- Supabase paid compute when DB-read load climbs.

Buy these against the **real** infra number from the staging test, not a guess.
