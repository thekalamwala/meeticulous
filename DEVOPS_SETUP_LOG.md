# DevOps Setup Log — Book A Sloth

**Date:** 2026-06-13
**Phase completed:** Phase 0 (scaffolding + local verification + CI green, merged to `main`)
**Status:** Ready for Phase 1 (account creation) — see [DEPLOYMENT.md](DEPLOYMENT.md) for the forward runbook.

This file is the **backward-looking record** of what was done and why.
[DEPLOYMENT.md](DEPLOYMENT.md) is the **forward-looking runbook** for the remaining phases.

---

## 1. Decisions made

| Topic | Decision | Reasoning |
|---|---|---|
| Frontend host | **Vercel** (free) | Static Vite SPA, auto-HTTPS, auto-deploy, $0 |
| Backend host | **Render Starter ($7/mo, always-on)** | Backend runs in-process cron workers (reminders, email queue, campaigns). Free tier sleeps → crons die. Always-on required. |
| Database | **Supabase** (already managed) | No server to run; daily backups available on Pro |
| Domain registrar | **Hostinger** (DNS only) | Sites live on Vercel/Render; Hostinger just points DNS |
| Monitoring | **UptimeRobot** (free) + **Sentry** (free) | Down-alerts + error tracking |
| Region | **Singapore** (Render) | Lowest latency for India-based users |
| Target cost | **~$7/mo** | Render is the only paid line |

**Critical constraint:** the backend runs background workers via `setInterval` **inside the web process** (reminders 5min, OTP cleanup 1hr, email queue 60s, campaign worker 60s). This means:
- Must stay **always-on** (no spin-down) → Render Starter, not free.
- Must run **exactly one instance** (no horizontal scaling) or crons double-fire.

---

## 2. Architecture

```
                    yourdomain.com
                          │
              ┌───────────┴────────────┐
         (apex + www)            api.yourdomain.com
              │                          │
        ┌─────▼─────┐            ┌───────▼────────┐
        │  Vercel    │ ──API──▶  │  Render (Node) │
        │ React/Vite │           │ Express + crons │
        │  (free)    │           │  Starter $7/mo  │
        └────────────┘           └───────┬─────────┘
                                          │
          Supabase · SMTP · Cloudinary · Razorpay  (all managed)
                                          ▲
                                  UptimeRobot (free)  → pings /health
   git push main → GitHub Actions (CI) → Render & Vercel auto-deploy
   Sentry (free) = error tracking   |   daily Supabase backup (Phase 6)
```

---

## 3. What was built (Phase 0)

All committed to `main` via PR #3 (squashed → `fc4487a`).

| File | Purpose |
|---|---|
| `server/server.js` | Added `GET /health` (returns `{status, uptime, ts}`). Mounted outside `/api` so it bypasses the rate limiter and maintenance-mode 503s; does **not** touch the DB (so a slow Supabase round-trip can't flap the health check). |
| `render.yaml` | Render blueprint: node runtime, `rootDir: server`, Singapore region, Starter plan, `healthCheckPath: /health`, `autoDeploy: true`, all secrets as `sync:false` (set in dashboard, never in git). |
| `client/vercel.json` | SPA fallback rewrite (deep links work on refresh) + security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy). |
| `.github/workflows/ci.yml` | On push/PR to `main`: **client** = `npm install` → build → test; **server** = `npm ci` → unit tests (integration tests excluded — they need live Supabase/SMTP creds). |
| `server/.env.example` | Full server env var template (all keys, grouped, with comments). |
| `client/.env.example` | Full client env var template (only `VITE_` publishable keys). |
| `DEPLOYMENT.md` | Plain-English deploy runbook, phases 0–6. |

---

## 4. Local verification results

| Check | Result |
|---|---|
| Backend boots (`npm run dev`) | ✅ `Server running on port 5000` |
| `GET /health` | ✅ `{"status":"ok",...}` |
| Frontend (`vite` :5173) | ✅ loads, **0 console errors, 0 failed network requests** |
| Public API `/api/plans`, `/api/categories` | ✅ 200 (after maintenance flag flipped off) |
| Production build (`vite build`) | ✅ exit 0, 2345 modules, ~9.5s |

---

## 5. Bugs found & fixed (caught before they hit production)

### 5.1 `.env.example` templates were gitignored
- **Cause:** `.env.*` rule in `server/.gitignore` and `client/.gitignore` also matched `.env.example`.
- **Fix:** added `!.env.example` negation. Verified real `.env` files **still ignored** (secrets safe).

### 5.2 Stale `client/package-lock.json`
- **Cause:** `package.json` was bumped to `vitest ^4.1.8` but the lockfile was never regenerated. Hidden locally because `node_modules` was already populated; surfaced on any clean `npm ci` (CI + Vercel).
- **Symptom:** `npm error ... Missing: esbuild@0.28.1 from lock file`.

### 5.3 npm version drift (local npm 11 vs CI/Vercel npm 10)
- **Cause:** local machine = node 24 / npm 11; CI (node 20) + Vercel = npm 10. They resolve the dep tree differently (npm 11 dedupes esbuild to one tree; npm 10 keeps two: 0.21.5 under vite, 0.28.1 under vitest 4). An npm-11 lockfile fails `npm ci` under npm 10.
- **Fix:** regenerate the client lockfile with `npx -y npm@10 ...` to match the deploy toolchain.

### 5.4 rollup optional-deps bug (npm/cli#4828) — the hard one
- **Symptom:** `Cannot find module @rollup/rollup-linux-x64-gnu` → `vite build` crash on Linux CI.
- **Cause:** regenerating the lockfile with `npm install --package-lock-only` does **not** probe optional dependencies, so the rollup/esbuild platform binaries were mis-recorded; Linux installs skipped the Linux binary.
- **Fix:** full clean `npx -y npm@10 install` (real install, not `--package-lock-only`) → optional-dep metadata recorded correctly. CI client job also switched from `npm ci` to `npm install` to mirror how Vercel installs on deploy.

> **Lesson for future lockfile regens:** always use a *real* `npm@10 install` on the client, never `--package-lock-only`. (Saved to project memory.)

---

## 6. Maintenance mode note

- `platform_settings.maintenance_mode` was **`true`** (set deliberately 2026-06-13 03:57 UTC) → all `/api/*` returned 503 (admin routes stay reachable by design).
- Flipped to **`false`** at user's request to test the live API. **The live public API is now open.** Toggle it from the admin Settings page (or `platform_settings` table) when needed.

---

## 7. CI / git state

- PR [#3](https://github.com/bookasloth/book-a-sloth/pull/3) — squash-merged to `main` (`fc4487a`), branch deleted.
- CI: **green** (server unit tests + client build/test).
- Outstanding non-blocking warning: `actions/checkout@v4` / `actions/setup-node@v4` run on Node 20, deprecated — GitHub forces Node 24 from **2026-06-16**. Bump action versions before then (low effort).

---

## 8. What's next

| Phase | Owner | Summary |
|---|---|---|
| **1. Accounts** | **You** | Create Render, Vercel, UptimeRobot, Sentry (all free signups via GitHub). |
| 2. Backend deploy | You + me | Generate prod secrets, connect Render to repo via `render.yaml`, paste env vars. |
| 3. Frontend deploy | You + me | Import repo to Vercel, root dir `client`, set `VITE_` env vars. |
| 4. Domain (DNS) | You + me | Hostinger: A `@`→Vercel, CNAME `www`→Vercel, CNAME `api`→Render. Update Google/Razorpay/Supabase URLs. |
| 5. Monitoring | You + me | UptimeRobot monitors + wire Sentry into code (small code task). |
| 6. Backups + security | me | Daily Supabase dump (GitHub Action) + `npm audit` sweep. |

**Decision deferred to Phase 2:** whether to reuse existing local `.env` secrets on Render or generate fresh ones (we'll inspect `.env` together).

Full clickable steps for each phase: **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## 9. Cost summary

| Item | Monthly |
|---|---|
| Render Starter (backend) | $7 |
| Vercel · UptimeRobot · Sentry · Supabase (free tiers) | $0 |
| **Total** | **~$7/mo** (Supabase Pro +$25 only if you want managed PITR backups) |

---

## 10. Useful commands (reference)

```bash
# Local dev
cd server && npm run dev      # backend :5000
cd client && npm run dev      # frontend :5173

# Verify health locally
curl http://localhost:5000/health

# Regenerate client lockfile correctly (npm 10, real install — NOT --package-lock-only)
cd client && rm -rf node_modules package-lock.json && npx -y npm@10 install

# Production build (what Vercel runs)
cd client && npm run build
```
