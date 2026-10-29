# Release Pipeline — local → staging → production

How a change travels from your laptop to `meeticulous.com` safely, and how to
roll back at **every** stage if it breaks. Written for someone doing this for the
first time. Companion to [DEPLOYMENT.md](../DEPLOYMENT.md) (that file does the
one-time prod setup; this file is the everyday flow + the staging layer).

> **First time? Initialize the production database first.** Prod runs on a fresh
> Mumbai Supabase project that needs its schema + config seeded from your current
> dev DB (one-time). Staging = your existing dev DB. Full sequence (incl. the
> `.env` role remap): **[init-prod-db.md](init-prod-db.md)**. Do that before the
> everyday loop below makes sense.

---

## 1. The mental model

Three environments. **The same git commit is promoted upward** — you never edit
code directly on a higher stage.

```
  STAGE 1: LOCAL                STAGE 2: STAGING               STAGE 3: PRODUCTION
  your laptop                   online "testing URL"          the real site
  ───────────────               ──────────────────            ──────────────────
  Vite  :5173                   Vercel (staging branch)       Vercel (production)
  Express :5000                 Render meeticulous-api-staging Render meeticulous-api
  staging Supabase  ─────────▶  staging Supabase  ─────────▶  PROD Supabase
  localhost                     staging.meeticulous.com        meeticulous.com

  push feature → PR             merge to `staging` branch     merge `staging`→`main`
                                → auto-deploys staging        → auto-deploys prod
```

Key facts:
- **Staging and local share the staging Supabase project** (separate from prod).
  Anything you do while testing — fake bookings, test payments — lives in staging
  data and never touches real customers.
- **Production is the only thing on the prod Supabase project.**
- Promotion is a git merge, not a re-upload. What you tested is byte-for-byte
  what goes live.

---

## 2. One-time staging setup (you click; ~20 min)

Do this once. Prod (Phases 1–4 in DEPLOYMENT.md) should exist first, or do them
together. You already have the separate **staging Supabase project** — good.

### A. Create the `staging` git branch
```bash
git checkout main && git pull
git checkout -b staging
git push -u origin staging
```
This branch is the trigger for the staging deploys below.

### B. Staging backend (Render)
`render.yaml` already defines **`meeticulous-api-staging`** (deploys from the
`staging` branch, `plan: free`). To create it:
1. Render → **Blueprint** → it now proposes *two* services. Apply.
2. Open **meeticulous-api-staging** → **Environment** → paste the STAGING values
   (see [§6 table](#6-staging-env-values-what-to-paste-in-the-staging-dashboards)).
3. **Manual Deploy** → verify: `curl https://meeticulous-api-staging.onrender.com/health`
   → `{"status":"ok",...}`.

> `plan: free` spins the service down after ~15 min idle; first hit after that is
> a ~30s cold start. Fine for testing. Reminder/email **crons won't fire while
> it's asleep** — test those by hand on staging.

### C. Staging frontend (Vercel)
Same Vercel project as prod, different branch → different URL:
1. Vercel project → **Settings → Domains** → add `staging.meeticulous.com`,
   assign it to the **`staging`** git branch (Vercel calls this a branch domain).
2. Vercel → **Settings → Environment Variables** → for the **Preview** scope (or
   the `staging` branch specifically) set the STAGING values from §6
   (`VITE_API_URL` → staging API, etc.).
3. In Hostinger DNS add: `CNAME  staging  cname.vercel-dns.com`.

### D. Tell the third parties about the staging URLs
- **Supabase (staging project)** → Auth → URL Configuration → Site URL =
  `https://staging.meeticulous.com`.
- **Google Cloud Console** → OAuth client → Authorized redirect URIs → add
  `https://meeticulous-api-staging.onrender.com/api/auth/google/callback`.
- **Razorpay** → use **TEST mode** for staging. Add a webhook →
  `https://meeticulous-api-staging.onrender.com/api/payment/webhook` with its own
  `RAZORPAY_WEBHOOK_SECRET`.

**Done when:** opening `https://staging.meeticulous.com` loads the app and a test
booking with a Razorpay test card completes end-to-end against staging data.

---

## 3. The everyday loop

### Stage 1 — Local
Point your laptop at the **staging** database first, so local test bookings never
touch real data (`scripts/use-env.js` copies `.env.staging` → `.env` for both
server + client; loud red warning if you switch to `production`):
```bash
node scripts/use-env.js              # show which DB is active right now
node scripts/use-env.js staging      # ← daily driver: laptop on staging DB
```
Then build:
```bash
git checkout main && git pull
git checkout -b feat/whatever        # never work on main directly
cd server && npm run dev             # :5000
cd client && npm run dev             # :5173
# ...build + test locally...
cd server && npm test                # and: cd client && npm test
git commit -am "feat: whatever"
git push -u origin feat/whatever
```

### Stage 2 — Staging (the online test)
Open a PR `feat/whatever → staging`. CI runs the test suite. Merge it.
→ Render staging + Vercel staging auto-deploy in ~1–2 min.
→ Test on **`https://staging.meeticulous.com`** like a real user: log in, book,
   pay with a **Razorpay test card**, check the email arrives.

> Several features can ride on `staging` at once. It's your shared rehearsal
> stage — only promote to prod what you've actually verified there.

### Stage 3 — Production
When staging looks good, open a PR `staging → main`. Merge it.
→ Render prod + Vercel prod auto-deploy → live on `meeticulous.com`.
**Immediately verify** (curl `/health`, load the site, one test booking), then
**tag the release** so rollback is one command:
```bash
git checkout main && git pull
node scripts/release.mjs            # see recent tags + suggested next version
node scripts/release.mjs v1.2.0     # tag + push
```

---

## 4. Rollback — per stage

Three of the four layers undo in roughly one click. **The database is the
exception** — read §5 before any schema change.

| What broke | How you roll back | Speed |
|---|---|---|
| **Frontend** (bad UI / build) | Vercel → Deployments → last-good → **Promote to Production** | seconds |
| **Backend** (API erroring) | Render → meeticulous-api → Events → last-good deploy → **Rollback** | ~1 min |
| **The code itself** | `git revert <bad-commit>` + push (auto-redeploys), or `git checkout v1.1.0` to inspect the last tagged-good release | minutes |
| **A whole release** | You tagged it (§3) → `git checkout v1.1.0`, branch from it, redeploy | minutes |
| **Database** ⚠️ | **No one-click undo.** Restore from backup / PITR — see §5 | slow + careful |

Staging has the same buttons — if a staging deploy breaks, you just fix forward;
nobody real is affected.

---

## 5. Database migrations — the one stage that does NOT auto-roll-back

Code is reversible; **applied SQL is not**. `git revert` brings back old code but
will not un-drop a column or un-delete rows. This is the highest-risk stage, so:

**The rules**
1. **Run every migration on the staging Supabase project first.** If it breaks
   staging, you learned for free.
2. **Backward-compatible migrations only.** Add columns nullable; don't drop or
   rename a column in the same release that stops using it — ship the code first,
   drop the column a release later. (The codebase already does this, e.g. the
   `commission_applied` fallback.) This is what lets you roll the *app* back
   without the DB fighting you.
3. **Back up prod before any prod migration.** Either the daily backup workflow
   (PR #79) or a manual `pg_dump`. An untested backup is not a backup — do one
   restore drill into a throwaway project once, so you trust it.
4. **PITR is the real safety net.** Supabase free tier has **no point-in-time
   restore**. Upgrading the prod project to **Pro ($25/mo)** gives daily backups
   + PITR — the difference between "restore to 3 minutes ago" and "hope the last
   dump is recent." Currently the biggest unprotected gap in this stack.

**The order for a prod schema change**
```
apply on staging  →  test staging  →  backup prod  →  apply on prod  →  deploy code  →  verify  →  tag
```
Never the reverse. If the prod migration goes wrong: stop, restore from the
backup/PITR — do not improvise destructive SQL on live data.

---

## 6. Staging env values — what to paste in the staging dashboards

The full key list is in `server/.env.example` / `client/.env.example`. Staging
uses the **same keys** as prod; only these **differ**. Everything not listed here
(SMTP, app secrets, etc.) can reuse the prod values.

**Render — meeticulous-api-staging → Environment**

| Key | Staging value |
|---|---|
| `NODE_ENV` | `production` (already set in render.yaml — mirrors prod behaviour) |
| `CLIENT_URL` | `https://staging.meeticulous.com` |
| `API_URL` | `https://meeticulous-api-staging.onrender.com` |
| `SUPABASE_URL` | your **staging** project URL |
| `SUPABASE_ANON_KEY` | staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | staging service-role key |
| `SUPABASE_JWT_SECRET` | staging JWT secret |
| `GOOGLE_REDIRECT_URI` | `https://meeticulous-api-staging.onrender.com/api/auth/google/callback` |
| `RAZORPAY_KEY_ID` / `_SECRET` | Razorpay **TEST**-mode keys |
| `RAZORPAY_WEBHOOK_SECRET` | the staging webhook's secret |

**Vercel — Preview / `staging` branch scope**

| Key | Staging value |
|---|---|
| `VITE_API_URL` | `https://meeticulous-api-staging.onrender.com` |
| `API_ORIGIN` | `https://meeticulous-api-staging.onrender.com` (no `/api`, not `VITE_`-prefixed) |
| `VITE_SUPABASE_URL` | your **staging** project URL |
| `VITE_SUPABASE_ANON_KEY` | staging anon key |

> Keep PostHog/GA4/Pixel/Clarity **blank or on a separate test project** for
> staging so test traffic doesn't pollute your real analytics/ad data.

---

## 7. Quick reference

```bash
# new work
git checkout main && git pull && git checkout -b feat/x

# promote to staging   → PR feat/x  → staging   (auto-deploys staging.meeticulous.com)
# promote to prod      → PR staging → main      (auto-deploys meeticulous.com)

# after prod is verified healthy:
node scripts/release.mjs v1.2.0          # tag the release

# rollback
#   frontend → Vercel: Promote previous deployment
#   backend  → Render: Rollback to previous deploy
#   code     → git revert <commit> && git push
#   db       → restore from backup / PITR (see §5)
```
