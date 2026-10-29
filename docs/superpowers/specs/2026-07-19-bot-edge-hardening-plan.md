# Bolt 958 — edge hardening plan (rotating-IP defense at the door)

**Date:** 2026-07-19
**Status:** plan / infra follow-up — NOT built on `feat/bolt-abuse-hardening`
**Companion:** `2026-07-19-bot-cost-breaker-design.md` (the app-level floor that
ships first)

## Why this exists

Rotating IPs cannot be stopped in application code. A per-IP limit is defeated by
the next IP; a global app-level cap protects the wallet but still *accepts and
processes* attack traffic (it just refuses the expensive model call). To reject
abusive traffic **before it reaches the server at all**, you need a layer in front
of the origin that can challenge or block by behaviour, not just by IP. That layer
is a CDN/WAF you control — Cloudflare, since the domains already resolve through it.

The app-level cost breaker (companion doc) is the **floor**; this edge layer is the
**wall**. Defense-in-depth: build the floor first (it holds unconditionally), add
the wall when infra time allows.

## Current state (measured 2026-07-19)

- `meeticulous-api.onrender.com` responds with `Server: cloudflare`, `CF-RAY`, and
  `x-render-origin-server: Render`. That Cloudflare is **Render's managed edge** —
  we get TLS/CDN but **no configurable WAF, Turnstile, or rate rules**.
- `meeticulous.com` (frontend) is `Server: cloudflare` + Vercel — likely already on
  the org's own Cloudflare zone, but the **bot API is not routed through it**.

Net: no edge controls we can configure on the API path today.

## Target architecture

```
Browser (widget on meeticulous.com)
   │  fetch https://api.meeticulous.com/api/bot/ask(/stream)
   ▼
YOUR Cloudflare zone (meeticulous.com)         ← Turnstile verify, rate rules, bot fight, WAF
   │  proxied (orange-cloud) DNS: api → Render custom domain
   ▼
Render origin (meeticulous service)          ← app-level cost breaker (companion doc)
```

Move the bot API onto a subdomain of the domain you already control in Cloudflare
(`api.meeticulous.com`), proxied through your Cloudflare zone, with Render as the
origin. Then Cloudflare's bot tools apply to every bot request.

## Steps

### 1. Put the API on your Cloudflare zone
- Add a **custom domain** `api.meeticulous.com` to the Render service (Render →
  service → Settings → Custom Domains). Render issues the cert.
- In Cloudflare DNS for `meeticulous.com`, add `api` as a **proxied** (orange-cloud)
  CNAME to the Render target. Now `api.meeticulous.com` flows through your Cloudflare.
- Point the client at it: set `VITE_API_URL=https://api.meeticulous.com/api` (Vercel
  env) and confirm CORS (`corsOrigins.js`) still allows the `meeticulous.com` origin.
  No server code change — just the hostname.

### 2. Turnstile (invisible challenge) on the widget
- Create a Cloudflare **Turnstile** site key (invisible / managed mode — no visible
  puzzle for real users).
- Frontend `BotWidget.jsx`: load the Turnstile script, obtain a token, send it as an
  `cf-turnstile-response` header/body field on `/ask(/stream)`.
- Backend: a small middleware verifies the token via Cloudflare's
  `siteverify` endpoint before the handler; missing/invalid → 403. A botnet hitting
  the API directly (no browser, no valid token) is rejected at ~zero cost.
- Keep it **fail-open on Turnstile-service outage** for real users, but log — the
  app cost breaker still bounds spend if verification is temporarily skipped.

### 3. Cloudflare rate-limiting rules (dashboard, no code)
- Rule on `api.meeticulous.com/api/bot/*`: e.g. **> N requests / 10s per IP → managed
  challenge**, and a higher **global** threshold → block. These run at the edge
  before Render, so they cost nothing at the origin.
- Because it's per-IP *at the edge*, combine with Turnstile + bot-fight so rotating
  IPs still face a challenge each.

### 4. Bot Fight Mode / Super Bot Fight Mode
- Enable Cloudflare **Bot Fight Mode** (free) or Super Bot Fight Mode (paid) on the
  zone — challenges known bot signatures automatically. Verify it doesn't challenge
  the legitimate widget (allowlist the widget's behaviour / Turnstile-passed traffic).

### 5. WAF managed rules
- Turn on Cloudflare **Managed Ruleset** for the zone (OWASP-style) — catches generic
  injection/scan traffic on the API subdomain for free.

## How it composes with the app breaker

| Layer | Stops | Cost to us |
|---|---|---|
| Cloudflare bot fight + Turnstile | Bots without a real browser / challenge pass | 0 (edge) |
| Cloudflare rate rules | Volumetric floods, per-IP + global, at the edge | 0 (edge) |
| App global cap (`botGlobalLimiter`) | Anything that slips the edge, by volume | tiny |
| App model-call budget (`botBudget`) | Guarantees model spend ≤ budget, always | tiny |

Even if Cloudflare is bypassed or misconfigured, the app breaker keeps spend bounded.
Even if the app breaker's limits are set generously, the edge keeps most abuse from
ever arriving.

## Effort & risk

- **Effort:** mostly dashboard + DNS + one Turnstile integration (frontend token +
  backend verify). ~half a day, no schema/migration.
- **Risk:** the API hostname change (`api.meeticulous.com`) must be rolled out with
  CORS + `VITE_API_URL` in lockstep, or the widget breaks. Do it in a low-traffic
  window; keep the old `onrender.com` host working during cutover.
- **Turnstile false-positives** on real users → invisible/managed mode + fail-open
  verification mitigate; monitor after launch.

## Suggested order

1. Ship the app-level cost breaker (companion doc) — floor in place, no infra.
2. Add `api.meeticulous.com` through Cloudflare (step 1) — no behaviour change yet.
3. Turn on Cloudflare rate rules + Bot Fight + WAF (steps 3–5) — pure dashboard.
4. Add Turnstile (step 2) last — the one code change; validate it doesn't hurt real
   users before relying on it.
