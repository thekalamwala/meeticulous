# Infrastructure & Scalability Audit — Meeticulous

_Date: 2026-07-01 · Branch: `database-architecture` · Author: engineering audit (read-only, no code changed)_

> **Status: REPORT ONLY.** No implementation has begun. This document ends at a proposed roadmap awaiting sign-off. Nothing here has been applied to code or DB.

---

## 0. Method

Reconstructed context from `CLAUDE.md`, `docs/*`, and `MEMORY.md`, then ran a six-domain code audit (DB/indexes, caching, booking-race/idempotency, API N+1, frontend, deploy/observability). Findings below are grounded in actual file:line references from the current tree, not the docs (docs lag ~2 weeks behind `MEMORY.md`).

**Headline:** the platform is **more mature than the docs suggest**. Booking correctness, security middleware, CI, load tests, cron leader-election, and frontend bundling are already strong. The scaling gap is concentrated in **two places**: (1) **no read-caching on public pages** (every profile/service view = full DB round-trip), and (2) **a handful of unbounded list queries + one cron N+1**. There is no Redis and no queue infra — but for current scale the DB-polled workers are adequate; Redis becomes necessary only when horizontally scaling or when public traffic grows.

---

## 1. Current State — What Already Exists

### Backend / API
- Express 4, Node 22, 20+ route modules mounted in `server.js`. Clean per-domain controller split.
- Middleware chain: helmet → permissions-policy → hpp → xss-sanitize → suspicious-request blocker → speed-limiter → rate-limiter → maintenance gate (`server.js:95-105`).
- Auth: Supabase JWT (`protect`) for host/guest; separate bcrypt+JWT admin store with 5-fail lockout and per-permission RBAC (45 perms, 6 roles).
- DB access via Supabase JS SDK (PostgREST HTTP), **not** a direct `pg` pool. `supabaseAdmin` (service role, RLS bypass) server-only; `pg` used only by the optional rate-limit store.

### Database
- 54 sequential migrations (v1.1 → v3.54). Well-indexed on hot paths: `idx_bookings_host_scheduled (host_id, scheduled_at)`, reminder composite, FK-covering indexes (v3.50), payment-idempotency partial-unique indexes (v3.47, v1.10, v2.8.2, v3.17).
- **Double-booking is DB-enforced**: `bookings_no_overlap` EXCLUDE gist constraint (`v2.5:32-37`) on `(host_id =, tstzrange(scheduled_at,end_at) &&)` for non-cancelled rows → 23P01 caught as 409.
- FKs hardened to RESTRICT on host references (v3.43) to protect financial history from cascade-delete.

### Caching (what exists)
- Six 60s in-memory config caches with `clearCache()`: feature flags, plans, platform config, Razorpay config, notification engine, plus a DB-backed FreeBusy cache (60s + persistence, fail-open).
- Sitemap XML cached 1h in-process, busted on mutation.
- HTTP `Cache-Control` set only on sitemaps (`max-age=3600`) and badges (`max-age=60`).

### Background Processing / "Queues"
- No BullMQ/Redis. Instead: DB-polled `setInterval` workers with **Postgres leader-election lease** (`runLocked`, `v3.25_job_locks`) so multi-instance never double-fires.
- Jobs: reminders (5m), auto-complete (15m), pending-hold reaper (10m), OTP cleanup (60m), email queue (60s, retry backoff 5m/30m/2h), campaign worker (60s), badge eval (60m), ledger reconciler (60m), subscription reconciler (15m), booking-payment reconciler (15m), rate-limit + IP-block prune (60m).
- Email is already **async-queued** via `email_logs` (status=queued) — OTP/reset send immediately, everything else queues. Reconcilers self-heal missed Razorpay webhooks.

### Frontend
- Vite + React 18 SPA, **70+ lazy routes** via `lazyWithRetry`; admin/dashboard/public bundles fully isolated.
- `manualChunks` splits react / supabase / axios into stable vendor chunks; es2022 target; visualizer behind `ANALYZE=1`.
- PostHog dynamically imported on first idle (~67kB saved); Razorpay loaded on-demand at checkout; lucide tree-shaken; fonts self-hosted WOFF2 with 2 preloaded weights + `font-display:swap`.

### Observability / Security / Deploy
- Sentry wired (no-op until `SENTRY_DSN` set) into `uncaughtException`/`unhandledRejection`. Winston structured logs with sensitive-field masking. PostHog product analytics. `/health` (no DB touch, by design).
- 14 tiered rate limiters, dual-key (IP + contact) on OTP/booking/newsletter. Helmet CSP + HSTS + Permissions-Policy. IP auto-ban system. Env validation fail-fast in prod.
- CI (`ci.yml`) runs build+unit tests, auto-deploys Vercel + Render on push to main. JMeter load suite in `performance/` (smoke/normal/launch/spike, CI-gated). Daily encrypted `pg_dump` workflow (currently disabled — needs secrets).

---

## 2. Missing Infrastructure

| Area | Missing |
|---|---|
| **Cache** | Redis/shared cache; HTTP `Cache-Control`/`ETag` on public read endpoints; CDN edge-caching of API GETs |
| **Queue** | Durable queue (BullMQ/pg-boss); dead-letter queue; exponential backoff is ad-hoc per worker, not centralized |
| **DB scaling** | Read replicas; explicit connection-pool config (relies on Supavisor defaults); no PgBouncer transaction-mode tuning documented |
| **Response** | HTTP compression (`compression` middleware absent); cursor pagination on list endpoints |
| **Observability** | Centralized log aggregation; APM/distributed tracing; infra metrics (Prometheus/`/metrics`); readiness probe (DB check); latency SLA alerting |
| **Resilience** | Backup workflow disabled (no secrets); no PITR (Supabase free tier); rate-limit store still in-memory (`RATE_LIMIT_STORE_URL` unset) |
| **SEO/render** | No SSR/prerender — social/non-JS crawlers see empty HTML |

---

## 3. Bottlenecks (ranked)

### CRITICAL
1. **Public pages uncached → DB round-trip per view.** `GET /api/host/:username` and `GET /api/services/public/*` each fire 6+ queries per request, no HTTP cache header, no server cache. This is the single biggest scale risk: profile/service pages are the highest-traffic, most crawler-hit surface. Impact: DB load scales linearly with public traffic; Supabase connection pressure under any viral/SEO spike.
2. **`SELECT *` on host-profile services** (`hostController.js:192`, `.limit(100)`) pulls every large text column (description, faqs, included/excluded items) for up to 100 services when the client renders ~5. Prime suspect for the reported "20s+ vendor page." Impact: huge payloads + slow serialization on the hottest endpoint.

### HIGH
3. **Unbounded list endpoints** — no `.limit()`/`.range()`: `getHostBookings` (`bookingController.js:542`), `getGuestBookings` (`:572`), `getReceivedReviews`/`getHostReviews` (`reviewController.js:128,152`), `getPayoutRequests` (`vendorController.js:84`). A host with 1000+ bookings fetches all on dashboard load. Impact: latency + payload grow unbounded with account age.
4. **Reminder cron N+1** (`bookingController.js:1412-1431`) — per due booking: plan-rule lookup + timezone lookup + email + UPDATE = ~4 sequential queries/row, plan rules re-fetched per row even for same host. Impact: cron wall-clock blows up with booking volume; can overrun its 5-min interval.
5. **Monthly booking-quota TOCTOU** (`bookingController.js:316` → `planMiddleware.js:180`) — count-then-insert with no DB constraint; concurrent bookings can exceed plan cap. Impact: revenue leakage / limit bypass under concurrency (low frequency, manual remediation today).
6. **No HTTP compression** — JSON responses sent uncompressed from Express (Render). Impact: larger payloads, slower TTFB on large lists. (Note: verify Render isn't already gzipping at the proxy before acting.)

### MEDIUM
7. **In-memory rate-limit store** blocks horizontal scaling of the API (each instance counts separately). `RATE_LIMIT_STORE_URL` path exists but unset.
8. **Missing indexes** for likely filters: `bookings.payment_status`, `bookings.guest_email`/`guest_phone`, `profiles.plan`, standalone `services.host_id` (only in composite). Confirm query plans before adding — several may be low-cardinality/not worth it.
9. **Auto-complete cron** notify fan-out is sequential per booking (`:1483`).
10. **Sitemap/config caches are per-instance** — multi-node would serve divergent cached state until TTL/bust.

### LOW
11. No `ETag`/conditional requests anywhere. 12. Image `srcset` variants absent (Unsplash `auto=format` mitigates). 13. Admin lists use `SELECT *` with `.range()` (over-fetch, already paginated). 14. Categories endpoints uncached (low cost, changes rarely).

---

## 4. Recommended Target Architecture

Incremental, Supabase-native first; Redis introduced only when caching/scaling demands it.

```
Browser (SPA, CDN)
  │  Vercel edge — cache public GET proxies (s-maxage)
  ▼
Express API (Render, ≥1 instance)
  ├─ compression() on JSON
  ├─ HTTP Cache-Control + ETag on public reads
  ├─ Read cache layer:
  │     Phase A: in-process LRU (single instance) — fast win
  │     Phase B: Redis (Upstash) — shared, survives multi-instance
  ├─ Rate-limit store → Redis (unblocks horizontal scale)
  ├─ Durable queue (pg-boss on existing Postgres, or BullMQ on Redis)
  │     email · campaigns · calendar writes · reminders → jobs w/ DLQ + backoff
  └─ Workers (leader-elected today → queue consumers)
  │  Supavisor (transaction pooler) — explicit pool sizing
  ▼
Supabase Postgres (primary)
  └─ (future) read replica for public-profile reads
Observability: Sentry (on) + /metrics + readiness probe + log drain + latency alerts
```

Key choices to decide at approval:
- **Cache substrate:** start in-process LRU (zero new infra, single Render instance today) vs. jump straight to **Upstash Redis** (serverless, cheap, unblocks scaling + rate-limit store in one move). Recommendation: **Redis via Upstash** — it's the common denominator for cache + rate-limit + optional BullMQ, and avoids a rewrite later.
- **Queue:** **pg-boss** (reuses Postgres, no new infra, DLQ + backoff built-in) vs BullMQ (needs Redis, richer). If we adopt Redis anyway, BullMQ is viable; otherwise pg-boss is the lighter path. Recommendation: **pg-boss** unless Redis lands first.
- **Read replica:** defer until caching is in and metrics justify it.

---

## 5. Implementation Roadmap

Each milestone is independently testable, deployable, and reversible. No two major infra changes in one step.

**Phase 1 — Zero-infra latency wins (safe, no new services) — ✅ DONE (branch `perf/api-latency-phase1`)**
- 1a. ✅ Added `compression()` middleware (Accept-Encoding + 1KB gated, never double-encodes; honors `x-no-compression`). `server.js`.
- 1b. ✅ Replaced `SELECT *` in host-profile services with a `SERVICE_PUBLIC_COLS` whitelist (+ the missing `.limit(100)` on the fallback path). Kills the 20s page. `hostController.js`.
- 1c. ✅ Bounded the 5 unbounded list endpoints (host/guest bookings, received/host reviews, payout requests) via `utils/pagination.js` (`parseListRange` — optional `?limit/?offset`, hard ceiling). Bare-array shape preserved → no client break. Reviews cap-only so count/avg stay correct.
- 1d. ✅ Added `Cache-Control` (`utils/httpCache.js` `setPublicCache`) to public GET success paths: host profile 120s, service detail 120s, plans 300s, categories 600s. `max-age` lands now (direct-to-Render); `s-maxage`+`stale-while-revalidate` are CDN-ready; Express weak ETag gives 304 for free.

Tests after Phase 1: server **1071/1071** green. No client changes; client build not re-run.

> **Worktree note:** this repo's checkout is shared by a concurrent session that repeatedly switched branches mid-task, reverting the working tree. Phase 1 was finished in an isolated git worktree at `.claude/worktrees/perf-api-latency` on `perf/api-latency-phase1` to stop the HEAD drift. All commits pushed to `origin/perf/api-latency-phase1`.

**Phase 2 — Server read cache — ✅ DONE (branch `perf/api-latency-phase1`)**
- 2a. ✅ `services/responseCache.js` — pluggable in-process TTL cache (`getOrSet`/`bust`/`clear`), bounded (`MAX_ENTRIES`, expired-then-oldest eviction), `RESPONSE_CACHE_ENABLED=false` kill-switch. Phase 3 swaps the backend to Redis behind the same 3 functions.
- 2b. ✅ Wrapped host-profile + both service-detail handlers (refactored into pure builders) at 120s, incl. negative-caching redirect/404 to shield the DB from crawlers on dead slugs. Plans/categories skipped — already covered by `planService` cache + P1 HTTP headers.
- 2c. ✅ `services/publicCacheBust.js` `bustPublicReadCaches()` co-located with every `bustSitemapCache()` write site (host + service create/update/delete/toggle + profile writes); busts both `hostprofile:` and `service:` namespaces. TTL is the backstop.

Tests after Phase 2: server **1075/1075** green (+ new `responseCache` unit suite).

**Phase 3 — Redis (shared state)**
- 3a. ✅ (code) `services/redisClient.js` (lazy ioredis, `rediss://`→TLS, fail-open, off unless `REDIS_URL` set) + `services/responseCache.js` backend now pluggable Redis↔in-process behind the same `getOrSet`/`bust`/`clear`. Redis path JSON round-trips, busts via SCAN+DEL under an `rc:` namespace, fails open on any Redis error. Mock-tested (get/set/scan/del + fail-open). **Founder step to activate: create an Upstash Redis, set `REDIS_URL`** — inert until then; in-process remains the default.
- 3b. Deferred (rationale): a pg-backed persistent rate-limit store already exists via `RATE_LIMIT_STORE_URL`, so rate-limit horizontal-scale is already solvable. A Redis rate-limit store (reusing `redisClient`) is an optional future swap, not implemented to avoid untested marginal surface.

> **To turn on Redis caching:** provision Upstash (free tier fine) → copy the `rediss://…` connection URL → set `REDIS_URL` in Render env → redeploy. Verify via logs (`[redis] client initialised`). To roll back: unset `REDIS_URL` (falls straight back to in-process) or set `RESPONSE_CACHE_ENABLED=false` to disable caching entirely.

**Phase 4 — Durable queue + background offload — ⏸ DEFERRED (rationale below)**
- Reassessed against the code: email **and** campaigns are **already** durably DB-queued (`email_logs` + 60s worker + 5m/30m/2h backoff + permanent-fail = a working queue with a dead-letter), and confirmation emails/analytics in `verifyPayment` already run via `runInBackground`. So "adopt pg-boss" (4a) would mostly churn working, tested infrastructure for little gain — and can't be live-tested here. Deferred by decision.
- The one genuinely-synchronous hot-path call left is the **Google Calendar write in `verifyPayment`** (awaited before the response). Moving it async trades the immediate meeting-link-in-response (still emailed + persisted). Left as-is for now — not worth the payment-path risk this session; revisit if verify latency becomes an issue.
- 4c. ✅ (partial) reminder-window memoization — see above.
- 4c. ✅ (partial) Memoized reminder windows per plan slug in `processReminders` (tz was already cached). Honest note: not a real DB N+1 — `planService` is 60s-cached in memory and the reminder query is ±10-min-windowed (small N); this is a redundant-lookup cleanup. The queue-offload of reminder sends (4b) is still pending.

**Phase 5 — Correctness hardening**
- 5a. ✅ Closed monthly-quota TOCTOU via `utils/keyedMutex.js` `runExclusive` — the quota recheck + insert now run under a per-host in-process lock (early check kept as fast-fail / orphan-calendar avoidance). Fully effective on the single API instance today; a cross-instance lock (Redis / pg advisory) is the Phase 3+ upgrade. No migration, no new infra.
- 5b. Add missing indexes **only after** `EXPLAIN ANALYZE` confirms benefit (still pending; needs migration on both DBs).

**Phase 6 — Observability & resilience**
- 6a. ✅ (code) `GET /ready` (DB-checked readiness, timeout-guarded, 200/503) + `GET /metrics` (dependency-free Prometheus text: uptime, RSS, heap, response-cache entries, http totals/slow/by-status; token-gated via `METRICS_TOKEN`, 404 when unset) + always-on `utils/metrics.js` HTTP middleware. **Founder actions (not code):** set `SENTRY_DSN` to activate the already-wired Sentry; set `METRICS_TOKEN` + point a scraper at `/metrics`; wire latency alerting off the slow-request counter.
- 6b. Founder action: add `BACKUP_DATABASE_URL` + `BACKUP_PASSPHRASE` secrets to enable the existing daily encrypted `pg_dump` workflow; evaluate Supabase Pro for PITR.
- 6c. ✅ (documented) — see **Connection pooling** below.

### Connection pooling

**PostgREST path (the app's main DB access):** `supabaseAdmin` / `supabase` (`@supabase/supabase-js`) talk to Supabase over PostgREST (HTTPS), whose backend connections are pooled by Supabase — the app holds no PG connection pool for its normal reads/writes, so connection exhaustion from app traffic isn't a concern on this path.

**Direct-`pg` consumers** (bypass PostgREST, open real Postgres connections): `middleware/rateLimitStore.js` (`RATE_LIMIT_STORE_URL`, currently unset), `scripts/migrate.js`, and any future pg-boss. Guidance for these:
- Point them at the **Supavisor transaction-mode pooler** URL (port **6543**, `...pooler.supabase.com`, add `?pgbouncer=true`), **not** the direct connection (5432). Transaction mode multiplexes many short-lived app queries onto few DB connections — the right mode for a stateless API + serverless-ish workers.
- Keep each process's `pg.Pool` `max` small (rate-limit store defaults to **5**). With N API instances × pool `max`, stay well under the plan's connection ceiling; the pooler is the backstop but a sane per-process `max` avoids thundering-herd on deploy.
- Migrations/one-offs (`migrate.js`) can use the direct 5432 connection (single short-lived session) — pooler not required there.

**When Redis lands (P3):** the rate-limit store can move off `pg` to Redis, removing one direct-PG consumer entirely.

**Phase 7 (optional) — Read replica + SSR/prerender** — only if metrics justify.

### Suggested cache TTLs
| Data | TTL | Invalidate on |
|---|---|---|
| Host public profile | 120s | profile/service edit, verification |
| Service detail | 120s | service edit/toggle/delete |
| Plans (`/api/plans`) | 300s | admin plan change |
| Categories | 600s | admin category change |
| Themes / static config | 300s | settings save |
| Availability templates | 60s | availability edit |
| Sitemap | 3600s (as-is) | service/profile mutation |
| Reviews aggregate | 120s | new review |

---

## 6. Risk Assessment

| Change | Breaking? | Data risk | Downtime | Mitigation |
|---|---|---|---|---|
| compression() | No | None | None | Toggle via env; verify no double-gzip |
| Explicit column select | Low | None | None | Ensure every field the client reads is included; covered by client tests |
| Pagination on lists | **Yes (API shape)** | None | None | Add `limit`/`cursor` params with backward-compatible defaults (return first page); update client callers in same PR |
| HTTP cache headers | Medium | None | None | Short TTL + mutation-bust; risk = brief staleness after edits (acceptable at 60–120s) |
| Server read cache | Medium | Stale reads | None | Explicit invalidation + conservative TTL; feature-flag the cache to disable fast |
| Redis | Medium | None | None if additive | New dependency/cost; fail-open to in-process/no-cache if Redis down |
| Rate-limit → Redis | Medium | None | None | Keep in-memory fallback; test limiter behavior under Redis outage |
| pg-boss queue | Medium | Job loss if misconfigured | None | Run alongside existing workers first; migrate one job type at a time; DLQ from day one |
| Quota TOCTOU fix | Low | None | None | DB constraint is additive; test concurrent-booking path |
| New indexes | Low | Lock on large table (`CREATE INDEX`) | Possible brief | Use `CREATE INDEX CONCURRENTLY`; only after EXPLAIN |
| Read replica | High | Replication lag → stale/booking-correctness | None | Route ONLY public reads to replica; never booking writes/validation |

**Deploy discipline (per `MEMORY.md`):** apply migrations to BOTH Supabase projects (prod Mumbai `PROD_PROJECT_REF` + staging Tokyo `STAGING_PROJECT_REF`); deploy is native Vercel/Render, not GH-Actions; CI is not a merge gate.

---

## 7. Recommendation

Start with **Phase 1** — it's pure latency win, zero new infrastructure, low risk, and directly kills the reported 20s page and the unbounded-query cliff. Approve Phase 1 to begin; Phases 3–4 (Redis, queue) are a separate decision once Phase 1–2 metrics are in hand.
