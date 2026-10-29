# JMeter Performance Testing Framework — Design Spec

_Date: 2026-06-18_
_Status: Draft for review_
_Owner: Performance / DevOps_

## 1. Goal

Build a reusable Apache JMeter load-testing framework for the Meeticulous backend so we can measure and improve performance before public launch, and guard against future regressions in CI. Delivered in 5 phases (audit → setup → flow automation → load/stress → CI/CD).

## 2. Constraints & Non-Goals (read first — these shape everything)

- **No staging environment exists.** Production is Render Starter (`meeticulous-api.onrender.com`) + Vercel. The prompt forbids heavy load against production. **Therefore the default target is `http://localhost:5000`.** Every plan is parameterized by a `BASE_URL`/host property so a future staging or throwaway prod-sized box is a one-line change.
- **Localhost numbers are a relative baseline, not a prod capacity claim.** A single 12-core / 17 GB laptop generating *and* serving load measures the laptop. Render Starter (~0.5 vCPU / 512 MB) and the Supabase connection pooler will cap far lower. This is stated plainly in `BENCHMARKS.md` and `SCALING_RECOMMENDATIONS.md`; we never present a localhost number as a prod number.
- **No fabricated results.** Scenarios A (smoke, 10u) and B (normal, 100u) are run for real against localhost and the actual JMeter output is reported. Scenarios C (500u) and D (1000u) are authored and parameterized but **not** run on localhost; running them requires an adequately-provisioned target (documented).
- **Production safety is non-negotiable.** The only server-code change is an additive, default-off `LOAD_TEST_MODE` that fail-safes to OFF whenever `NODE_ENV=production`. When the flag is off the code path is byte-for-byte the current behavior (pure no-op). Every seam gets a test proving both states.
- **No real side effects during tests.** No real bookings that look real, no real payment capture, no real SMS/email/WhatsApp blasts, no calendar writes to real attendee calendars. Test rows are tagged and purgeable.

Non-goals for this build: distributed JMeter (multiple load generators), a permanent Grafana/Prometheus stack (provided as optional compose only), and running C/D scenarios this session.

## 3. Key Architecture Decisions

### 3.1 Target & parameterization
- Default target localhost; `STAGING_API_URL` property supported for later.
- Server under test runs with `LOAD_TEST_MODE=true NODE_ENV=development` and Razorpay **test** keys.

### 3.2 Tiered external stubbing (the important one)

Real prod latency on the hot endpoints is dominated by the external calls (Google FreeBusy 1–2 s, Razorpay 200–500 ms). Blanket-stubbing all of them produces optimistic numbers and **defeats the "validate FreeBusy cache effectiveness" goal** (the cache wraps the Google call — stub Google and there is no cache to measure). So we stub *selectively*:

| External | Seam (existing file) | Load-mode behavior | Rationale |
|---|---|---|---|
| Email + WhatsApp + OTP send (all semantic notifications) | `server/services/notificationEngine.js` (`send`) — **single chokepoint** | short-circuit at top, return success-shaped result, no provider call | OTP, booking confirmations, vendor notifications all route here (via `communicationEngine` + `aisensy`); `utils/sendEmail` is NOT used by the engine |
| Direct SMTP (password-reset etc. non-engine callers) | `server/utils/sendEmail.js` | return fake success, no SMTP | belt-and-suspenders so no SMTP can egress in load mode |
| OTP code generation | `server/utils/otpStore.js` (`generate`) | return fixed `000000` | deterministic verify step for JMeter |
| Google **createEvent** (write) | `server/config/google.js` (`createCalendarEvent`) | return synthetic event id, no API call | writes to real calendars = side effect |
| Google **FreeBusy** (read) | `server/config/google.js` (`getFreeBusy`) | **KEPT REAL** (not stubbed) | recovers real Google latency **and** lets us measure the cache hit/miss — the whole point |
| Razorpay order create | `server/services/razorpayConfig.js` (test keys) | **real sandbox API** (test keys), real latency | no money, real latency |
| Razorpay signature verify | `paymentController.verifyPayment` | skip real payment fetch + accept a synthetic test signature | JMeter cannot run a real client-side checkout to produce a real signature/payment |
| Supabase (all queries) | — | **never stubbed** | the DB is the primary thing under test |
| Express rate limiters (NOT an external — a load blocker) | `server/middleware/security.js` (every `rateLimit`/`slowDown`) | `skip` fn → bypass when load mode | one JMeter IP would trip `otpLimiter` (5/hr) / `apiLimiter` (100/min) / `bookingLimiter` (15/hr) instantly; without bypass the test only measures 429s. Bypass is itself off-by-default → zero regression |

**FreeBusy realism requires a Google-connected test vendor.** `getFreeBusy` is only called when the host has `google_calendar_connected=true` with valid tokens. So seeding creates **two** test vendors:
- `loadtest-vendor-rules` — no Google; slots come purely from availability rules (fully deterministic, zero external). Used by the bulk of slot/booking load.
- `loadtest-vendor-gcal` — Google-connected, enabled only when `TEST_VENDOR_GOOGLE_REFRESH_TOKEN` is provided in the test env. Used by a dedicated cache-effectiveness plan. If the token is absent, that plan is skipped with a clear log (never fabricated).

### 3.3 Test-data tagging (no schema change → no migration → zero DB risk)
- Guests created during load tests use email domain `@loadtest.meeticulous.local` and phone prefix `+910000…`.
- Seeded vendors use usernames prefixed `loadtest-`.
- Cleanup deletes by these patterns. No new columns, no migration, fully reversible.

### 3.4 Supabase isolation (recommended upgrade, not blocking)
Load against localhost still hits the real (prod) Supabase project, creating tagged junk rows that cleanup removes. Cleaner is a **separate test Supabase project** (free tier): point `server/.env.loadtest` at it. The framework works against either — it is just which `.env` the server boots with. Documented as the recommended path; not required to start.

## 4. `LOAD_TEST_MODE` — detailed design

New module `server/config/loadTestMode.js`:

```js
// Single source of truth. Fail-safe: never trusts the flag in production.
function isLoadTestMode() {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.LOAD_TEST_MODE === 'true') {
      console.warn('[loadTestMode] LOAD_TEST_MODE ignored: NODE_ENV=production');
    }
    return false;
  }
  return process.env.LOAD_TEST_MODE === 'true';
}
module.exports = { isLoadTestMode };
```

- Each seam imports `isLoadTestMode()` and branches at the **top** of the function: flag off → existing code runs untouched.
- **Zero-regression contract:** when `LOAD_TEST_MODE` is unset/false, every seam behaves exactly as today. Proven by jest tests asserting (a) the real path is taken when off, (b) the stub path when on, (c) production + flag = off.
- No new dependency, no config wiring, no route changes.

### 4.1 Tests for the flag (TDD — written before the seam edits)
- `loadTestMode.test.js` — truth table incl. the production fail-safe.
- Per-seam tests asserting both states: `notificationEngine.send`, `sendEmail`, `otpStore.generate`, `google.createCalendarEvent` (stubbed) + `google.getFreeBusy` (still real), `paymentController.verifyPayment` signature bypass, and `security.js` rate-limiter `skip`.

## 5. Seeding & Cleanup

- `server/scripts/seedLoadTest.js` — idempotent. Creates the two test vendors, wide-open weekly availability, one free + one paid service each, all tagged. **Hard-refuses if `NODE_ENV=production`.** Prints the IDs/usernames/slugs it created (consumed by CSV generation).
- `server/scripts/cleanupLoadTest.js` — deletes all tagged rows (bookings → services → availability → profiles, FK-safe order). **Hard-refuses if `NODE_ENV=production`.**
- `server/scripts/exportLoadTestData.js` — writes `performance/jmeter/data/*.csv` (vendors, services, guests) from the seeded state so plans never hardcode IDs.

## 6. Directory Layout (repo root `/performance`)

```
performance/
  package.json                 # perf:local, perf:staging, perf:smoke|normal|launch|spike, perf:report
  .gitignore                   # ignore results/ and reports/
  README.md
  jmeter/
    test-plans/
      auth-flow.jmx            # login → extract JWT → authed call
      slots-readonly.jmx       # high-RPS public reads (slots, listing, profile)
      booking-flow.jmx         # service → slots → book → create-order → verify
      vendor-flow.jmx          # vendor login → dashboard → bookings list
      freebusy-cache.jmx       # gcal vendor; measures cache hit vs miss (skipped w/o token)
      full-journey.jmx         # guest landing → ... → confirmation (composes fragments)
    fragments/
      login-jwt.jmx            # reusable Include-Controller fragment: login + JSON-extract token
    data/
      vendors.csv  services.csv  guests.csv
    config/
      base.properties          # defaults (protocol/host/port, thread counts via __P)
      local.properties         # localhost overrides
      staging.properties       # STAGING_API_URL overrides
    results/                   # .jtl (gitignored)
    reports/                   # HTML (gitignored, except a committed sample)
  scripts/
    run.js                     # cross-platform node wrapper around jmeter -n …
    parse-jtl.js               # reads statistics.json → pass/fail vs SLA (used by CI)
    install-jmeter.ps1         # optional Windows installer helper
  docs/
    PERFORMANCE_AUDIT.md       # P1
    ENDPOINT_INVENTORY.md      # P1
    LOAD_TEST_STRATEGY.md      # P1
    BENCHMARKS.md              # P4 — filled from real A/B runs
    SCALING_RECOMMENDATIONS.md # P4
  observability/               # optional, not stood up this session
    docker-compose.yml         # InfluxDB + Grafana
    jmeter-dashboard.json      # community JMeter dashboard
```

## 7. JMeter Component Design (Phase 2)

- **Property-driven HTTP Request Defaults** — protocol/host/port from `${__P(base.protocol)}` / `${__P(base.host)}` / `${__P(base.port)}`. One base config drives every plan; `-q config/local.properties` selects environment.
- **Thread counts & durations** also via `__P` (`${__P(threads,10)}`, `${__P(rampup,30)}`, `${__P(duration,60)}`) so the same .jmx runs every scenario.
- **CSV Data Set Config** per plan for vendors/services/guests.
- **HTTP Header Manager** — `Content-Type: application/json` globally; `Authorization: Bearer ${JWT_TOKEN}` on authed samplers.
- **JWT login fragment** (`fragments/login-jwt.jmx`) included via **Include Controller** — logs in, JSON-extracts the token into `JWT_TOKEN`. Reused across authed plans (DRY).
- **Correlation** — JSON Extractor for `JWT_TOKEN`, `service_id`, `booking_id`, `order_id`; passed between steps via variables.
- **Assertions** — Response Assertion (2xx) + JSON Assertion (expected fields) + Duration Assertion at the per-endpoint SLA.
- **Timers** — Gaussian Random Timer (think-time) on journeys; Constant Throughput Timer where we pin RPS.
- **Listeners** — Simple Data Writer to `.jtl` only (GUI listeners off for headless runs). Optional Backend Listener (InfluxDB) gated by `${__P(backend,false)}`.

## 8. Flows (Phase 3)

| Plan | Journey | Auth | Notes |
|---|---|---|---|
| `auth-flow` | send-otp → verify-otp (fixed 000000) → GET /auth/me | issues + reuses JWT | also covers email/password login variant |
| `slots-readonly` | GET service detail → GET available-slots → GET host profile → GET services list | public | highest-RPS; the launch-day spike surface |
| `booking-flow` | service → available-slots → POST /bookings → POST /payment/create-order → POST /payment/verify | optional/JWT | paid service path; exercises the real write path under the flag |
| `vendor-flow` | vendor login → GET dashboard stats → GET /bookings/host | JWT | vendor dashboard read load |
| `freebusy-cache` | repeated available-slots against `loadtest-vendor-gcal` | public | measures cold (miss) vs warm (hit) latency; validates TTL cache |
| `full-journey` | composes login + slots + booking fragments end-to-end | mixed | realistic guest journey with think-time |

Dynamic data (emails, phones, service IDs, booking IDs) comes from CSVs + extracted correlation vars — never hardcoded.

## 9. Load Scenarios (Phase 4)

| Scenario | Threads | Ramp-up | Hold | Run this session? |
|---|---|---|---|---|
| A — Smoke | 10 | 30 s | 60 s | **Yes (real)** |
| B — Normal | 100 | 5 min | 5 min | **Yes (real)** |
| C — Launch day | 500 | 20 min | 10 min | Authored, not run on localhost |
| D — Viral spike | 1000+ | step-load to failure | — | Authored, not run on localhost |

All four are the same .jmx files driven by `__P` overrides from `scripts/run.js`. Metrics captured from JMeter: avg / P95 / P99 / throughput / error %. Host CPU/mem captured separately via Windows `Get-Counter` sampling during each run (methodology documented in `BENCHMARKS.md`), since JMeter doesn't see the server box. DB latency inferred from the server's existing `PERF_LOG` (>1000 ms slow-request log in `server.js`) cross-referenced with JMeter timings.

**Validation targets called out in the prompt:** FreeBusy cache effectiveness (via `freebusy-cache` plan — cold vs warm), deferred-I/O behavior (confirm response returns before background email/ledger work; visible as fast POST /bookings response despite heavy follow-up), and where Supabase/Render limits bite first (documented, since localhost can't show the Render cap).

## 10. Performance Targets / SLAs

| Endpoint class | P95 target | Error rate |
|---|---|---|
| Public reads (slots, listing, profile) | < 300 ms | < 1% |
| Auth (login, verify-otp) | < 400 ms | < 1% |
| Booking create | < 500 ms | < 1% |
| Payment verify | < 800 ms (Razorpay-bound) | < 1% |

These are prod-intent SLAs. Under `LOAD_TEST_MODE` the payment-verify path does not exhibit real Razorpay-fetch latency (signature + fetch short-circuited); only `create-order` shows real sandbox latency. Verify-path numbers therefore measure our own code + DB, not Razorpay.

Concurrency goal: framework demonstrates the path to 500+ concurrent; actual prod capacity is a Render/Supabase sizing exercise, not a localhost result.

## 11. CI/CD (Phase 5)

`.github/workflows/performance.yml`:
- **Triggers:** `workflow_dispatch` (manual), nightly `schedule`, and PR-to-main (smoke only).
- **Job (ubuntu):** `actions/setup-java` (Temurin LTS) → cache + install JMeter → `npm ci` in `server/` → boot server with `LOAD_TEST_MODE=true` + test env secrets → `seedLoadTest` → run **smoke** plan → `scripts/parse-jtl.js`.
- **Gates (fail the build if):** P95 > 500 ms, error rate > 1%, or throughput drops > 20% vs committed `performance/jmeter/baseline.json`.
- **Artifacts:** HTML report uploaded each run.
- **Rollout safety:** starts **non-blocking** (`workflow_dispatch` + nightly) because it needs a test-Supabase secret; documented how to promote to a required PR check once secrets exist. Making it a required check on day one would wedge every PR — explicitly avoided.

Secrets required (documented in README): `TEST_SUPABASE_URL`, `TEST_SUPABASE_SERVICE_KEY`, `RAZORPAY_TEST_KEY_ID/SECRET`, optional `TEST_VENDOR_GOOGLE_REFRESH_TOKEN`.

## 12. Observability (optional, Phase 5)
- JMeter **Backend Listener** (InfluxDB line protocol) wired into plans, default-off via property.
- `observability/docker-compose.yml` (InfluxDB + Grafana) + community JMeter dashboard JSON for live graphs. Provided and documented; **not** stood up this session.

## 13. Deliverables checklist

- P1: `PERFORMANCE_AUDIT.md`, `ENDPOINT_INVENTORY.md`, `LOAD_TEST_STRATEGY.md`
- P2: directory + templates (`base.properties`, HTTP defaults, CSV configs, JWT fragment, assertions, timers), `performance/package.json` CLI scripts, `README.md`, Java+JMeter installed locally
- P3: `auth-flow.jmx`, `booking-flow.jmx`, `vendor-flow.jmx` (+ `slots-readonly`, `freebusy-cache`, `full-journey`)
- P4: real A/B benchmark output in `BENCHMARKS.md`, bottleneck analysis, `SCALING_RECOMMENDATIONS.md`
- P5: `.github/workflows/performance.yml`, `parse-jtl.js` gate, HTML report artifacts, optional observability stack
- Server: `config/loadTestMode.js` + guarded seams + jest tests; `seedLoadTest.js` / `cleanupLoadTest.js` / `exportLoadTestData.js`

## 14. Phase Sequencing & Checkpoints

Execute in order P1 → P2 → P3 → P4 → P5 with a checkpoint after each phase (user reviews, then continue). TDD on the server flag (the only thing that can affect prod). Rationale: the flag + seeding must exist and be proven safe before any flow can run; flows must exist before load scenarios; scenarios produce the numbers CI gates on.

## 15. Risks & Open Items

- **Hand-authored .jmx correctness** — JMeter XML is finicky. Mitigation: validate each plan by actually running it headless (`-n`) after install; fix until green.
- **FreeBusy cache plan needs a real Google token** — skipped (logged, not faked) if `TEST_VENDOR_GOOGLE_REFRESH_TOKEN` absent.
- **Razorpay verify signature short-circuit** — the one place load mode diverges from prod logic in the payment path; isolated, tested, and only reachable when the flag is on + non-prod.
- **Localhost realism ceiling** — accepted; staging/temp-prod box is the documented upgrade for prod-shaped numbers.
- **CI needs a test Supabase project + secrets** — until then the workflow stays manual/nightly and non-blocking.
