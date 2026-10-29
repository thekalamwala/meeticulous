# LOAD_TEST_BLOCKERS.md — Book A Sloth

_Phase 1 — Load Test Safety Validation. 2026-06-18._
_Outcome: **safety mocks are complete, but test-environment isolation is missing → large-scale testing is BLOCKED.** Per the task rules, we do NOT proceed to >250-user tests. The safety protection that enforces this has been implemented (see §3)._

## 1. Safety inventory (verified against code)

### Load-testing safety controls — ALL PRESENT ✅
| Control | Status | Evidence |
|---|---|---|
| `LOAD_TEST_MODE` flag | ✅ present, **fail-safe OFF in prod** | `server/config/loadTestMode.js`; `isLoadTestMode()` returns false when `NODE_ENV=production` |
| Mock OTP | ✅ | `server/utils/otpStore.js` `generate` → fixed `000000` under load mode |
| Mock SMS | ✅ | `server/services/notificationEngine.js` `send` stubbed (no provider) |
| Mock WhatsApp | ✅ | same stub path (WhatsApp already disabled app-wide) |
| Mock Email | ✅ | `server/utils/sendEmail.js` stubbed (no SMTP) |
| Mock Calendar **writes** | ✅ | `server/config/google.js` `createCalendarEvent` → synthetic id |
| Rate-limiter bypass | ✅ | `server/middleware/security.js:9–14` `skipWhenLoadTest` on all 10 limiters |
| Razorpay test mode | ✅ | order create uses test keys (real latency, no money); `verifyPayment` signature **bypassed** under load mode (`paymentController.js:137`) |
| Seed/cleanup prod-guard | ✅ | `server/scripts/lib/guard.js` `assertNotProd` refuses when `NODE_ENV=production` |

**Conclusion:** every irreversible / costly / spammy side-effect is stubbed. The mock layer is production-grade and was already merged (PR #54).

### Test environment & data — ISOLATION MISSING ❌
| Requirement | Status | Evidence |
|---|---|---|
| Separate Supabase project | ❌ **MISSING** | `server/.env` resolves a single `SUPABASE_URL = https://xwvciqkayammbvsidqig.supabase.co` — the **production** project. No `TEST_SUPABASE_*` keys exist. |
| Separate staging server | ❌ **MISSING** | `performance/jmeter/config/staging.properties` host = `CHANGE_ME.onrender.com` (unconfigured). |
| Test users | ⚠️ exist **but in the prod DB** | seeded by `server/scripts/seedLoadTest.js`, tagged `@loadtest.bookasloth.local` |
| Test vendors | ⚠️ exist **but in the prod DB** | `loadtest-vendor-rules`, `loadtest-vendor-gcal` |
| Test services | ⚠️ 4 exist **but in the prod DB** | CSV in `performance/jmeter/data/services.csv` |
| Test bookings | ⚠️ created per-run **in the prod DB** | `bookingController` inserts; `cleanupLoadTest.js` removes tagged rows afterwards |

## 2. The blockers (ranked)

> Supabase and FreeBusy reads are **never stubbed** (by design — so the cache/DB latency stays measurable). Therefore *every* load run, even fully "mocked," still drives **real reads and real booking writes against the live customer database.** Small, tagged, cleaned-up runs (≤100u, already done) are tolerable; thousands of concurrent users are not.

| # | Blocker | Severity | Why it blocks 10k |
|---|---|---|---|
| **B1** | No separate test Supabase project | **CRITICAL** | All non-stubbed traffic hits the live DB. 10k users ≈ 40–50k queries/s against the production database — risks customer-facing degradation/outage and pollutes prod data. |
| **B2** | No prod-sized staging server | **CRITICAL** | `local` = dev laptop + prod DB. Cannot represent prod capacity, and a laptop cannot host 500u+ while also generating the load. |
| **B3** | Single load generator (the dev box generates *and* serves) | **HIGH** | One machine cannot produce realistic 1k–10k concurrency; results would measure the laptop, not the system. Needs distributed/cloud JMeter. |
| **B4** | In-memory rate-limiter / slow-down state | **MEDIUM** | A multi-instance staging deployment needs a shared (Redis) limiter store before horizontal-scale load tests are meaningful. |

## 3. Safety protection implemented now ✅

To mechanically enforce "DO NOT continue to large-scale testing," `performance/scripts/run.js` now has a **hard load-ceiling guard**:

- **`env=local` is capped at `SAFE_MAX_THREADS_LOCAL = 250` threads.** Any larger scenario is refused with exit code 2 (the local server is wired to the production Supabase project, so it must never be scale-tested).
- **Non-local targets above 250 threads require explicit `PERF_ALLOW_LARGE_RUN=1`** acknowledging an isolated test environment.
- The full progressive ladder (`s10 … s10000`) is now encoded as scenarios so Phase 4 stages are addressable, but the dangerous ones are gated.

**Verified:**
```
$ node scripts/run.js local s10000
BLOCKED: "s10000" = 10000 threads on env=local.
The local server connects to the PRODUCTION Supabase project ...
exit=2
$ node scripts/run.js local s250        # passes the guard (≤250)
```

## 4. What must happen to lift the blockers (ops, not code)

These cannot be done from code alone — they require the account owner:

1. **Create a separate Supabase project** (Free to start, Pro for realistic capacity). Add `TEST_SUPABASE_URL` / service-role / anon keys to a **staging** server's env (never the prod `.env`).
2. **Deploy a prod-sized staging server** (Render Standard) with `LOAD_TEST_MODE=true` and **`NODE_ENV` ≠ `production`** (the flag fail-safes OFF under `production`, so staging must use e.g. `NODE_ENV=staging`).
3. Set `performance/jmeter/config/staging.properties` `base.host` to the staging host.
4. For **>1,000 users**, use a **distributed JMeter** setup (multiple generator nodes) or a cloud load service — a single box cannot generate it.
5. (Before multi-instance) move the rate limiter to a **shared store (Redis)** — blocker B4.

## 5. Gate decision

**Phase 1 = FAIL on environment isolation → progressive testing is capped at ≤250 concurrent users on localhost (reads only), and the 500u → 10,000u stages are deferred until B1–B3 are resolved.** Capacity for those scales is therefore **estimated analytically** (`CAPACITY_ESTIMATE.md`), not measured, and the final verdict (`FINAL_VERDICT.md`) reflects that distinction honestly.
