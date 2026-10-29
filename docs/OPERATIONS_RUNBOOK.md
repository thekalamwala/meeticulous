# Operations Runbook — Book A Sloth

> Single source of truth for running, deploying, and recovering this app in production.
> Written for **one developer**, optimized for **safety → simplicity → long-term maintainability** over speed.
> Keep this file current — when a procedure changes, change it here first.

**Last reviewed:** 2026-06-19

---

## How to use this document

- **Something is on fire?** Jump to [E. Rollback](#e-rollback-procedure) or [F. Disaster Recovery](#f-disaster-recovery-procedure).
- **Shipping a change?** Follow [A. Git](#a-git-workflow) → [D. Migrations](#d-database-migration-workflow) (if schema) → [B. Deploy](#b-deployment-workflow).
- **Routine upkeep?** [G. Maintenance Checklist](#g-maintenance-checklist).
- Companion docs: [`DEPLOYMENT.md`](../DEPLOYMENT.md) (infra runbook), [`docs/razorpay-webhook-setup.md`](razorpay-webhook-setup.md), [`docs/admin-2fa-runbook.md`](admin-2fa-runbook.md).

---

## Infrastructure at a glance

| Layer | Where | Tier | Notes |
|---|---|---|---|
| Client (React/Vite SPA) | Vercel | Free | Auto-deploys on push to `main`. `VITE_*` baked at build. |
| Server (Express API + crons) | Render | Starter $7/mo | Always-on (crons need it). Single instance. Region: Singapore. Node 22. |
| Database / Auth / Storage | Supabase | Free (→ Pro for PITR) | Postgres 17, Mumbai (ap-south). |
| Payments | Razorpay | Live + Test modes | Creds DB-backed (`platform_settings`, encrypted), env fallback. |
| DNS | Hostinger | — | apex/www → Vercel; `api.` → Render. |
| Email | SMTP (Hostinger) + queue | — | See `communicationEngine`. |

**Hard constraint:** the server runs 8 in-process `setInterval` cron jobs (reminders, auto-complete, OTP cleanup, email queue, campaigns, badges, ledger + subscription reconcilers) with **no inter-instance locking**. It **must run exactly one always-on instance**. Do not scale to 2+ web instances without first adding job locking (see [Scalability risk](#known-risks-current-state)) — duplicate instances will double-send emails/reminders/campaigns.

---

## Known risks (current state)

What's already mitigated vs. what still needs attention. Update as items close.

| Area | Status | Note |
|---|---|---|
| Crash visibility | ✅ Done | Global `uncaughtException` (exit→restart) + `unhandledRejection` (log) handlers in `server/server.js`. |
| Env fail-fast | ✅ Done | `server/config/validateEnv.js` throws in prod on missing critical vars. |
| Destructive cleanup script | ✅ Quarantined | Moved out of migrations to `server/scripts/sql/one-off/cleanup_accounts_MANUAL_ONLY.sql`. Never run via "apply all". |
| Migration tooling | ✅ Done | `server/scripts/migrate.js` + `npm run migrate:staging` / `migrate:prod`. See [D](#d-database-migration-workflow). |
| Schema dump leak | ✅ Done | `staging_schema.sql` / `*_schema.sql` gitignored. |
| Database backups | ⏳ In review | `.github/workflows/backup.yml` (PR) — **activate by adding repo secrets** (see [F](#f-disaster-recovery-procedure)). |
| Payment-webhook failure alert | ⏳ In review | Webhook now returns 500 → Razorpay retries; admin email alert on persistent failure (PR). |
| Point-in-time recovery | ❌ Open | Supabase free tier has no PITR. **Upgrade prod to Pro ($25/mo) when real payments flow.** |
| Staging environment | ⚠️ Partial | `migrate.js` supports a `staging` target; create a dedicated staging Supabase project and wire `.env.staging`. |
| CI as a deploy gate | ❌ Open | Render/Vercel auto-deploy on push regardless of CI. **Protect `main` + require the `CI` check** ([A](#a-git-workflow)). |
| Error tracking (Sentry/APM) | ❌ Open | No exception tracker; logs are ephemeral on Render. |
| Uptime monitoring | ❌ Open | Wire UptimeRobot to `https://<api>/health`. |
| Rate-limit store | ❌ Open | In-memory; resets each deploy, per-instance. Move to a shared store before scaling. |
| Node version | ⚠️ Minor | Runtime is Node 22 (Render + `server/package.json` engines); CI still runs Node 20. Align when convenient. |
| `service_role` key | ❌ Open | One was exposed historically — rotate. **Set `GOOGLE_TOKEN_KEY` first** (see [C](#c-supabase-workflow)), else stored Google tokens become undecryptable. |
| Secrets in CI | ⚠️ Note | `performance.yml` uses `TEST_SUPABASE_*`; ensure that secret points at staging, never prod. |

---

## First-time host setup (Vercel + Render)

One-time bootstrap to connect the repo to its two hosts. Do this once; after that, merges to `main` deploy automatically.

> **The #1 mistake to avoid: Root Directory.** The client lives in `client/`, not the repo root. A Vercel project pointed at the repo root (Root Directory empty/null) builds from a `package.json` that has no frontend and **fails** — that is exactly what caused the duplicate `book-a-sloth-j4zg` project's red checks. Use **one** Vercel project with Root Directory = `client`. Delete any stray duplicates.

### Client → Vercel

In the Vercel project → **Settings → Git → Import** `bookasloth/book-a-sloth`, then:

| Setting | Value | Why |
|---|---|---|
| **Root Directory** | **`client`** | Repo root has no frontend — must point at `client/`. |
| Framework Preset | Vite | auto-detected |
| Build Command | `vite build` (or `npm run build`) | |
| Output Directory | `dist` | Vite default |
| Install Command | `npm install` | **Not** `npm ci` — the rollup optional-dep bug (npm/cli#4828) breaks `npm ci` on the client. |
| Node version | 22 | matches `client/.nvmrc` + `engines`. |
| Production Branch | `main` | deploy on merge |

**Environment variables** (set for Production **and** Preview, *before* the first deploy — `VITE_*` are baked at build time, so changing one later needs a redeploy):

```
VITE_API_URL=https://<Render API URL>      # e.g. https://book-a-sloth.onrender.com → later https://api.yourdomain.com
API_ORIGIN=https://<same API base, NO /api>  # NOT VITE_-prefixed — edge-runtime var for username 301s (client/middleware.js). Missing → redirects fail open (old usernames 404 in-app).
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...                   # publishable anon key only — never a secret
VITE_POSTHOG_PROJECT_TOKEN=phc_...
VITE_POSTHOG_HOST=https://us.i.posthog.com
# Optional marketing (blank = that tool stays off):
VITE_GA4_MEASUREMENT_ID=
VITE_FB_PIXEL_ID=
VITE_CLARITY_PROJECT_ID=
```

- **No Razorpay key in client env** — the API serves `key_id` at payment time. Never put a secret behind `VITE_` (it ships to the browser).
- After import → **Deploy**, then run the [smoke test](#b-deployment-workflow).

### Server → Render

The server is provisioned from `render.yaml` (a Blueprint), so its build/start/health/env-keys are defined in-repo:

1. Render → **New → Blueprint** → connect `bookasloth/book-a-sloth`. It reads `render.yaml` and creates the `bookasloth-api` web service (Root Directory `server`, `npm ci` / `npm start`, health `/health`, region Singapore, Node 22, autoDeploy `main`).
2. Fill every `sync: false` secret in **Render → Environment** (Supabase, Razorpay, SMTP, Google, JWT/OAuth secrets, etc.). `NODE_ENV=production` is set by the blueprint — **verify it stuck** (it gates the payment-verify / OTP fail-safes).
3. Confirm `https://<service>/health` returns `200`.

### Wiring the two together

- Vercel `VITE_API_URL` / `API_ORIGIN` must point at the Render service URL (or `api.yourdomain.com` once DNS is set).
- Render `CLIENT_URL` must point at the Vercel URL (or `yourdomain.com`) — it locks CORS.
- Custom domain + DNS steps live in [`DEPLOYMENT.md`](../DEPLOYMENT.md).

---

## A. Git workflow

`main` is the production branch — Render and Vercel auto-deploy from it. Treat it as sacred.

1. **Protect `main`** (do this once, in GitHub → Settings → Branches → add rule for `main`):
   - Require a pull request before merging.
   - Require the **`CI`** status check to pass.
   - Block force-pushes and deletion.
   - This is the single highest-leverage change: it turns CI from decorative into a real gate, and since deploy follows merge, a red build can no longer ship.
2. **One branch per change**, typed: `feat/…`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`, `ci/…`.
3. **Never push to `main` directly.** Even solo, open a PR — the PR page is where you read your own diff and watch CI. Squash-merge to keep history linear.
4. **Tag each production release** after merge: `git tag -a v1.x.y -m "…" && git push --tags`. Tags are your rollback anchors ([E](#e-rollback-procedure)).
5. **Never `git add .` blindly.** Stage explicit paths. (`staging_schema.sql` and `*.dump` are gitignored, but the habit prevents accidents.)
6. Delete branches after merge.

---

## B. Deployment workflow

Goal: nothing reaches prod that didn't pass CI and a deliberate merge.

1. Branch → push → open PR → **CI must be green** → review your own diff → merge to `main`.
2. Merge triggers **Render (server)** and **Vercel (client)** auto-deploy.
3. **Sequencing with schema changes:** apply the migration to staging, verify, apply to prod, *then* deploy the code that depends on it ([D](#d-database-migration-workflow)). Never deploy code ahead of its migration.
4. **`VITE_*` changes require a rebuild**, not just a restart — they're baked at build time. After editing a client env var in Vercel, redeploy.
5. **Post-deploy smoke test** (every prod deploy, ~2 min):
   - `GET /health` returns `200`.
   - Homepage loads; log in.
   - One end-to-end booking in **Razorpay test mode**; confirm the booking row flips to `paid` and the confirmation email arrives.
6. Deploy during low-traffic windows. Keep `platform_settings.maintenance_mode` handy — set `true` to 503 public/vendor traffic during risky work, `false` after.

**Node version:** runtime is Node 22 (Render `NODE_VERSION=22`, `server/package.json` engines `22.x`). Keep CI and any local toolchain aligned. **Client lockfile must be regenerated with npm 10** (`npx npm@10 install`) — npm 11 produces a lockfile that breaks Vercel's `npm ci`.

---

## C. Supabase workflow

The historical weak point was one project serving both dev experiments and prod. Separate them.

1. **Create a dedicated `staging` Supabase project** (free tier is fine). Put its credentials in `server/.env.staging` (template: `server/env.staging.example`). This is the safety net for testing every migration before prod.
2. **Upgrade the *production* project to Pro ($25/mo) for PITR** the moment real bookings/payments exist. This converts a business-ending risk (no backup undo) into a minor one. Cheapest insurance you'll buy.
3. **`service_role` key lives only in Render env** (`sync:false` in `render.yaml`) and never reaches the client. To rotate it (a historical exposure makes this overdue):
   - **First** set an explicit `GOOGLE_TOKEN_KEY` in Render and run `node server/scripts/encryptGoogleTokens.js` to re-encrypt stored Google tokens under it. The token-encryption key is derived from the service-role key when `GOOGLE_TOKEN_KEY` is unset — so rotating the service-role key *without this step* makes every stored Google refresh token undecryptable and breaks Calendar for all hosts.
   - Then rotate the key in Supabase, update Render env, redeploy, and verify a host's calendar still syncs.
   - Never paste the service-role key into chat, issues, or logs again.
4. **Verify RLS** on every table holding customer data before launch. A schema-only dump (`*_schema.sql`) shows the policies; confirm no PII table is missing one.
5. **Keep a current schema baseline.** Regenerate `staging_schema.sql` periodically (it's gitignored) and store dumps off-repo. `migrate.js --seed` uses this file to provision a fresh DB.

---

## D. Database migration workflow

Tooling already exists: `server/scripts/migrate.js` + `npm run migrate:staging` / `migrate:prod` (each reads `DATABASE_URL` from `server/.env.staging` or `server/.env`). Use it instead of hand-pasting into the Supabase SQL editor.

**Every schema change:**
1. Write the migration as a new SQL file. Keep it **idempotent** (`CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DROP … IF EXISTS` before re-adding).
2. Use a **unique, timestamped or strictly-increasing name** — never reuse a version number (the repo has legacy duplicate `v3.2_*`, `v3.16_*`, `v3.17_*` pairs; don't add more).
3. **Apply to staging first, always:** `cd server && npm run migrate:staging -- migrations/<file>.sql`. Verify the app against staging.
4. **Take a manual dump of prod immediately before applying** (this is your only rollback for forward-only migrations):
   `pg_dump "$PROD_DATABASE_URL" -Fc --no-owner --no-privileges -f pre-migration-$(date -u +%Y%m%d%H%M).dump`
5. **Apply to prod:** `cd server && npm run migrate:prod -- migrations/<file>.sql`.
6. **Then** deploy the code that depends on it ([B](#b-deployment-workflow)).

**Rules:**
- **Additive-only near launch.** Add columns/tables freely; never `DROP COLUMN`/`DROP TABLE`/`TRUNCATE` on a table with data without a fresh dump taken that minute.
- **Destructive/cleanup SQL never goes in `migrations/`.** It lives in `server/scripts/sql/one-off/` and is run manually, deliberately, after a backup. `cleanup_accounts_MANUAL_ONLY.sql` deletes nearly every table — treat it as live ordnance.
- Migrations are **forward-only** (no down scripts). "Undo" = a new forward migration that reverses the change, or a backup restore ([F](#f-disaster-recovery-procedure)).

---

## E. Rollback procedure

> Code rollback and data rollback are **different**. Identify which you need first.

### Bad code deploy (no schema change)
1. **Render (server):** Dashboard → service → **Deploys → Rollback** to the last good deploy (~1 min). Or `git revert <bad-sha>` → push → auto-redeploy.
2. **Vercel (client):** Dashboard → Deployments → last good deployment → **Promote to Production** (instant, atomic).
3. Confirm `GET /health` is `200` and the homepage loads.
4. If the client deploy changed a `VITE_*` value, the rollback reverts the baked value too — re-check env-dependent features.

### Bad deploy that included a migration
1. **Roll the code back first** (above) so the app stops writing against the broken schema.
2. **Assess the migration.** If it was *additive only* (new column/table), prefer to **leave it** — old code ignores it, and reverting risks data loss.
3. **If it must be undone,** write a forward "revert" migration and apply via `migrate:staging` → `migrate:prod`. Safer than a backup restore because it loses no rows written since.
4. **Restore from backup only if data was corrupted/deleted** — that's [F](#f-disaster-recovery-procedure), and it loses everything written since the backup. Last resort.
5. Set `platform_settings.maintenance_mode = true` while working; set `false` when verified.

Keep the exact Render/Vercel dashboard URLs noted in [`DEPLOYMENT.md`](../DEPLOYMENT.md) so you're not learning the UI mid-incident.

---

## F. Disaster recovery procedure

> Worst case: prod DB corrupted, deleted, or a migration nuked tables.

### Prerequisites (set up *before* you need them)
- **Upgrade prod Supabase to Pro for PITR** — then recovery is "pick a timestamp."
- **Activate the daily backup** (`.github/workflows/backup.yml`): add repo secrets `BACKUP_DATABASE_URL` (Supabase → Project Settings → Database → URI, Session mode) and `BACKUP_PASSPHRASE` (long random string, **stored in your password manager**). Trigger once manually to confirm it produces an artifact.
- **Test a restore into staging at least once.** A backup you've never restored is a hypothesis, not a backup.

### Recovery steps
1. **Stop the bleeding.** Set `maintenance_mode = true` (or pause the Render service) so nothing writes to the damaged DB.
2. **Pick the recovery point** — last-known-good timestamp before corruption.
3. **Restore:**
   - *With PITR:* Supabase → Database → Point-in-Time Recovery → choose timestamp → restore.
   - *With a `.dump` artifact:*
     ```
     gpg --batch --decrypt --passphrase "$BACKUP_PASSPHRASE" -o restore.dump bookasloth-YYYYMMDD-HHMMSS.dump.gpg
     pg_restore -d "$TARGET_DATABASE_URL" --clean --if-exists --no-owner restore.dump
     ```
     Restore into a **fresh/staging project first** to verify before touching prod.
4. **Re-point the app** if you restored to a new project: update `SUPABASE_URL` / `SUPABASE_*_KEY` in Render. **Set `GOOGLE_TOKEN_KEY` first if you also rotated the service-role key** (else Google tokens won't decrypt). Redeploy.
5. **Reconcile money.** Cross-check `bookings` / `subscription_payments` against the **Razorpay dashboard** — Razorpay is the out-of-band source of truth for what was actually charged. Re-run the ledger reconciler.
6. **Verify** with the smoke test ([B.5](#b-deployment-workflow)), then `maintenance_mode = false`.
7. **Write a post-mortem** in `docs/incidents/` — what failed, what was lost, what guard you'll add.

### Non-DB disasters
- Lost Render service → `render.yaml` re-provisions it (re-enter secrets).
- Lost domain/DNS → records documented in [`DEPLOYMENT.md`](../DEPLOYMENT.md).
- Leaked secret → rotate (service-role key: remember the `GOOGLE_TOKEN_KEY`-first rule).

---

## G. Maintenance checklist

### Weekly (~15 min)
- [ ] Skim Render logs for new/recurring exceptions; investigate repeats.
- [ ] Check `email_logs` for `failed` rows and the sent-vs-delivered gap; resend anything critical.
- [ ] **Reconcile Razorpay dashboard payments vs `bookings` / `subscription_payments`** — catch any silently-unpaid booking a missed webhook left behind.
- [ ] Confirm `/health` is green and (once wired) UptimeRobot shows no overnight downtime.
- [ ] Confirm the daily backup ran (Actions → Daily DB Backup) and produced an artifact.

### Monthly (~1 hr)
- [ ] `npm audit` in `server/` and `client/`; patch highs/criticals.
- [ ] Review Supabase usage (DB size, auth users, storage) vs tier limits.
- [ ] **Test-restore the latest backup into staging** (the only proof it works).
- [ ] Review pending/failed payouts, subscription auto-renews, and any subscriptions the reconciler didn't heal.
- [ ] Verify `NODE_ENV=production` in Render and `maintenance_mode=false`.

### Quarterly (~half day)
- [ ] Schema-drift audit: confirm staging == prod == repo migrations.
- [ ] **Rotate secrets** on a schedule: service-role key (`GOOGLE_TOKEN_KEY`-first rule), admin JWT secret, SMTP, Razorpay webhook secret. Remove dead vars.
- [ ] Dependency major-version review (Node, Express, Supabase SDK, googleapis).
- [ ] Load-test against staging; confirm you're under the ~100-concurrent-user comfort ceiling; plan horizontal scale (needs cron-locking) if approaching it.
- [ ] Review RLS policies; run a security pass.
- [ ] Credential/expiry check: domain, SSL auto-renew, Razorpay/Google/Supabase keys.

### Yearly (~1–2 days)
- [ ] **Full DR drill:** simulate "prod DB gone," restore a backup into a fresh project end-to-end, time it, document gaps.
- [ ] Razorpay KYC / GST / tax-config review.
- [ ] Renew domain registration; audit DNS records.
- [ ] Re-evaluate hosting tier and region vs actual user geography and growth.
- [ ] Archive the year's incident post-mortems; fold lessons back into this runbook.

---

## Appendix — key files

| Concern | File |
|---|---|
| Server startup, crons, crash handlers, shutdown | `server/server.js` |
| Env validation (fail-fast) | `server/config/validateEnv.js` |
| Migration runner | `server/scripts/migrate.js` (`npm run migrate:staging` / `migrate:prod`) |
| Staging env template | `server/env.staging.example` |
| Destructive one-off SQL (manual only) | `server/scripts/sql/one-off/` |
| Daily backup workflow | `.github/workflows/backup.yml` |
| CI | `.github/workflows/ci.yml` |
| Infra blueprint | `render.yaml` |
| Razorpay creds (DB-backed) | `server/services/razorpayConfig.js`, admin panel |
| Webhook setup | `docs/razorpay-webhook-setup.md` |
| Admin 2FA break-glass | `docs/admin-2fa-runbook.md` |
| Infra runbook (DNS, domains, phases) | `DEPLOYMENT.md` |
