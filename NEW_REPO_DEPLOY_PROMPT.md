# Deploy-infra setup prompt (paste into Claude Code in the new repo)

Copy everything in the fenced block below into a fresh Claude Code session
opened **inside the new repository**. Edit the `ASSUMPTIONS` block first —
that's the only part you must change per project.

---

````text
You are setting up the deployment infrastructure for a new web app. The app
code (or a skeleton of it) already lives in this repo. Your job is to wire it
to Vercel (frontend), Render (backend + staging), Supabase (database), and
GitHub Actions (CI + production deploy), and to leave a deployment runbook.
Reproduce the proven topology described below — do NOT invent a different one.

## ASSUMPTIONS — edit these before you start, then confirm them back to me
- GitHub repo:          <owner>/<repo>
- Project name / slug:  <my-app>            (used for service names)
- Primary domain:       <example.com>       (apex + www)
- Render region:        singapore           (closest to India; change if not)
- Node version:         22
- Integrations in use:  Supabase, Razorpay, SMTP email, Google Calendar OAuth,
                        Sentry, PostHog   (delete any you are NOT using)

If the repo does not yet have `client/` and `server/` folders, ASK me before
scaffolding anything — I may be pointing you at code that lives elsewhere.

## Target architecture (reproduce exactly — the design choices matter)

1. **Monorepo layout**
   - `client/`  — React 18 + Vite SPA (builds to `client/dist`)
   - `server/`  — Node + Express API (entry `server.js`, start on `$PORT`)
   - `supabase/migrations/` — SQL migrations (and/or `server/migrations/`)

2. **Frontend → Vercel, deployed by GitHub Actions (NOT Vercel's git integration)**
   - `rootDirectory` = `client`, framework = vite.
   - A workflow runs `vercel deploy --prod --token=$VERCEL_TOKEN` on push to
     `main` — a **remote** build (so Vercel-side Sensitive env vars are
     available; never `vercel build --prebuilt` in CI — that ships a bundle
     with no env baked in → white screen).
   - In `client/vercel.json` set `"git": { "deploymentEnabled": false }` so
     Vercel does NOT also auto-deploy prod (avoids a double-deploy race, and
     bypasses the Hobby-team "commit author lacks contributing access" block —
     token deploys run as the owner). PR **preview** builds stay on.
   - The Vercel build command (`vercel-build`) runs: unit tests → `vite build`
     → any prerender step, so the deploy fails on a red test or bad build.

3. **Backend → Render, via a `render.yaml` Blueprint** at repo root
   - **Prod** web service: `runtime: node`, `rootDir: server`, `plan: starter`
     (always-on — needed if any cron/reminder/email jobs run in-process),
     `branch: main`, `autoDeploy: true`, `healthCheckPath: /health`.
     - `buildCommand: npm ci && npm run test:unit`  (unit tests ONLY — never
       the full suite in a build; integration tests hit live DB/SMTP and are a
       side effect, not a gate). `startCommand: npm start`.
   - **Staging** web service: same but `plan: free`, `branch: staging`, pointed
     at a SEPARATE staging Supabase project and payment TEST keys. (Free spins
     down after ~15 min idle → crons don't run while asleep; fine for staging.)
   - All secrets use `sync: false` (set once in the Render dashboard, never in
     git). Only non-secret values (NODE_ENV, NODE_VERSION, public URLs) are
     inline.
   - PaaS note: Render blocks outbound SMTP ports — if bulk/marketing email is
     needed, use an HTTP email API (e.g. Brevo/Resend over 443), not SMTP.

4. **Database → Supabase** (Postgres + Auth + Storage)
   - Two separate projects: prod and staging. Migrations are plain SQL in
     `supabase/migrations/`, applied to BOTH DBs. Keep code schema-fallback-safe
     until a migration is confirmed applied everywhere.

5. **CI → GitHub Actions `ci.yml`** (separate from deploy)
   - On push + PR to `main` (and `release/**`): run server unit tests and
     client unit tests, each gated by a `paths-filter` so a docs-only change
     runs neither and a server-only change skips the client job.
   - CI is NOT the deploy gate — each deploy owns its own checks (Render's
     build runs the server tests; Vercel's remote build runs the client tests).
   - Use dummy env values in the test job; never real secrets.

6. **Env var split** (critical)
   - `client/.env.example` — only `VITE_*` (and any Vercel runtime vars). These
     are **bundled into the public browser bundle** → publishable keys ONLY,
     never a service-role key or payment secret.
   - `server/.env.example` — all server secrets (Supabase service-role,
     payment secrets, SMTP, OAuth, app JWT secrets, Sentry DSN, etc.).

## Deliverables — create these files in the repo
- `client/vercel.json` — SPA rewrite (`/* → index.html`), security headers
  (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS,
  Permissions-Policy, a CSP — start in `Content-Security-Policy-Report-Only`),
  long cache for `/assets/*`, `git.deploymentEnabled: false`, and a redirects
  placeholder (www → apex 308).
- `render.yaml` — prod + staging services as above.
- `.github/workflows/ci.yml` — path-filtered server + client unit tests.
- `.github/workflows/deploy-vercel.yml` — prod deploy on push to `main` with a
  `paths: ['client/**', '.github/workflows/deploy-vercel.yml']` filter,
  `workflow_dispatch`, a `concurrency` group that cancels in-progress, and the
  Vercel org/project IDs pinned in `env` (IDs are not secrets).
- `client/.env.example` and `server/.env.example` — documented var lists.
- `.gitignore` — ignore `.env`, `.env.*` (keep `.env.example`), `node_modules`,
  `client/dist`, `.vercel`.
- `DEPLOYMENT.md` — a phased runbook (see below).

## DEPLOYMENT.md — phases to document
- Phase 1: create Vercel + Render + Supabase accounts (+ GitHub repo).
- Phase 2: deploy backend — generate fresh secrets
  (`openssl rand -hex 32` for JWT/OAuth secrets; a token key must be exactly
  32 bytes = 64 hex chars), create the Render Blueprint from `render.yaml`,
  paste secrets, verify `GET /health` returns ok.
- Phase 3: deploy frontend — import the repo in Vercel with root `client`, add
  `VITE_*` env vars, add the GitHub repo secret `VERCEL_TOKEN`
  (Vercel → Account → Tokens) and any `PROD_SUPABASE_*` secrets the workflows
  need, then push to `main`.
- Phase 4: point the domain (DNS at your registrar) — apex/www → Vercel, an
  `api.` subdomain → Render; then update `CLIENT_URL`/`API_URL`/`VITE_API_URL`
  to the real domains.
- Phase 4b: update third-party allow-lists to the real domains — payment
  webhook URL + webhook secret, Google OAuth redirect URI (add in Google
  Console too), Supabase Auth redirect URLs, and server CORS origins.
- Phase 5: monitoring — uptime check on `/health`, Sentry DSN, error alerts.
- Phase 6: database backups + a secret-leak sweep.

## Rules
- NEVER commit real secrets. Secrets live in the Render/Vercel dashboards and
  GitHub Actions secrets only. `.env.example` holds names with empty values.
- You cannot click in the Vercel/Render/Supabase dashboards or create accounts
  for me — generate every file and give me an exact, ordered checklist for the
  dashboard + DNS steps. Pause and tell me when it's my turn.
- Adapt all service names / region / domain from the ASSUMPTIONS block.
- Confirm the plan with me before writing files; stop at a PR, don't merge.
````

---

**Notes for you (not part of the prompt):**
- This reproduces the Meeticulous topology: Vercel (prod frontend via GH
  Action, git-integration off) + Render Blueprint (prod `starter` always-on,
  `free` staging) + Supabase (separate prod/staging) + path-filtered CI.
- The real env lists are longer (Brevo/Resend, Meta/GA4 CAPI, Redis, GSC,
  bot flags…). Add only the integrations the new project actually uses — the
  prompt tells the agent to delete unused ones.
- The gotchas baked into the prompt (no `--prebuilt` in CI, SMTP ports blocked
  on PaaS, unit-tests-only build gate, git-integration-off) are the expensive
  lessons from this repo — keep them.
