# Architecture & Infrastructure Audit — Book A Sloth

**Date:** 2026-06-23
**Scope:** Codebase, infrastructure, deployment config, docs, and architecture decisions.
**Method:** Every item was verified against actual files, config, and code — not documentation
claims or installed-but-unused libraries. Where docs and code disagreed, **code is treated as
ground truth** (noted inline).

> This is a point-in-time audit. See the **Remediation in this branch** section at the end for
> the items already addressed on `claude/architecture-infrastructure-audit-ebydbs`.

---

## Executive Summary

| Category | ✅ Implemented | ⚠️ Partial | ❌ Missing |
|---|---|---|---|
| Infrastructure & Deployment | CI/CD, Deployments, Staging, Load Balancer (platform) | Docker, Git workflow | K8s, Cloud IaC, Serverless/Lambda, High Availability |
| Storage & Data | DB architecture, Caching (in-mem), Indexing | HTTP caching, Connection pooling, Throughput planning | DynamoDB, Embedded DB, Sharding, Partitioning, S3, FTP |
| Communication & Messaging | RPC (Postgres), Short Polling (cron + ad-hoc) | — | WebSockets, gRPC, SQS, Kafka, RabbitMQ |
| Security | Encryption, Rate Limiting, AuthN, RBAC, Secrets | Firewall/WAF | — |
| Dev & DevOps | Error Logging, Optimisation, Env Separation, Rollback | Monitoring, Observability, Git workflow | Cherry-picking strategy |
| AI / ML | — | — | TensorFlow, AI Infra |
| Developer Experience | Local Setup, Onboarding, Env Management | — | PyCharm (N/A — JS project) |

**Verdict:** Strong application-layer security and solid dev/release hygiene for an early-stage
SaaS, but **infrastructure is single-instance and not horizontally scalable** — in-process crons
+ in-memory rate limiting + in-memory caches with no locking or shared state. It is
production-*viable* at low scale, not production-*ready* for scaling.

---

## Detailed Findings

### Infrastructure & Deployment

- **Kubernetes — ❌ Missing.** No manifests/Helm/kustomize. Only YAML is `render.yaml` + GH
  workflows. Not needed at current scale (managed PaaS). *Priority: Low.*
- **Docker / Containerisation — ⚠️ Partial.** `server/Dockerfile.loadtest` (JMeter only) +
  `server/.dockerignore`. No production Dockerfile, no `docker-compose.yml`. Risk: env drift, no
  portability off Render. Fix: multi-stage `server/Dockerfile` + root `docker-compose.yml`.
  *Priority: Medium.*
- **Cloud Architecture / IaC — ❌ Missing.** No Terraform/CloudFormation/Pulumi/CDK. Infra is
  click-configured. Render `render.yaml` partially covers it. *Priority: Low–Medium.*
- **CI/CD — ✅ Implemented.** `.github/workflows/ci.yml` (client build+test, server unit tests,
  non-blocking `npm audit`, concurrency cancel), `performance.yml` (JMeter SLA gate),
  `backup.yml` (daily AES256 dump), `dependabot.yml`. Gaps: CI is **not a merge gate** (no branch
  protection); server **integration tests excluded** from CI. *Priority: High.*
- **Deployments — ✅ Implemented.** `render.yaml` (prod `bookasloth-api` on `main`, staging on
  `staging`, `/health` check) + `client/vercel.json` (SPA routing, security headers). Node 22
  locked. Auto-deploy on push (no manual gate). *Priority: Medium.*
- **Staging Environment — ✅ Implemented.** 3-stage local → staging → prod, separate Supabase
  projects + Razorpay test/live keys, `scripts/use-env.js`, `docs/release-pipeline.md`.
- **Serverless / Lambda — ❌ Missing.** Monolithic Express; no Lambda/Edge Functions. N/A by
  design. *Priority: Low.*
- **Load Balancer / Proxy — ✅ Implemented (platform).** Render fronts API, Vercel fronts client;
  `app.set('trust proxy', 1)` in `server.js`. No app-level Nginx (fine).
- **Availability / High Availability — ❌ Missing (single instance).** One always-on Render
  instance; no `cluster`, no PM2. **8–9 in-process `setInterval` crons** in `server/server.js`
  with **no inter-instance locking**. Risk (Critical): scaling to 2+ instances double-fires
  reminders/emails/campaigns and races reconcilers; deploy = downtime; in-memory rate limiter
  resets on deploy. Fix: gate crons behind a DB lease lock. *Priority: Critical (before scaling).*

### Storage & Data

- **Database Architecture — ✅ Implemented.** Supabase/Postgres. `server/config/supabase.js`
  (`supabaseAdmin` service-role + `supabase` anon, disposable-client pattern). `schema.sql` +
  45+ append-only migrations (`v1.1` … `v3.24`). RLS enforced. Double-entry ledger. Pending:
  `v1.7_pricing_snapshot.sql` (code has fallback). *Priority: Low.*
- **DynamoDB / Embedded DB / Sharding — ❌ Missing.** Not applicable / single instance.
  *Priority: Low.*
- **Partitioning — ❌ Missing.** No table partitioning. Risk: unbounded growth of `email_logs`,
  `ledger_entries`, `admin_audit_logs`. Fix: range-partition by month or retention jobs.
  *Priority: Medium.*
- **Data Throughput Planning — ⚠️ Partial.** Selective indexes exist. Optional pg pool for the
  rate-limit store (off by default). No app DB pool tuning; single process (single-core BN1 in
  `BOTTLENECK_ANALYSIS.md`). *Priority: Medium.*
- **Caching — ⚠️ Partial (in-memory).** `server/utils/sitemapCache.js`, email template/settings
  cache (60s TTL). No Redis/external cache → not shared across instances. *Priority: Medium.*
- **S3 Storage — ❌ Missing (Supabase Storage used).** `server/controllers/uploadController.js`
  uploads to Supabase Storage bucket `images`. Docs claim **Cloudinary** but no SDK is imported —
  docs are stale. *Priority: Low (docs), Medium (backup offload).*
- **FTP — ❌ Missing.** Not needed. *Priority: Low.*

### Communication & Messaging

- **WebSockets — ❌ Missing.** REST only; no `ws`/`socket.io`/Realtime. Feature-dependent.
  *Priority: Low.*
- **RPC — ✅ Implemented (Postgres procs).** `post_journal_entry`, `change_username`,
  `increment_product_purchase_count`, `admin_category_stats` via `supabase.rpc(...)`.
- **SQS / Kafka / RabbitMQ — ❌ Missing.** Queueing is **DB-backed** (`email_logs` + 60s worker
  with backoff in `communicationEngine.js`; `campaignWorker.js`). Acceptable now; migrate to a
  real queue when multi-instance. *Priority: Medium.*
- **Short Polling — ✅ Implemented.** Server: `setInterval` crons. Client: fetch-on-mount/action.

### Security

- **Encryption — ✅ Implemented.** HSTS 1yr + `upgradeInsecureRequests` (Helmet,
  `middleware/security.js`); bcryptjs cost 10 (OTP, admin pw); Google Calendar tokens encrypted
  (`utils/cryptoTokens.js`); admin JWT HS256 constant-time compare. Gap:
  `profiles.google_access_token/refresh_token` stored **plaintext**. *Priority: High.*
- **Firewall / WAF — ⚠️ Partial.** Strict CORS (`config/corsOrigins.js`), Helmet, suspicious-
  pattern blocker. No managed WAF/IP rules (assumes platform edge). *Priority: Medium.*
- **Rate Limiting — ✅ Implemented.** `express-rate-limit` tiers + `express-slow-down`
  (`middleware/security.js`). **In-memory by default** → resets on deploy, per-process. Optional
  Postgres store exists and is fully wired (`middleware/rateLimitStore.js`, migration
  `v3.18_rate_limit_store.sql`) but gated off behind `RATE_LIMIT_STORE_URL`. *Priority: High
  (enable before scaling).*
- **Authentication Security — ✅ Implemented.** OTP bcrypt-hashed, 10-min TTL, single-use, 3
  attempts → 15-min lockout (`utils/otpStore.js`). Supabase JWT verified server-side
  (`middleware/authMiddleware.js`). Isolated admin auth (`admin_users`, separate secret, 5-fail
  lockout). Minor documented gaps: admin initial pw not force-rotated; download tokens reusable.
- **Authorization / RBAC — ✅ Implemented.** `host`/`guest` roles + plan tiers
  (`middleware/planMiddleware.js`), RLS. Admin: 45 permissions × 6 roles, JWT-embedded,
  `admin_audit_logs` (`lib/adminPermissions.js`).
- **Secrets Management — ✅ Implemented.** `.env` gitignored, boot-time `config/validateEnv.js`
  fail-closed in prod, service-role-key type verified on boot, Render secrets `sync: false`. No
  secret manager (dashboards only). Runbook notes historical service-role-key exposure → rotate.
  *Priority: High (rotation), Low (vault).*

### Development & DevOps

- **Git / GitHub Workflow — ⚠️ Partial.** GH Actions + Dependabot + `staging` branch +
  `scripts/release.mjs`. Gaps: no branch protection, no PR template, no CODEOWNERS, no merge
  strategy doc. *Priority: High.*
- **Cherry-picking Strategy — ❌ Missing.** No documented backport/hotfix flow. *Priority: Medium.*
- **Error Logging — ✅ Implemented.** Winston (`utils/logger.js`, masking, rotating files),
  `middleware/errorMiddleware.js` → Sentry, global `uncaughtException`/`unhandledRejection`. Gap:
  Render logs ephemeral, no aggregation. *Priority: Medium.*
- **Monitoring — ⚠️ Partial.** PostHog, GA4 + Meta CAPI (`utils/trackServer.js`), `/health`.
  No APM/Prometheus, no uptime checks wired. Fix: UptimeRobot → `/health`, enable Sentry DSN.
  *Priority: High.*
- **Observability — ⚠️ Partial/Minimal.** Structured logs + request tracing. No distributed
  tracing, Sentry perf sample 0, no system metrics. *Priority: Medium.*
- **Optimisation — ✅ Implemented.** Vite `es2022` + vendor chunks (`client/vite.config.js`),
  Vercel CDN, perf docs. Gap: no server response caching/compression layer. *Priority: Low–Medium.*
- **Environment Separation — ✅ Implemented.** local/staging/prod, separate DBs/keys,
  `scripts/use-env.js`, `validateEnv.js`, VITE_ public-only isolation.
- **Rollback Strategy — ✅ Implemented.** `scripts/release.mjs` semver tags, `OPERATIONS_RUNBOOK.md`
  §E/§F. Gap: **no Supabase PITR** (Pro tier) — DB rollback relies on daily dumps. *Priority: High.*

### AI / ML

- **TensorFlow / AI Infrastructure — ❌ Missing.** No ML/AI deps or features. N/A by design.
  *Priority: Low.*

### Developer Experience

- **PyCharm Support — ❌ N/A.** JS/Node project; not applicable. VS Code recommended.
- **Local Development Setup — ✅ Implemented.** `README.md` quick start, `.env.example`,
  `npm run dev`, seed scripts.
- **Developer Onboarding — ✅ Implemented.** `docs/DEVELOPMENT.md`, `CONTRIBUTING.md`,
  `CODEBASE_GUIDE.md`, `SECURITY.md`, `DATABASE.md`, `TESTING.md`, `ai-context.md`; 205 server +
  112 client tests.
- **Environment Management — ✅ Implemented.** `validateEnv.js`, `use-env.js`, VITE_ isolation.

---

## Architecture Maturity Score (1–10)

| Dimension | Score | Rationale |
|---|---|---|
| Infrastructure | 4 | Managed PaaS works, but single-instance, no IaC/containerized prod, no orchestration. |
| Security | 8 | Strong AuthN/AuthZ/secrets/rate-limit; gaps: plaintext Google tokens, no WAF, in-mem limiter, key rotation. |
| Scalability | 3 | In-process crons + in-mem cache/limiter + DB-as-queue break at 2+ instances; no sharding/partitioning/Redis. |
| Reliability | 4 | Reconcilers + retries + backups good; but single point of failure, no PITR, ephemeral logs, deploy=downtime. |
| Developer Experience | 8 | Strong docs, tests, env tooling, onboarding. |
| Observability | 4 | Structured logs + analytics + Sentry-ready, but no APM/uptime/tracing/metrics wired. |
| Production Readiness | 5 | Launch-viable at low scale with good security; not scale-ready, missing operational safety nets. |

---

## Top 20 Missing Items Before Scaling

1. **Cron job locking** (DB lease) so the app can run >1 instance without double-firing emails/reminders/campaigns. *(Critical)*
2. **Enable shared rate-limit store** (`RATE_LIMIT_STORE_URL` + migration `v3.18`) — in-memory resets every deploy. *(High)*
3. **Branch protection making `ci.yml` a required merge gate** + add the excluded integration tests to CI. *(High)*
4. **Supabase PITR** (Pro tier) — currently only daily dumps. *(High)*
5. **Verify daily backups actually run** — `backup.yml` is a no-op without `BACKUP_*` secrets. *(High)*
6. **Encrypt `profiles.google_access_token`/`refresh_token`** (reuse `cryptoTokens.js`). *(High)*
7. **Rotate the historically-exposed Supabase service-role key.** *(High)*
8. **Wire uptime monitoring** (UptimeRobot → `/health`) + **enable Sentry DSN** in prod. *(High)*
9. **Production Dockerfile + docker-compose** for reproducible builds and local parity. *(Medium)*
10. **External cache layer (Redis/Upstash)** to replace in-memory caches before multi-instance. *(Medium)*
11. **Migrate DB-as-queue (`email_logs`) toward a real queue** with dead-letter handling. *(Medium)*
12. **Log retention/drain** — Render logs are ephemeral. *(Medium)*
13. **Apply pending `v1.7_pricing_snapshot.sql`** and reconcile other pending migrations. *(Medium)*
14. **Partitioning/retention** for unbounded tables. *(Medium)*
15. **Managed WAF / Cloudflare** in front of Render/Vercel. *(Medium)*
16. **DB connection-pool tuning** for the app. *(Medium)*
17. **CODEOWNERS + PR template + documented merge/cherry-pick (hotfix) strategy.** *(Medium)*
18. **Fix stale docs** — code uses Supabase Storage, docs claim Cloudinary. *(Low–Medium)*
19. **Distributed tracing + basic system metrics.** *(Medium)*
20. **Eliminate deploy downtime / single point of failure** (≥2 instances once #1–#2 done). *(High for scale)*

---

## Remediation in this branch

This branch addresses the two highest-priority items so the app becomes safe to run on more than
one instance:

- **#1 Cron job locking — implemented.** A Postgres lease lock (`job_locks` table +
  `try_acquire_job_lock` RPC, migration `server/migrations/v3.25_job_locks.sql`) gates every
  `setInterval` cron in `server/server.js` via `server/utils/jobLock.js`. Only the instance
  holding a fresh lease for a given job runs it; others skip the tick. The holder renews each
  tick; a dead holder's lease expires and another instance takes over. **Fail-open:** if the
  lock can't be evaluated (migration not yet applied, transient DB error) jobs still run, so
  current single-instance behaviour is unchanged until the migration is applied.

- **#2 Shared rate-limit store — completed.** The Postgres-backed store was already implemented
  and wired into every limiter (`middleware/rateLimitStore.js`, `middleware/security.js`,
  migration `v3.18`); it just needed enabling and housekeeping. Added `cleanupExpired()` plus a
  locked hourly cron so the `rate_limit_hits` table doesn't grow unbounded once enabled (no-op
  while the store is off). To switch it on for multi-instance: apply `v3.18`, then set
  `RATE_LIMIT_STORE_URL` to the Postgres connection string.

**To activate multi-instance safety in an environment:** apply migrations `v3.25_job_locks.sql`
and `v3.18_rate_limit_store.sql`, set `RATE_LIMIT_STORE_URL`, then scale to ≥2 instances.

---

## Verification Notes

- All ✅/⚠️/❌ marks were derived from file/code inspection (paths cited inline), not docs.
- Doc-vs-code conflicts: (a) Cloudinary claimed but Supabase Storage used; (b) docs imply a
  scalability the single-instance cron/cache/limiter design does not support. Code is ground truth.
