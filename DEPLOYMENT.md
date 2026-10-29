# Book A Sloth — Deployment Runbook

Plain-English guide to taking Book A Sloth from your laptop to a live, secure,
auto-deploying production site. Written for someone new to DevOps. Follow the
phases in order. Each phase says **what you do** (only you can click these) and
**how to verify** it worked.

> **Architecture (what runs where)**
> ```
>                     yourdomain.com
>                           │
>               ┌───────────┴────────────┐
>          (apex + www)             api.yourdomain.com
>               │                          │
>         ┌─────▼─────┐            ┌───────▼────────┐
>         │  Vercel    │ ──API──▶  │  Render (Node) │
>         │ React/Vite │           │ Express + crons │
>         └────────────┘           └───────┬─────────┘
>                                          │
>           Supabase · SMTP · Cloudinary · Razorpay (managed already)
>                                          ▲
>                                  UptimeRobot (monitor)
>
>   git push main → CI (tests) → Render & Vercel auto-deploy
>   Sentry = error tracking   |   daily Supabase backup
> ```
> - **Frontend** → Vercel (free)
> - **Backend** → Render Starter ($7/mo, always-on so reminder/email crons run)
> - **DB/Auth** → Supabase (already hosted)
> - **Monitoring** → UptimeRobot (free) + Sentry (free)
> - **Domain** → Hostinger (DNS only; sites live on Vercel/Render)

---

## ⚠️ Go-Live — Outstanding actions

Live items merged in code but **not yet active in prod** until you do these. Tick
each off; they are ops-only (no code changes).

- [ ] **Permanent-username 301 redirects** — set Vercel env `API_ORIGIN`
      (API base **without** `/api`, e.g. `https://api.yourdomain.com`; **not**
      `VITE_`-prefixed) → **Redeploy** the `client` project so the edge middleware
      (`client/middleware.js`) ships. Until then, changed/old usernames 404 in-app
      instead of redirecting (middleware fails open). DB migration
      `v3.17_username_history.sql` is **already applied live** — nothing to run.
      Details: Phase 3 (initial) / Phase 4C (custom domain).

> Add new rows here whenever a feature ships code that needs a prod env/config
> flip before it works, so go-live steps aren't lost in the phase walkthroughs.

---

## Phase 0 — Repo scaffolding ✅ (already done)

These files were added for you:
- `server/server.js` — new `GET /health` endpoint (used by Render + UptimeRobot)
- `render.yaml` — Render blueprint (build/start/health/region/plan)
- `client/vercel.json` — SPA routing + security headers
- `.github/workflows/ci.yml` — runs build + tests on every push/PR
- `server/.env.example`, `client/.env.example` — full env var templates
- `DEPLOYMENT.md` — this file

**Commit them:**
```bash
git checkout -b chore/deploy-scaffolding
git add server/server.js render.yaml client/vercel.json .github/workflows/ci.yml server/.env.example client/.env.example DEPLOYMENT.md
git commit -m "chore(devops): add deploy scaffolding (health, render, vercel, CI, env templates)"
git push -u origin chore/deploy-scaffolding
# open a PR to main on GitHub, confirm CI is green, then merge
```

---

## Phase 1 — Create accounts (~15 min, free)

Sign up for each **using "Continue with GitHub"** (simplest):

| Service | URL | Why | Cost |
|---|---|---|---|
| Render | https://render.com | Hosts the backend API | $7/mo |
| Vercel | https://vercel.com | Hosts the frontend | Free |
| UptimeRobot | https://uptimerobot.com | Alerts you if site goes down | Free |
| Sentry | https://sentry.io | Tells you when code errors in production | Free |

You already have: GitHub, Supabase, Razorpay, Hostinger, Cloudinary, SMTP.

**Verify:** you can log into all four dashboards.

---

## Phase 2 — Deploy the backend (Render)

### Generate the new production secrets first
Run these locally and **save the output somewhere safe** (a password manager):
```bash
# SUPER_ADMIN_JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# OAUTH_STATE_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# GOOGLE_TOKEN_KEY (must be exactly 32 bytes → 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
> If a secret already exists in your current `server/.env` and is in use, **reuse
> it** — don't regenerate, or you'll invalidate existing admin sessions /
> encrypted Google tokens.

### Deploy
1. Render dashboard → **New → Blueprint**.
2. Connect your GitHub repo. Render reads `render.yaml` and proposes the
   `bookasloth-api` service. Click **Apply**.
3. It will fail/wait on env vars — that's expected. Go to the service →
   **Environment** tab → add the real values for every `sync:false` key. Copy
   them from your working `server/.env`. For now set:
   - `CLIENT_URL` = `http://localhost:5173` (temporary; fixed in Phase 4)
   - `API_URL` = your Render URL (e.g. `https://book-a-sloth.onrender.com`)
   - `GOOGLE_REDIRECT_URI` = `https://book-a-sloth.onrender.com/api/auth/google/callback`
   - `POSTHOG_PROJECT_TOKEN` = your PostHog project token (`phc_...`)
   - `POSTHOG_HOST` = `https://us.i.posthog.com`
     (server-side analytics — without these, backend booking/payment events
     are silently dropped; the app still runs fine)
4. **Manual Deploy → Deploy latest commit.**

**Verify:**
```bash
curl https://book-a-sloth.onrender.com/health
# expect: {"status":"ok","uptime":...,"ts":...}
```
Render dashboard → service should show **Live** (green) and health check passing.

---

## Phase 3 — Deploy the frontend (Vercel)

1. Vercel → **Add New → Project** → import your GitHub repo.
2. **Root Directory** → set to `client` (important — repo has client + server).
3. Framework preset auto-detects **Vite**. Leave build (`vite build`) / output
   (`dist`) as-is.
4. **Environment Variables** → add:
   - `VITE_API_URL` = `https://book-a-sloth.onrender.com` (your Render URL for now)
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
   - `VITE_RAZORPAY_KEY_ID` = your Razorpay key id
   - `VITE_POSTHOG_PROJECT_TOKEN` = your PostHog project token (`phc_...`)
   - `VITE_POSTHOG_HOST` = `https://us.i.posthog.com`
     (frontend analytics — without these, no pageviews/events are captured in prod)
   - `VITE_FB_PIXEL_ID` = `3530370983781569`
   - `VITE_GA4_MEASUREMENT_ID` = `G-96C5ZSXXZW`
   - `VITE_CLARITY_PROJECT_ID` = `x801tklmp6`
     (marketing tags — Meta Pixel / GA4 / Microsoft Clarity. They load **only
     after the visitor accepts the consent banner**. These used to be hardcoded in
     `index.html`, which fired them before consent, so they were moved to env.
     **Skip these three and prod has no Pixel/GA/Clarity at all** — ad conversion
     tracking goes dark. They are public client-side IDs, safe to set here.)
   - `API_ORIGIN` = `https://book-a-sloth.onrender.com` (the **actual** live Render URL)
     (**NOT** `VITE_`-prefixed — this is read at runtime by the Vercel **Edge
     Middleware** `client/middleware.js`, not at build time. It must be the API
     base **without** the trailing `/api`. See the username-redirect callout below.)
     > ⚠️ Must be a **reachable** origin. Do **not** point this at `api.bookasloth.com`
     > unless that subdomain actually resolves to Render — a dangling subdomain makes
     > the 301 fail open (no redirect) AND adds a ~2s hang per profile load. The code
     > default is now `https://book-a-sloth.onrender.com` (the live Render URL), so the
     > middleware works even if this env is unset; still set it explicitly so a future
     > API host change is driven by env, not a code edit.
5. **Deploy.**

**Verify:** open the `*.vercel.app` URL Vercel gives you. Site loads. Open
browser DevTools → Network: API calls go to the Render URL and return 200.

> ### ⚠️ Permanent-username 301 redirects (Edge Middleware)
> Public profiles live at the root path (`/:username`). When a host changes their
> username, the old URL must permanently redirect to the new one (Facebook/GitHub
> style). A React SPA can't emit a real HTTP 301, so `client/middleware.js` runs
> as a **Vercel Edge Middleware**: it resolves the slug via
> `GET {API_ORIGIN}/api/username/resolve/:slug` and issues a **301** to the current
> handle for any stale alias. Everything else passes through to the SPA.
>
> **Required to make it work:**
> 1. Set the `API_ORIGIN` env var (above) — API base **without** `/api`. Missing/wrong
>    → the middleware fails **open** (no crash; old usernames just 404 in-app instead
>    of redirecting).
> 2. **Deploy** so the edge middleware ships (it deploys automatically with the
>    `client` project; no extra config).
> 3. DB migration **`v3.17_username_history.sql` is already applied live** in Supabase
>    (`username_history` table + `change_username` RPC + backfill). Nothing to run.

---

## Phase 4 — Point your domain (Hostinger DNS)

> Replace `yourdomain.com` with your real domain. DNS changes take 5 min–24 hr
> to propagate (usually fast).

### A. Tell the platforms about your domain (do this first)
- **Vercel** → Project → Settings → **Domains** → add `yourdomain.com` AND
  `www.yourdomain.com`. Vercel shows the records you need.
- **Render** → Service → Settings → **Custom Domains** → add
  `api.yourdomain.com`. Render shows a CNAME target (e.g. `book-a-sloth.onrender.com`).

### B. Add the records in Hostinger
Hostinger **hPanel → Domains → (your domain) → DNS / Nameservers → Manage DNS records.**
Add:

| Type | Name / Host | Value / Points to | TTL |
|---|---|---|---|
| A | `@` | `76.76.21.21` (Vercel apex IP) | 3600 |
| CNAME | `www` | `cname.vercel-dns.com` | 3600 |
| CNAME | `api` | `book-a-sloth.onrender.com` (your Render target) | 3600 |

> If Hostinger already has default `A @` or `CNAME www` records, **edit/replace**
> them rather than adding duplicates. Always confirm the exact values shown in
> the Vercel/Render dashboards — they are authoritative if they differ from above.

### C. Update the env vars to the real domains
- **Render → Environment:**
  - `CLIENT_URL` = `https://yourdomain.com`
  - `API_URL` = `https://api.yourdomain.com`
  - `GOOGLE_REDIRECT_URI` = `https://api.yourdomain.com/api/auth/google/callback`
  - → then **Manual Deploy** to apply.
- **Vercel → Environment:**
  - `VITE_API_URL` = `https://api.yourdomain.com`
  - `API_ORIGIN` = `https://api.yourdomain.com` (edge middleware — no `/api`, not `VITE_`-prefixed; must be a **live** origin, see ⚠️ above)
  - `VITE_PUBLIC_SITE_URL` = `https://yourdomain.com` (canonical/OG base; defaults to `https://bookasloth.com`)
  - → **Redeploy** (Deployments → ⋯ → Redeploy).
  - **Dynamic sitemap:** `client/vercel.json` proxies `/sitemap*.xml` → the API origin
    (hardcoded `book-a-sloth.onrender.com`). Keep that destination in sync with the
    `API_ORIGIN` env above so the apex sitemap + edge 301 hit the same API.

### D. Update third-party allow-lists
- **Google Cloud Console** → OAuth client → Authorized redirect URIs → add
  `https://api.yourdomain.com/api/auth/google/callback`.
- **Razorpay dashboard** → Webhooks → set URL to
  `https://api.yourdomain.com/api/payment/webhook` (use your `RAZORPAY_WEBHOOK_SECRET`).
- **Supabase** → Auth → URL Configuration → Site URL = `https://yourdomain.com`.
- **PostHog** → Project Settings → **Authorized Domains** → add `https://yourdomain.com`
  and `https://www.yourdomain.com` (concrete URLs only, no wildcards). Drives Web
  Analytics breakdowns + toolbar; not a security gate (events still ingest regardless).

**Verify:**
```bash
curl https://api.yourdomain.com/health      # {"status":"ok",...}
```
Open `https://yourdomain.com` → padlock (HTTPS) present → do a full test booking
end-to-end (login, book, pay with a Razorpay test card).

---

## Phase 5 — Monitoring & alerts

### UptimeRobot (is the site up?)
- Add monitor → **HTTPS** → `https://api.yourdomain.com/health` → interval 5 min.
- Add monitor → **HTTPS** → `https://yourdomain.com` → interval 5 min.
- Alert contact → your email (and/or phone).

### Sentry (did the code error?)
- Create two projects: **Node** (backend) and **React** (frontend).
- Sentry gives an install snippet + a `DSN` for each. Wiring Sentry into the code
  is a small code change — **ask Claude to do this as a separate task** ("add
  Sentry to client and server"). It's not in the scaffolding yet.

**Verify:** UptimeRobot shows both monitors green. Trigger a test error and see it
land in Sentry.

---

## Phase 6 — Backups & security sweep

### Database backups
- **Supabase Free** keeps limited automatic backups but **no point-in-time
  restore**. For a booking app holding customer + payment data, add your own
  daily dump. Two options:
  - **Cheapest:** upgrade Supabase to Pro ($25/mo) → daily backups + PITR. Best
    safety, costs money.
  - **$0:** a GitHub Actions scheduled `pg_dump` to an artifact / cheap bucket.
    Ask Claude to add this workflow when you're ready.
- **Always test a restore** at least once — an untested backup is not a backup.

### Security sweep (ask Claude to run)
- Confirm no secrets in git history.
- `npm audit` on client + server, patch high/critical.
- Verify CORS locked to your domain, rate limits active, Razorpay webhook
  signature verified, helmet on (already in code — confirm in prod).

---

## Phase 7 — Landing pages & paid ads

Conversion landing pages for paid traffic live at `/lp/<slug>` — own header/footer,
no site nav, one goal (start a signup). Currently live:
- `https://bookasloth.com/lp/topmate-vs-bookasloth` — "0% commission" angle (vs Topmate)
- `https://bookasloth.com/lp/calendly-alternative` — "get paid in ₹" angle (vs Calendly)

**What you do:**

1. **Analytics env vars** — confirm the three from Phase 3 (`VITE_FB_PIXEL_ID`,
   `VITE_GA4_MEASUREMENT_ID`, `VITE_CLARITY_PROJECT_ID`) are set in Vercel.
   Without them the LP's Meta **`Lead`** event never fires and you can't measure
   ad ROI.

2. **Point each ad at the LP with UTM tags** so you see which ad converts, e.g.:
   `https://bookasloth.com/lp/topmate-vs-bookasloth?utm_source=meta&utm_medium=cpc&utm_campaign=topmate_switch`
   The page captures these first-touch, attaches them to every event, and carries
   them into the signup flow.

3. **Meta Events Manager** → set **`Lead`** as the campaign's conversion /
   optimization event. The LP fires a standard `Lead` on email submit (browser
   Pixel + server CAPI de-dupe on `event_id`).

4. **Trademark caution.** You may *bid* on competitor keywords (Topmate, Calendly),
   but do **not** put their trademark in the **visible Google Ads copy** — it risks
   disapproval. Comparative claims on your own LP are fine when truthful; the
   price/commission figures are date-stamped "Jun 2026" — re-screenshot the source
   if you ever need to defend a claim.

5. **Social / ad-preview image (OG).** A 1200×630 card already ships at
   `client/public/og-image.png`, wired site-wide as `https://bookasloth.com/og-image.png`.
   To use your own design, **replace that file with the same name** — no code
   change needed. Drop any extra images in `client/public/` and reference them as
   `https://bookasloth.com/<filename>`.
   > This is **one shared card for the whole site** (LPs included). Per-LP unique
   > cards are **not** possible on this SPA without prerendering — social scrapers
   > (Facebook/WhatsApp/LinkedIn) don't run JavaScript, so they only read the
   > static tags in `index.html`. Ask Claude to add per-LP prerender if you want
   > distinct cards per page later.

**Verify:**
- `https://bookasloth.com/lp/topmate-vs-bookasloth` loads with **no site navbar**.
- Paste that URL into the **Meta Sharing Debugger** (and a WhatsApp chat) → the OG
  image + title render.
- Accept the consent banner → DevTools **Network** shows `facebook.net`,
  `googletagmanager`, `clarity.ms` loading; submit the email → a `Lead` fires.

---

## Routine operations

### Deploy a change
The full **local → staging → production** flow (with the online staging test URL
and per-stage rollback) lives in **[docs/release-pipeline.md](docs/release-pipeline.md)**.
Short version:
```bash
git checkout main && git pull
git checkout -b feat/whatever
# ...make changes, test locally...
git commit -am "feat: whatever"
git push -u origin feat/whatever
# PR feat/whatever → staging  → test on https://staging.bookasloth.com
# PR staging        → main     → Render + Vercel auto-deploy to bookasloth.com
node scripts/release.mjs v1.2.0   # tag the release once prod is verified
```

### Node / npm version (avoid lockfile drift)
The client is **pinned to Node 22.x** (`client/package.json` `engines.node` +
`client/.nvmrc`). Node 22 bundles **npm 10** — the same npm Vercel uses — so the
committed `client/package-lock.json` resolves identically locally and on deploy.

- **Locally:** run `nvm use` (reads `.nvmrc` → Node 22) before `npm install` in
  `client/`. If you're on a newer Node (e.g. 24 → npm 11) and must install,
  use `npx npm@10 install` so you don't rewrite the lockfile with npm 11's
  resolution.
- **Never commit a lockfile regenerated by npm 11.** A `client/package-lock.json`
  produced by a different npm major can make Vercel's `npm ci` fail on deploy.
- Quick drift check (writes nothing to `node_modules`):
  `cd client && npx npm@10 install --package-lock-only` then
  `git diff client/package-lock.json` — a non-empty diff means drift.

### Rollback (something broke in prod)
- **Frontend:** Vercel → Deployments → pick the last good one → **Promote to
  Production**. Instant.
- **Backend:** Render → service → **Events/Deploys** → pick last good deploy →
  **Rollback** (or `git revert` the bad commit and push).
- **Database migration gone wrong:** restore from the latest backup (Phase 6).
  Never run destructive SQL in prod without a fresh backup first.

### Where to look when something's wrong
1. UptimeRobot email — is it down or just slow?
2. Render → **Logs** (live backend logs, including the `[perf:SLOW]` lines).
3. Sentry — the actual stack trace.
4. Vercel → Deployment → **Logs** for frontend build/runtime issues.

---

## Cost summary

| Item | Monthly |
|---|---|
| Render Starter (backend) | $7 |
| Vercel (frontend) | $0 |
| UptimeRobot | $0 |
| Sentry | $0 |
| Supabase (free tier) | $0 (Pro $25 if you want managed backups) |
| **Total** | **~$7/mo** |

---

## Scaling up — when you outgrow one server

A load test (PR #59, see `BENCHMARK_REPORT.md` / `FINAL_VERDICT.md`) measured what the
current **single** backend server can handle:

- **Comfortable & snappy:** ~a few hundred real people using the site at the same moment.
- **Still works, just slower:** up to ~500 hammering test-users — **zero errors, no crashes**,
  but pages take a few seconds.
- **Per day:** tens of thousands of visitors are fine — the limit is how many pile in *at the
  same few seconds* (a viral spike), not the daily total.
- The wall is one CPU core (~160–175 requests/second). The failure mode at scale is
  **slowness, not downtime.**

### To go bigger (thousands at once): add more server copies — no app rewrite needed
The path is **horizontal scaling**: run several copies of the backend behind Render's load
balancer instead of one. Roughly, **2 copies ≈ 2× the crowd, 3 copies ≈ 3×**, and so on.

- **Render:** upgrade off Starter to a plan that allows multiple instances / autoscaling, then
  raise the instance count. No code rewrite.
- **⚠️ Do this one thing first:** the per-IP rate limiter currently lives in each server's
  memory, so with multiple copies the limits count *per copy* (3 copies = 3× the intended
  limit, weakening abuse protection). Move it to a **shared store (Redis)** before scaling out.
  Small change, not a rewrite — ask Claude ("move express-rate-limit to a Redis store").
- **Then watch the database:** once the app side is multiplied, Supabase becomes the next
  limit. Turn on the **transaction pooler** and size up Supabase compute (Pro) when its
  connection/CPU graphs climb under load.

For the full ranked list (with the biggest single win — local JWT verification, which shaves
~175 ms off every logged-in request) see `OPTIMIZATION_REPORT.md` and `FINAL_VERDICT.md`.

> **In short:** today's one-server setup is fine for a normal launch. When a real spike or
> steady growth pushes you past a few hundred simultaneous users, add server copies (after the
> Redis limiter fix) — the app code does not need rewriting.
