# PERFORMANCE_READINESS.md — Book A Sloth

_Phase 0 — Performance Readiness Assessment. 2026-06-18._
_Every claim below is cited to actual code (`file:line`). Nothing fabricated. Measured numbers come only from `performance/docs/BENCHMARKS.md` (real JMeter output)._

## Verdict in one line

The architecture is **read-healthy and write-correct, but single-process, network-latency-bound, and backed by one shared production Supabase project.** It is **not ready for a 10,000-concurrent-user test today** — not because the app is broken, but because (a) the capacity ceiling is far below 10k and (b) there is no safe environment to test it in. Details in every section below; the test-safety gate is in `LOAD_TEST_BLOCKERS.md`.

---

## 1. What was analyzed (request path, verified)

| Layer | File:line | Note |
|---|---|---|
| App bootstrap + middleware order | `server/server.js:14–109` | trust-proxy → CORS → raw(webhook) → json → perf-log → helmet → permissionsPolicy → hpp → sanitizeBody → blockSuspicious → speedLimiter → apiLimiter → maintenance → routes → error |
| Rate limiting | `server/middleware/security.js:45–169` | 10 per-IP limiters + speed-limiter; all `skip: skipWhenLoadTest` |
| LOAD_TEST_MODE bypass | `server/middleware/security.js:9–14`, `server/config/loadTestMode.js` | `isLoadTestMode()`; **fail-safe OFF when `NODE_ENV=production`** |
| Auth | `server/middleware/authMiddleware.js:11–34` | `protect()` → `supabaseAdmin.auth.getUser(token)` network call per request |
| Supabase clients | `server/config/supabase.js:24–45` | 2 singletons (service-role + anon), `persistSession:false`, **no pooling config** |
| FreeBusy cache | `server/services/availabilityService.js:84–163` | DB-backed `google_freebusy_cache`, TTL `FREEBUSY_CACHE_TTL_MS` default 60 s |
| Booking create | `server/controllers/bookingController.js:185–437` | 4 parallel reads → validateSlot → insert (exclusion-constraint guarded) → 201 → deferred emails |
| Payment verify | `server/controllers/paymentController.js:141–372` | signature check → idempotent `.neq("payment_status","paid")` update → 3 deferred jobs |
| Deferred jobs | `server/utils/background.js:17–30` | `runInBackground` (`setImmediate`, fires after `res.json`) |
| Health probe | `server/server.js:103–105` | `GET /health`, no DB touch |

---

## 2. Current bottlenecks (ranked by impact)

### B1 — Auth = a network round-trip per authenticated request (~175 ms floor)
`server/middleware/authMiddleware.js:22` calls `supabaseAdmin.auth.getUser(token)` on **every** authed request. No local JWT verification, no per-request cache. `/auth/me` fires on every client mount. This is a fixed ~175 ms tax on the entire authed surface and the single largest controllable latency.
**Why it's hard to fix cheaply:** the Supabase project signs JWTs with **asymmetric ES256 / JWKS** (`SUPABASE_JWT_SECRET` is unset — no shared HS256 secret). Local verification therefore needs JWKS fetch+cache + `jose` + strict alg/exp/iss/aud checks + a remote fallback. It is a security-critical task, not a one-liner.

### B2 — Single Node process, no clustering
`server/server.js` runs one process; no `cluster`/PM2 fork. One CPU core serves all traffic. On Render Starter (~0.5 vCPU) the event loop saturates long before raw CPU on a dev box would. This is the throughput wall.

### B3 — Sequential / multi-query Supabase round-trips per request, all cross-region
Every query is an HTTP round-trip to Supabase in **`ap-northeast-1` (Tokyo)**. `createBooking` issues 4 reads + validateSlot + insert; `available-slots` 3+ queries. Measured: reads P95 373 ms→873 ms (10u→100u), booking P95 1507 ms, full-journey P95 1899 ms (`performance/docs/BENCHMARKS.md`). Latency is **round-trip-bound, not CPU-bound** at these levels.

### B4 — In-memory rate limiter & slow-down state
`server/middleware/security.js` uses `express-rate-limit` / `express-slow-down` with default in-memory stores. State is per-process. The moment >1 instance runs, limits become per-instance (multiply by N) — i.e. horizontal scale silently weakens abuse protection until a shared store (Redis) is added.

### B5 — Cold FreeBusy path is 1–2.5 s
`server/services/availabilityService.js:128–163`. Cache **hit** ≈150–200 ms; **miss** ≈1–2.5 s (live Google FreeBusy round-trip). Hit-rate is the dominant lever on `available-slots` latency for Google-connected vendors.

---

## 3. Architectural risks

| Risk | Evidence | Consequence under load |
|---|---|---|
| No clustering / 1 core | `server/server.js` (no `cluster`) | Throughput capped at single-core event-loop; no vertical use of multi-core |
| Per-process limiter state | `security.js` default stores | Limits don't hold across instances; horizontal scale weakens protection |
| Auth has no cache | `authMiddleware.js:22` | Every authed RPS multiplies Supabase-Auth load |
| Load-gen == server on one box (in tests) | `BENCHMARKS.md:6` | Local numbers measure the laptop, not prod capacity |
| `LOAD_TEST_MODE` exists but is a kill-switch | `loadTestMode.js`, `security.js:9–14` | Correctly fail-safe OFF in prod — but means realistic perf can only be measured where the flag can be safely ON (NOT prod) |

---

## 4. External-dependency risks

Per-call latency budget (`performance/docs/PERFORMANCE_AUDIT.md:29–34`):

| Dependency | Latency | Load behavior | Risk |
|---|---|---|---|
| Supabase query | ~50 ms each (×3–5/req from Tokyo) | never stubbed | DB is the throughput ceiling (see §6) |
| Supabase Auth `getUser` | 200–500 ms | never stubbed | per-authed-request tax; also a 3rd-party rate surface |
| Google FreeBusy (read) | 1–2 s | **REAL even in load mode** (cache measurable) | Google per-project quota; cold path slow |
| Google createEvent (write) | 0.5–1.5 s | **stubbed** in load mode (`config/google.js`) | safe under test; real in prod |
| Razorpay order/verify | 0.2–0.5 s | order real (test keys); signature bypassed in load mode | real-money path must NOT be load-tested live |
| Email / SMTP / WhatsApp / OTP | n/a | **stubbed** in load mode | safe under test |

**Stubbing is tiered and correct** (`performance/docs/LOAD_TEST_STRATEGY.md:25–40`): irreversible/spammy/costly side-effects are stubbed; Supabase + FreeBusy stay real so the measurement is meaningful.

---

## 5. Supabase risks

- **One project, and it is production.** `server/.env` resolves a single `SUPABASE_URL = https://xwvciqkayammbvsidqig.supabase.co`. No `TEST_SUPABASE_*` keys exist. **Any load test that isn't fully stubbed hits the live customer database.** This is the central safety blocker (see `LOAD_TEST_BLOCKERS.md`).
- **No connection pooler configured for the API.** `server/config/supabase.js` uses supabase-js over PostgREST/HTTP with no transaction-mode pooler (pgBouncer) in front. Sustained concurrency will exhaust Postgres connections / pooler slots before Node CPU saturates.
- **Auth is a Supabase-hosted dependency in the hot path** (`authMiddleware.js:22`). High authed RPS pushes load onto Supabase Auth, which has its own limits.
- **Region penalty is structural**: DB in Tokyo, app/devbox elsewhere → every query pays cross-region RTT. In prod this shrinks only if the Render region is co-located with Supabase.

## 6. Database-scaling risks

- Throughput is gated by **Supabase compute tier + connection limits**, not the app. Free tier (shared compute, ~60 direct / limited pooler connections) will be the first thing to break under hundreds of concurrent writers.
- `createBooking` + `available-slots` each issue 3–5 serial round-trips → request count amplifies into DB query count by ~4–5×. 1,000 booking RPS ≈ 4,000–5,000 Supabase queries/s — well past Free, and a sizing exercise even on Pro.
- The `bookings_no_overlap` exclusion constraint (`bookingController.js:372`, v2.5) guarantees correctness under races but serializes conflicting writes at the DB — a hotspot if many users target the same slot.

## 7. Render hosting risks

- **Starter ≈ 0.5 vCPU / 512 MB.** Single-process Node → the half-core is the ceiling; 512 MB caps in-flight concurrency before the CPU does.
- **No autoscaling on Starter**; a spike has no headroom. Horizontal scale also needs the shared-limiter fix (B4) first.
- **Cold starts / instance recycling** on lower tiers add tail latency.
- The 5-minute reminder cron (`docs/current-state.md:47–49`) requires an always-on instance — already the reason Starter (not free/sleeping) was chosen (`devops-deployment-plan` memory).

---

## 8. What is already in good shape (don't "fix" these)

- **Deferred I/O is correct** (`utils/background.js`): emails, ledger, analytics fire *after* `res.json` — POST latency excludes them. Verified: booking writes returned fast under load.
- **Booking concurrency is DB-safe**: exclusion constraint + idempotent payment `.neq` guard.
- **Rate limiting is comprehensive and prod-safe**; `LOAD_TEST_MODE` bypass is fail-safe OFF in production.
- **FreeBusy cache + stale-on-failure fallback** already mitigate the slowest external call.
- **Reads scale**: 0 errors at 100 concurrent users, 113.9 req/s (`BENCHMARKS.md:15`).

---

## 9. Readiness conclusion → next phases

The app is **functionally ready** but the *test* is **not safe to scale** and the *capacity* is **far below 10k**. Therefore:

1. **Phase 1 gate fires** — missing test environment → `LOAD_TEST_BLOCKERS.md`. Do NOT run large-scale tests against the live project.
2. **Phase 2** quantifies the ceiling per tier → `CAPACITY_ESTIMATE.md`.
3. **Phase 4** runs only the stages that are safe on localhost (reads to ~100–250u) and documents *why* the rest are blocked rather than faking them.
4. **Phase 7** gives the per-scale verdict (100 → 10k) with ranked fixes.
