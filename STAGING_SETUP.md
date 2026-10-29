# STAGING_SETUP.md — dedicated performance environment (Option 3)

_2026-06-18. The chosen path: a production-like staging environment + a separate Supabase project so the full `s10 → s10000` ladder can be run with **measured** numbers and **zero** risk to the live customer database. The code/tooling is already in place; this runbook covers the parts only the account owner can do (billing, infra, secrets)._

> Why this is required: `server/.env` resolves a single Supabase project (`xwvciqkayammbvsidqig`) = **production**. Reads and booking writes are never stubbed, so any large run hits live data. The `run.js` safety guard hard-caps `env=local` at 250 threads for exactly this reason. To go past that you need an isolated stack.

## Step 1 — Separate Supabase project (the test database)
1. Create a **new Supabase project** (separate from prod). Start on **Free** for plumbing; move to **Pro** before the 1k+ stages (Free pauses when idle and has a low connection ceiling).
2. Apply the schema: run the migrations in `server/migrations/` (v1.1 → latest) against the new project's SQL editor, **in order**, so the test DB matches prod structure (tables, indexes, the `bookings_no_overlap` exclusion constraint, RLS).
3. Collect its `Project URL`, `anon` key, and `service_role` key.
4. **Never** put these in `server/.env` (that's prod). They go only into the staging server's env (Step 2).

## Step 2 — Staging server (the app under test)
Deploy the `server/` app to a **prod-sized** host — **Render Standard** (~1 vCPU / 2 GB) — separate from prod:
- Env vars on the staging service:
  ```
  NODE_ENV=staging              # NOT "production" — LOAD_TEST_MODE fail-safes OFF under production
  LOAD_TEST_MODE=true           # stubs OTP/SMS/WhatsApp/email/calendar-writes + bypasses rate limits
  SUPABASE_URL=<test project url>
  SUPABASE_SERVICE_ROLE_KEY=<test service_role>
  SUPABASE_ANON_KEY=<test anon>
  FREEBUSY_CACHE_TTL_MS=60000
  # Razorpay test keys only; no live payment keys on staging
  ```
- Confirm `isLoadTestMode()` is **true** on staging (it returns false if `NODE_ENV=production`).
- Verify `GET /health` returns 200, then `GET /api/...` a public read succeeds against the test DB.

## Step 3 — Seed the test database
From an environment pointed at the **test** project (never prod):
```
node server/scripts/seedLoadTest.js        # creates loadtest-* vendors + services + guests
node server/scripts/exportLoadTestData.js  # writes performance/jmeter/data/*.csv
```
`assertNotProd` refuses to run when `NODE_ENV=production` — keep staging on `NODE_ENV=staging`.
For FreeBusy cache-effectiveness runs, set `TEST_VENDOR_GOOGLE_REFRESH_TOKEN` for a Google-connected test vendor (else that plan is skipped, never faked).

## Step 4 — Point JMeter at staging
Edit `performance/jmeter/config/staging.properties`:
```
base.protocol=https
base.host=<your-staging-host>.onrender.com   # no protocol, no /api, no trailing slash
base.port=443
```

## Step 5 — Run the progressive ladder (stops on first SLA breach)
```
cd performance
PERF_ALLOW_LARGE_RUN=1 npm run perf:ladder:staging         # slots-readonly, s10 → s10000
PERF_ALLOW_LARGE_RUN=1 node scripts/ladder.js staging booking-flow s1000   # writes, capped at 1k
```
- The ladder runs each stage, gates it (`parse-jtl.js`: error% ≤1, P95 ≤ threshold), and **stops** the moment a stage fails — record that stage as the knee.
- Override thresholds per the task's per-stage targets, e.g. `PERF_P95_MAX_MS=1000` for the 500u stage.
- Record every stage's `samples / error% / P95 / P99 / throughput` in `BENCHMARK_REPORT.md`.

## Step 6 — Beyond 1,000 users: distributed load
A single generator box cannot produce 1k–10k realistic concurrency (it also competes with nothing here, but one JVM/NIC saturates). For the 2,500 / 5,000 / 10,000 stages use **JMeter distributed mode** (1 controller + N worker nodes) or a cloud load service (e.g. BlazeMeter / k6 Cloud). Keep the same `.jmx` plans.

## Step 7 — Operability gates before trusting any "ready" verdict
- **Supabase dashboard:** watch connection count + CPU + slow queries during each stage (the connection ceiling is the predicted first wall — `BOTTLENECK_ANALYSIS.md` BN3).
- **App metrics:** CPU/mem per instance, event-loop lag, request queue.
- **Sentry** wired for errors; **external uptime** check; **alerts** to email/Slack.
- **Backups:** enable PITR + automated backups on the prod project and **test a restore** before public growth.

## Step 8 — Teardown
After a run: `node server/scripts/cleanupLoadTest.js` (removes tagged test rows). On the isolated test project this is low-stakes; never run seed/cleanup against prod.

---

### What is already done (no action needed)
- `LOAD_TEST_MODE` + all mocks (merged, PR #54).
- 6 JMeter plans (`auth-flow`, `booking-flow`, `vendor-flow`, `slots-readonly`, `full-journey`, `freebusy-cache`).
- `run.js` ladder + safety guard; `ladder.js` auto-stop runner; `parse-jtl.js` SLA gate; `.github/workflows/performance.yml` CI hook.
- JDK 21 + JMeter 5.6.3 installed (`~/perf-tools`).

### What only you can do (this runbook)
- Create the **test Supabase project** + apply migrations (Step 1).
- Deploy the **staging server** with the test-project env (Step 2).
- Provide a **distributed load** setup for >1k (Step 6).
- Enable **observability + backups** (Step 7).
