# Meeticulous — Deployment Runbook

Plain-English guide to taking Meeticulous from your laptop to a live, secure,
production deployment. The topology is the proven Meeticulous one:

```
                 ┌──────────────┐   push main    ┌─────────────────────┐
  you ──git──►   │  GitHub repo │ ──────────────► │ GitHub Actions       │
                 │ thekalamwala │                 │  • ci.yml (tests)    │
                 │ /meeticulous │                 │  • deploy-vercel.yml │
                 └──────┬───────┘                 └─────────┬───────────┘
                        │ Blueprint (render.yaml)            │ vercel deploy --prod
                        ▼                                    ▼
             ┌─────────────────────┐              ┌──────────────────────┐
             │ Render               │              │ Vercel (frontend)    │
             │ • meeticulous-api    │◄──API calls──│ root=client, Vite    │
             │   (starter, main)    │              │ git-integration OFF  │
             │ • meeticulous-api-   │              │ (deploys via Action) │
             │   staging (free)     │              └──────────────────────┘
             │ • meeticulous-client-│
             │   staging (static)   │
             └──────────┬───────────┘
                        │ service-role
                        ▼
             ┌─────────────────────┐
             │ Supabase             │
             │ • PROD  spquowzref…  │   (eu-west-2, already seeded)
             │ • STAGING  (CREATE   │   ⚠️ does not exist yet
             │   THIS FIRST)        │
             └─────────────────────┘
```

**Who does what:** every file in this repo is already written. The steps below
are the dashboard clicks, DNS records, and third-party allow-list entries that
only you can do — Claude cannot log into Vercel/Render/Supabase/your registrar.
Work top to bottom.

---

## Key facts for this project

| Thing | Value |
|---|---|
| GitHub repo | `thekalamwala/meeticulous` (private) |
| Primary domain | `meeticulous.com` (apex + `www`) |
| API subdomain | `api.meeticulous.com` → Render |
| Asset domain | `meeticulous.in` (images/assets only; no redirect) |
| Render region | `singapore` |
| Node version | `22.x` (pinned in `render.yaml`, both workflows, and `package.json` engines) |
| Supabase PROD | project `spquowzrefozmrzoszkf` (eu-west-2) — schema + config cloned and seeded |
| Supabase STAGING | **does not exist yet — create it in Phase 2 before the staging services boot** |
| Prod backend | Render `meeticulous-api` (`starter`, always-on, branch `main`) |
| Staging backend | Render `meeticulous-api-staging` (`free`, branch `staging`) |
| Staging frontend | Render `meeticulous-client-staging` (static, branch `staging`) |
| Payment webhook | `POST https://api.meeticulous.com/api/payment/webhook` |
| Google OAuth callback | `https://api.meeticulous.com/api/auth/google/callback` |
| Health check | `GET /health` → `{ ok: true }` |

Integrations in use: **Supabase, Razorpay, SMTP email, Brevo (HTTP bulk email),
Google Calendar OAuth, Sentry, PostHog.** Everything else in `server/.env.example`
(GA4/Meta CAPI server fan-out, Resend, GSC, AiSensy, Redis, rate-limit store,
pitch-deck, bot flags, CRM governor) is **off by default** — leave blank until
you deliberately turn it on.

---

## Phase 1 — Accounts

1. **GitHub** — repo already exists: `thekalamwala/meeticulous`.
2. **Vercel** — sign up (or use your team). You'll import the repo in Phase 3.
3. **Render** — sign up, connect your GitHub so Render can read the repo.
4. **Supabase** — PROD project `spquowzrefozmrzoszkf` already exists. You'll
   create the **staging** project in Phase 2.

---

## Phase 2 — Backend (Render) + staging Supabase

### 2a. Create the STAGING Supabase project (do this first)
The two staging Render services cannot boot without it, and you must never point
staging at the prod database.

1. Supabase → **New project** → name `meeticulous-staging`, region `eu-west-2`
   (match prod) or `ap-south-1` if you prefer Mumbai latency. Save the DB password.
2. Apply the same schema + seed as prod. Easiest: clone prod's schema into
   staging (the repo's `scripts/init-prod-db.sh` / migration files, or a
   `pg_dump --schema-only` of prod restored into staging). Migrations live in
   `server/migrations/` — apply all to staging.
3. Note the staging **Project URL**, **anon key**, **service-role key**, and
   **JWT secret** (Project Settings → API). You'll paste these in 2c.

> If you're not ready to run staging yet, you can skip 2a and suspend the two
> `*-staging` services after the Blueprint applies. Prod does not depend on them.

### 2b. Generate fresh app secrets (never reuse prod BAS secrets)
Run locally and keep the output in your password manager:

```bash
openssl rand -hex 32   # SUPER_ADMIN_JWT_SECRET
openssl rand -hex 32   # OAUTH_STATE_SECRET
openssl rand -hex 32   # GOOGLE_TOKEN_KEY  (must be exactly 64 hex chars = 32 bytes)
```

`GOOGLE_TOKEN_KEY` **must** be exactly 32 bytes (64 hex chars) or Google token
encryption throws at boot.

### 2c. Create the Render Blueprint
1. Render dashboard → **New → Blueprint** → pick `thekalamwala/meeticulous`.
   Render reads `render.yaml` and proposes three services:
   `meeticulous-api`, `meeticulous-api-staging`, `meeticulous-client-staging`.
2. Click **Apply**. If the static-site fields on `meeticulous-client-staging`
   error (Render's static schema changes occasionally), adjust
   `runtime/staticPublishPath/routes` and re-apply.
3. For **`meeticulous-api`** → Environment, set every `sync:false` var with its
   **production** value:
   - `CLIENT_URL` = `https://meeticulous.com` (use the Render/Vercel URL until DNS is live — see Phase 4)
   - `API_URL` = your Render URL (e.g. `https://meeticulous-api.onrender.com`)
   - `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_JWT_SECRET` → **prod** project `spquowzrefozmrzoszkf`
   - `SUPER_ADMIN_JWT_SECRET` / `OAUTH_STATE_SECRET` / `GOOGLE_TOKEN_KEY` → the values from 2b
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` → see Phase 4b
     (`GOOGLE_REDIRECT_URI` = `https://api.meeticulous.com/api/auth/google/callback`)
   - `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` → Razorpay **live** keys
   - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` → your transactional SMTP
   - `BREVO_API_KEY` / `BREVO_FROM` → Brevo v3 key + an authenticated sender (e.g. `team@meeticulous.com`)
   - `SENTRY_DSN` → your Sentry project DSN (blank = disabled)
   - `POSTHOG_PROJECT_TOKEN` → PostHog project token (`POSTHOG_HOST` is inline already)
   - `ADMIN_ALERT_EMAIL` / `SUPER_ADMIN_EMAIL` → your addresses
4. For **`meeticulous-api-staging`** → set the same keys but with **staging**
   values: staging Supabase (2a), Razorpay **TEST** keys, staging URLs,
   `GOOGLE_REDIRECT_URI` = staging callback.
5. For **`meeticulous-client-staging`** → set `VITE_SUPABASE_URL` +
   `VITE_SUPABASE_ANON_KEY` to the **staging** Supabase project.
6. Create the `staging` git branch so the two staging services have something to
   deploy from:
   ```bash
   git switch -c staging main && git push -u origin staging
   ```
7. Verify prod health once `meeticulous-api` is live:
   ```bash
   curl https://meeticulous-api.onrender.com/health
   # → {"ok":true,...}
   ```

---

## Phase 3 — Frontend (Vercel)

1. Vercel → **Add New → Project** → import `thekalamwala/meeticulous`.
   - **Root Directory** = `client`
   - **Framework Preset** = Vite (auto-detected)
   - Build command / output are driven by `client/vercel.json` and
     `package.json` (`vercel-build` runs tests → build → prerender). Leave defaults.
2. Project **Settings → Environment Variables** — add the `VITE_*` vars from
   `client/.env.example` for **Production** (and **Preview**):
   - `VITE_API_URL` = `https://api.meeticulous.com` (use the Render URL until DNS is live)
   - `API_ORIGIN` = `https://meeticulous-api.onrender.com` (the **live** Render URL — the edge-middleware runtime var; must be reachable, not a not-yet-live `api.*`)
   - `VITE_PUBLIC_SITE_URL` = `https://meeticulous.com`
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` → **prod** Supabase (publishable anon key only)
   - `VITE_POSTHOG_PROJECT_TOKEN` (+ `VITE_POSTHOG_HOST` = `https://us.i.posthog.com`)
   - Marketing IDs (`VITE_GA4_MEASUREMENT_ID`, `VITE_FB_PIXEL_ID`, `VITE_CLARITY_PROJECT_ID`, `VITE_GTM_CONTAINER_ID`) — optional, leave blank to disable.
3. **Confirm git integration is OFF for production.** `client/vercel.json` sets
   `git.deploymentEnabled: false`, so Vercel will NOT auto-deploy prod — the
   GitHub Action does. PR **previews** stay on. (This also sidesteps the Hobby-team
   "commit author lacks contributing access" block.)
4. Wire the deploy Action:
   - Grab **Org/Team ID** (Team/Account Settings → General) and **Project ID**
     (Project → Settings → General).
   - Edit `.github/workflows/deploy-vercel.yml` → replace
     `REPLACE_WITH_VERCEL_ORG_ID` and `REPLACE_WITH_VERCEL_PROJECT_ID` with the
     real IDs (IDs are **not** secrets — they're committed). Commit + push.
   - Create a Vercel token (Vercel → Account Settings → Tokens) and add it as a
     **GitHub repo secret**: `Settings → Secrets and variables → Actions →
     New repository secret → VERCEL_TOKEN`.
5. Push to `main` (or run the workflow from the **Actions** tab). The Action
   runs `vercel deploy --prod` as a **remote** build (so Vercel's Sensitive env
   vars bake in — never `vercel build --prebuilt` in CI, that white-screens).

> **If the Vercel build fails on blog-OG prerender:** the `blog-og` card job in
> `deploy-vercel.yml` is disabled (`if: false`) for Meeticulous. If the remote
> `vercel-build` prerender hard-fails because a published blog post has no OG
> card, either seed OG cards for those posts or relax the prerender OG guard.

> Optional GitHub secrets `PROD_SUPABASE_URL` / `PROD_SUPABASE_SERVICE_ROLE_KEY`
> are only needed if you later re-enable the `blog-og` job — skip for now.

---

## Phase 4 — Point the domain (DNS at your registrar)

Add these records (TTL 3600 is fine). Use the exact targets Vercel/Render show
you in their dashboards — the ones below are the usual defaults.

| Type | Host | Value | For |
|---|---|---|---|
| A | `@` (apex `meeticulous.com`) | `76.76.21.21` (or the IP Vercel shows) | Vercel frontend |
| CNAME | `www` | `cname.vercel-dns.com` | Vercel (www → apex 308 via `vercel.json`) |
| CNAME | `api` | `meeticulous-api.onrender.com` (your Render target) | Render backend |

- In **Vercel → Project → Settings → Domains**, add `meeticulous.com` and
  `www.meeticulous.com`; Vercel verifies the records.
- In **Render → meeticulous-api → Settings → Custom Domains**, add
  `api.meeticulous.com`; Render issues the TLS cert.
- `meeticulous.in` (assets): point however your asset host needs. No app
  redirect is configured for it; the CSP already allows images over `https:`.

Once DNS resolves, update these to the **real** domains and redeploy:
- Render `meeticulous-api`: `CLIENT_URL=https://meeticulous.com`,
  `API_URL=https://api.meeticulous.com`,
  `GOOGLE_REDIRECT_URI=https://api.meeticulous.com/api/auth/google/callback`
- Vercel: `VITE_API_URL=https://api.meeticulous.com`,
  `API_ORIGIN=https://api.meeticulous.com`, `VITE_PUBLIC_SITE_URL=https://meeticulous.com`
  (the sitemap rewrite + CSP in `vercel.json` already point at
  `meeticulous-api.onrender.com` and `api.meeticulous.com`).

---

## Phase 4b — Third-party allow-lists (do after DNS is live)

Each of these must know the real domains or auth/webhooks fail:

1. **Razorpay webhook** — Razorpay Dashboard → Settings → Webhooks → add
   `https://api.meeticulous.com/api/payment/webhook`, subscribe to
   `payment.captured` (and refunds as needed), set a signing secret, and put that
   same secret in Render as `RAZORPAY_WEBHOOK_SECRET` (server verifies the
   signature). Repeat with the **staging** URL + a TEST webhook for staging.
2. **Google OAuth** — Google Cloud Console → APIs & Services → Credentials →
   your OAuth client → **Authorized redirect URIs**, add:
   - `https://api.meeticulous.com/api/auth/google/callback` (prod)
   - the staging callback (`https://meeticulous-api-staging.onrender.com/api/auth/google/callback`)
   Also add the domains under **Authorized JavaScript origins** if your flow needs it.
3. **Supabase Auth redirect URLs** — Supabase (prod project) → Authentication →
   URL Configuration: **Site URL** = `https://meeticulous.com`; add redirect URLs
   for `https://meeticulous.com/**`, `https://www.meeticulous.com/**`, and your
   Vercel preview pattern (`https://*.vercel.app/**`). Mirror on the staging project.
4. **Server CORS** — driven by `CLIENT_URL` (+ optional `CLIENT_URLS` for extra
   origins like the Vercel alias). The www/apex sibling of each origin is
   auto-allowed, so usually `CLIENT_URL=https://meeticulous.com` is enough. Add
   the Vercel `*.vercel.app` alias to `CLIENT_URLS` if you hit it directly.

---

## Phase 5 — Monitoring

1. **Uptime** — add an uptime check (UptimeRobot/BetterStack/etc.) hitting
   `https://api.meeticulous.com/health` every 1–5 min.
2. **Sentry** — set `SENTRY_DSN` on both Render services (blank = disabled).
   5xx responses + uncaught exceptions/rejections report automatically.
3. **Alerts** — point Sentry + uptime alerts at `ADMIN_ALERT_EMAIL`.
4. **PostHog** — product analytics is live once `VITE_POSTHOG_PROJECT_TOKEN`
   (client) and `POSTHOG_PROJECT_TOKEN` (server) are set.

---

## Phase 6 — Backups + secret-leak sweep

1. **DB backups** — the repo already ships `.github/workflows/backup.yml`
   (nightly encrypted `pg_dump`, self-skips until configured). Enable it by adding
   two GitHub repo secrets:
   - `BACKUP_DATABASE_URL` — prod Supabase → Settings → Database → Connection
     string (Session mode, port 5432).
   - `BACKUP_PASSPHRASE` — a long random string (AES256 passphrase). **Store it in
     your password manager** — without it the dump can't be restored.
   Test a restore into the **staging** project monthly (never test-restore on prod).
   Longer-term, upgrade prod Supabase to Pro for point-in-time recovery.
2. **Secret-leak sweep** — before going public, scan the repo + history:
   ```bash
   git log -p | grep -iE 'service_role|sk_live|rzp_live|BEGIN (RSA|EC) PRIVATE KEY'
   # or: gitleaks detect --source . --redact
   ```
   All real secrets must live only in the Render/Vercel dashboards and GitHub
   Actions secrets — never in git. `.env.example` files hold names with empty
   values only.

---

## CI / release flow (reference)

- **`ci.yml`** — on push + PR to `main` (and `release/**`): path-filtered server
  and client **unit tests**. A docs-only change runs neither; a server-only change
  skips the client job. CI is **not** the deploy gate — each deploy owns its checks.
- **`deploy-vercel.yml`** — on push to `main` touching `client/**`: remote
  `vercel deploy --prod`. The `vercel-build` step runs `vitest → vite build →
  prerender`, so a red test or bad build fails the deploy.
- **Render** — `buildCommand: npm ci && npm run test:unit` gates the server
  deploy (unit tests only; integration tests hit live DB/SMTP and are a side
  effect, never a build gate).
- **Release path:** feature branch → PR to `staging` → test on the staging
  services → PR `staging` → `main` → Render + Vercel auto-deploy to prod.

### Inert workflows (present, do nothing until configured)
`backup.yml` (Phase 6), `performance.yml` (JMeter load test — soft-skips without
`TEST_SUPABASE_*`), `host-og-cards.yml` and `reseed-bot-kb.yml` (guarded to the
original repo — skip on this fork). None fail or deploy on their own; wire them up
only if you need them.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
