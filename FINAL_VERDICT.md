# FINAL_VERDICT.md — Book A Sloth performance verdict

_Phase 7. 2026-06-18. Updated with **measured** results from the Mumbai Production project (`BENCHMARK_REPORT.md`)._
_Grounded in: real JMeter runs to **500 concurrent users** against the actual launch region (ap-south-1), code analysis (`BOTTLENECK_ANALYSIS.md`, all `file:line`-cited), and tier specs (`CAPACITY_ESTIMATE.md`). Single-laptop generator → relative numbers, but the error/throughput/latency *shape* is real. Stages above 500 are not yet run (need distributed load)._

## Can Book A Sloth support this **today** (current single-process stack)?

| Concurrent users | Verdict today | Basis (measured unless noted) |
|---|---|---|
| **100** | ✅ **Yes, comfortably** | Reads **0% err, p95 369 ms**; booking create ~500–680 ms. Single core not yet saturated. |
| **250** | ⚠️ **Survives, degraded** | Reads **0% err** but **p95 1.47 s** — single core saturating. OK for tolerant flows, slow for interactive. |
| **500** | ⚠️ **Survives with 0 errors, but too slow** | Reads **0% err, no crashes**, but **p95 3.9 s / p99 15 s**. Throughput plateaus at ~175/s. Functionally unacceptable latency on one core. |
| **1,000** | ❌ **Not supported single-instance** | Throughput ceiling measured at **~160–175 req/s** (one core). 1,000 users ≈ 100–200 req/s sustained *with* multi-second latency and a growing queue. Needs horizontal scale. |
| **2,500 / 5,000 / 10,000** | ❌ **No** | Not reachable single-instance; not yet load-tested (needs distributed generators + horizontal app + pooler). |

**The measured failure mode at scale is LATENCY, not errors.** Through 500 concurrent read users there were **zero** errors, zero crashes, zero Supabase/DB errors. The single CPU core simply caps useful throughput at **~160–175 req/s**, so beyond ~100 users the queue grows and p95 climbs (369 ms → 1.5 s → 3.9 s). Writes are correct under concurrency (exclusion constraint enforced, no double-bookings).

### The empirical ceiling
- **Good latency (<1 s p95): ~100 concurrent users** on the current single core.
- **Zero-error survival: at least 500 concurrent reads** (but multi-second latency).
- **Throughput wall: ~160–175 req/s**, single core, region-co-located (Mumbai).

## Why (code-cited)
1. **One process, one core** — `server/server.js`, no clustering. ← the throughput wall the data shows.
2. **Auth = ~175 ms network call per authed request** — `middleware/authMiddleware.js:22` (reads tested here are public; authed endpoints carry this extra floor).
3. **3–5 serial Supabase round-trips per booking/slots request** — `bookingController.js:204–344`.
4. **In-memory rate limiter** — `middleware/security.js`; blocks horizontal scale until shared.
5. **No connection pooler** — `config/supabase.js`; the next wall once the core is unblocked.
6. **Region now correct** — Mumbai (ap-south-1) halves the old Tokyo latency; co-location is already done.

## What must be fixed first — ranked, with expected gain

### Critical (required to serve >100 users with good latency, or any 1k+)
| Fix | Expected gain | Ref |
|---|---|---|
| **C1.** Horizontal scale: `cluster`/PM2 + multiple instances behind a load balancer | **~N× the 175/s ceiling** — the single direct fix for the measured wall | O4 |
| **C2.** Shared Redis rate-limit store (prereq for C1) | Correct limits across instances | O3 |
| **C3.** Local JWT verification (replace `getUser`) | −~175 ms on every authed request (dashboard/bookings/admin) | O1 |
| **C4.** Supabase transaction pooler + sized compute | Prevents connection exhaustion once C1 multiplies query load | O5 |

### High
| Fix | Expected gain | Ref |
|---|---|---|
| **H1.** Edge/CDN cache on public reads (slots/profile/service) | Offloads the highest-RPS surface from the core entirely | O7 |
| **H2.** Collapse per-request Supabase round-trips + narrow selects | −50–200 ms per saved hop; lifts the per-core knee | O2 |

### Medium / Low
| Fix | Expected gain | Ref |
|---|---|---|
| **M1.** FreeBusy TTL widen + pre-warm | Cold date-picker 1–2.5 s → ~150 ms | O6 |
| **M2.** Observability (Sentry, uptime, metrics, alerts) | Operability at scale | O8 |
| **L1.** Backups: PITR + tested restore | Recoverability | `STAGING_SETUP.md` §7 |

## Bottom line
- **Today, single instance:** great to **~100 concurrent users**, survives **500 reads with zero errors but ~4 s p95**, and tops out at **~175 req/s**.
- **To serve 500+ with good latency, or 1,000+ at all:** horizontal scale (C1+C2) is mandatory — everything else is latency-shaving on top.
- **To certify 1,000 → 10,000:** rerun the ladder on a horizontally-scaled staging stack with **distributed load generators** (the harness + Docker server image are ready; `STAGING_SETUP.md`). The current single-box test can't generate beyond ~500 meaningfully.
