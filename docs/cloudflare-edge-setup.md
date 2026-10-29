# Cloudflare Edge Setup — Runbook

**Purpose:** put Cloudflare in front of Meeticulous so volumetric/DDoS/bot traffic
is blocked at the edge, *before* it reaches Render. This is the strongest layer of
the IP-blocking system; the in-app blocklist (admin → Security → Blocked IPs) is the
second layer for app-specific abuse.

**Status:** not yet executed — gated on the `meeticulous.com` DNS move. Run this when
you move DNS to Cloudflare. No application code changes; this is all dashboard/ops,
plus **one env var** at the end (`CLIENT_IP_HEADER`).

> **⚠️ The shared-IP failure in Step 9 is ALREADY ACTIVE (not future).** `CLIENT_IP_HEADER`
> is unset, so `lib/clientIp.js` falls back to `req.ip`, which resolves to Render's
> **internal `10.x` proxy IP** — shared across all traffic. A single auto-ban on that
> IP locks out the entire API. Observed recurring on 2026-07-23. See the incident
> section immediately below; the permanent fix is Step 9 (`CLIENT_IP_HEADER`).

**Topology today:** apex `meeticulous.com` → Vercel (React client); the client calls
same-origin `/api/*` which Vercel rewrites to the Render API
(`meeticulous-api.onrender.com`). Cloudflare will sit in front of the public domain.

---

## ⚠️ Incident response — mass "Access denied." 403 lockout

**Symptom:** every `/api/*` (except the exempt webhook / health / prerender / sitemap
paths) returns `403 {"message":"Access denied."}`. Users see an empty blog, blank
data, or can't log in. It hits everyone at once, admins included.

**Root cause:** `server/middleware/ipGuard.js` is blocking the request's client IP.
With `CLIENT_IP_HEADER` unset, `getClientIp` (`server/lib/clientIp.js`) returns
Render's shared **internal `10.x`** proxy IP, and the attack-pattern matcher
(`ipBlockConfig.attack` — a single suspicious request → 24h ban, no threshold)
auto-bans that shared IP → the whole platform is locked out.

**Confirm it's this:** `curl -s https://meeticulous-api.onrender.com/api/blogs` returns
`{"message":"Access denied."}` (403). Then check the ban table (Supabase prod Mumbai
`PROD_PROJECT_REF`):
```sql
select ip, source, reason, created_at, expires_at from blocked_ips
where expires_at is null or expires_at > now() order by created_at desc;
```
If the active rows are private ranges (`10.x`, `172.16–31.x`, `192.168.x`), it's this bug.

**Immediate recovery** (site back within ~60s) — delete the bogus private-range bans:
```sql
delete from blocked_ips
where ip << inet '10.0.0.0/8'
   or ip << inet '172.16.0.0/12'
   or ip << inet '192.168.0.0/16';
```
The in-app cache re-syncs from the DB every `IP_BLOCK_CACHE_REFRESH_MS` (default 60s).
Verify recovery: `curl -s -o /dev/null -w "%{http_code}\n" https://meeticulous-api.onrender.com/api/blogs` → `200`.

**Notes:**
- The admin "Blocked IPs" UI can't fix this — the admin API is *also* behind `ipGuard`,
  so admins are locked out too. Use the SQL above (service-role) or the kill-switch.
- `seedBlogs.js` and other service-role scripts write straight to the DB and **succeed
  even while the API is 403'd** — a green reseed does NOT mean the site is up. Check
  `/api/blogs` separately.

**Kill-switch** (neutralise the entire guard, no deploy): set `IP_BLOCK_ENABLED=false`
on Render. Re-enable once `CLIENT_IP_HEADER` is fixed.

**Fixed at the code layer 2026-09-10:** `lib/ipBlocklist.js` now refuses to ever
create or honour a ban on a private/reserved (RFC1918, loopback, link-local) IP —
`addBan` skips it (`{ok:false, skipped:'private-range'}`) and `isBlocked` always
returns `false` for one, even for a bad row already sitting in the DB from a past
incident. A single auto-ban on Render's internal `10.x` address can no longer lock
out the platform, regardless of whether `CLIENT_IP_HEADER` is set. Step 9 below is
still the right permanent fix (bans should key on the real client, not fail to key
on the proxy hop at all), but this closes the "everyone 403s" blast radius even if
Step 9 is skipped or misconfigured.

**This recurs until Step 9 is done.** Each recurrence needs a manual unban. The
permanent fix is to key the guard on the real client IP — see Step 9 below.

---

## Prerequisites
- A Cloudflare account (free plan is enough to start).
- Access to the domain registrar / current DNS host (Hostinger) to change
  nameservers.
- The current DNS records (export them first — see step 1).

---

## Step 1 — Record current DNS, then add the site to Cloudflare
1. In your current DNS host (Hostinger), **screenshot / export every existing
   record** (A, AAAA, CNAME, MX, TXT — especially MX and SPF/DKIM/DMARC for email,
   and any Vercel/Render verification records). You must recreate these in
   Cloudflare or email + verification will break.
2. In Cloudflare: **Add a site** → enter `meeticulous.com` → choose the **Free** plan.
3. Cloudflare auto-imports detected records. **Compare against your export** and add
   anything missing. Do NOT proxy mail records (MX/TXT stay "DNS only" / grey cloud).

## Step 2 — Proxy the web records
- For the records that serve the website (apex `@` and `www` pointing to Vercel),
  set them to **Proxied** (orange cloud). That routes web traffic through Cloudflare.
- Leave MX, SPF/DKIM/DMARC, and any verification TXT records **DNS only** (grey).

## Step 3 — Switch nameservers
1. Cloudflare shows two assigned nameservers (e.g. `xxx.ns.cloudflare.com`).
2. In Hostinger, set the domain's nameservers to those two. Save.
3. Propagation takes minutes to a few hours. Cloudflare emails you when the site is
   **Active**. The site stays up throughout (records were copied first).

## Step 4 — SSL/TLS
- SSL/TLS → Overview → set encryption mode to **Full (strict)** (Vercel/Render both
  present valid certs). Avoid "Flexible" (causes redirect loops + insecure backhaul).
- Enable **Always Use HTTPS** (SSL/TLS → Edge Certificates).

## Step 5 — WAF managed rules
- Security → WAF → **Managed rules**: enable the **Cloudflare Managed Ruleset**
  (and OWASP Core Ruleset if available on your plan). Start in *Log* for a day if you
  want to watch for false positives, then switch to *Block*.

## Step 6 — Rate-limiting rules (edge)
These complement the app's per-route limiters by stopping floods at the edge.
- Security → WAF → **Rate limiting rules** → create rules such as:
  - **Auth/OTP:** path `contains /api/auth` OR `/api/admin-auth` → e.g. 20 requests
    / 1 min per IP → **Block** for 10 min.
  - **General API:** path `starts with /api` → e.g. 300 requests / 1 min per IP →
    **Managed Challenge**.
  Tune the numbers to your real traffic; keep them well above normal usage.

## Step 7 — IP / ASN / country block rules
- Security → WAF → **Custom rules**: add block rules as needed, e.g.
  - Block specific IPs / CIDR ranges (`ip.src in {…}`).
  - Block or challenge by country (`ip.geoip.country in {…}`) or hosting ASN if you
    see datacenter abuse.
- Note: in-app country blocking is intentionally **not** built — do it here.

## Step 8 — Bot mitigation + "Under Attack" mode
- Security → Bots → enable **Bot Fight Mode** (free).
- Know where the **"I'm Under Attack"** mode toggle is (Security → Settings →
  Security Level → *Under Attack*). Flip it on only during an active attack — it
  shows an interstitial challenge to every visitor.

---

## Step 9 — CRITICAL: set the real client-IP header

> **Do this NOW — do not wait for the Cloudflare migration.** The shared-IP lockout is
> already happening (bans on Render's internal `10.x`), so this fix is needed today,
> independent of Steps 1–8. Follow 9.1 against the *current* production path to find the
> header, then set the env var (9.2). Redo 9.1 after the Cloudflare move if the header changes.

Once traffic flows through Cloudflare → (Vercel rewrite) → Render, the address
Express sees in `req.ip` is **no longer the real visitor**. The real client IP is
forwarded in a header. If you skip this, the app-layer blocklist will treat *all*
traffic as coming from one upstream IP — and a single auto-ban would lock out
**everyone**.

1. **Find which header actually carries the client IP at Render.** Temporarily log
   it: hit the site through the new Cloudflare path and check, in Render logs, the
   values of `cf-connecting-ip`, `x-forwarded-for`, and `x-real-ip` for an inbound
   request. (Cloudflare sets `CF-Connecting-IP` to the true client; whether it
   survives the Vercel rewrite to Render must be verified — that's the point of this
   step.)
2. **Set the env var on Render** to that header name, e.g.:
   ```
   CLIENT_IP_HEADER=cf-connecting-ip
   ```
   Redeploy/restart. `lib/clientIp.js` then keys every ban on the real client IP.
3. **Re-check `trust proxy`.** `server.js` currently sets `app.set('trust proxy', 1)`
   (one proxy hop). With Cloudflare + Vercel in front there may be more hops; if
   `req.ip` is still used anywhere as a fallback and looks wrong, increase the hop
   count. **Fixed 2026-09-10:** every per-IP rate limiter in `middleware/security.js`
   now shares one `ipKeyGenerator` that resolves through `getClientIp()` (same
   helper the blocklist uses), so setting `CLIENT_IP_HEADER` protects ALL of them,
   not just `adminLimiter`/`botLimiter` as before. `req.ip` is only ever the
   fallback when the header is absent.
4. **Optional hardening:** once on Cloudflare, restrict Render/Vercel to only accept
   traffic with valid Cloudflare headers (e.g. Cloudflare Authenticated Origin Pulls
   or an allowlist of Cloudflare IP ranges) so attackers can't bypass the edge by
   hitting the origin directly.

---

## Verification checklist
- [ ] Site loads over HTTPS through Cloudflare (Cloudflare cookie / `cf-ray` response
      header present).
- [ ] Email still works (sent + received) — confirms MX/SPF/DKIM survived.
- [ ] Razorpay webhook still delivers (it's exempt from the in-app IP guard, but
      confirm Cloudflare WAF isn't blocking it; allowlist the webhook path if needed).
- [ ] `CLIENT_IP_HEADER` set on Render and the admin → Security → Blocked IPs page
      shows real client IPs (ban a test IP from a known address and confirm the row
      shows that address, not a Cloudflare/Vercel IP).
- [ ] Add the founder/office IP + UptimeRobot to the **Allowlist** before relying on
      auto-ban.
