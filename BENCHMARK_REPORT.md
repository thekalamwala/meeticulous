# BENCHMARK_REPORT.md — Book A Sloth progressive load test

_Phase 4 — Progressive Load Testing. 2026-06-18._
_**All numbers below are real JMeter output** against the **Mumbai Production project** (`ayjhlwyzszykqtnaktpb`, ap-south-1) while it was **empty and pre-launch**. Test data was seeded, exercised, then fully removed (`cleanupLoadTest.js` — DB verified back to 0 bookings / 0 test vendors / 0 services). Nothing fabricated._

## Environment
- **DB:** Mumbai Production (`ap-south-1`), the actual launch region. Empty before/after.
- **App server:** the Express app with `LOAD_TEST_MODE=true`, `NODE_ENV=development`, port 5599. Reads s10–s250 ran on a bare `node` process; **s500 + booking ran in a Docker container** (`node:22-slim`) because this host's background-process reaper killed the bare server mid-run 3×. Same code, same DB — comparable.
- **Load generator:** JMeter 5.6.3 on the **same machine** (single box generates + serves → relative numbers, not absolute prod capacity). One Node process = **one CPU core** (no clustering).
- **Region win:** Mumbai p95 is ~half of the old Tokyo baseline at low load (s10: 184 ms vs 373 ms).

## Read path — `slots-readonly` (public `available-slots` + service detail)

| Stage | Users | Samples | Error % | avg | **P95** | P99 | Throughput |
|---|---|---|---|---|---|---|---|
| 1 | 10 | 962 | **0.00%** | — | **184 ms** | 287 ms | 16.1 /s |
| 2 | 50 | 9,543 | **0.00%** | — | **181 ms** | 238 ms | 79.9 /s |
| 3 | 100 | 27,967 | **0.00%** | — | **369 ms** | — | 93.3 /s |
| 4 | 250 | 48,384 | **0.00%** | — | **1472 ms** | — | 161.0 /s |
| 5 | 500 | 26,557 | **0.00%** | 1681 ms | **3873 ms** | 15067 ms | 175.6 /s |

**Reads never errored — 0.00% at every level through 500 concurrent users.** No crashes, no Supabase connection errors, no DB errors.

What it shows:
- **Latency is flat to 50u** (~181 ms p95), rises at 100u (369 ms), **saturates at 250u** (1472 ms), and at **500u degrades to p95 3.9 s / p99 15 s**.
- **Throughput ceiling ≈ 160–175 req/s** — it barely moves from 250u (161/s) to 500u (175.6/s). That plateau is the **single CPU core** saturating. Adding users past the knee just lengthens the queue (latency up, throughput flat).
- **Acceptable-P95 ceiling (<1 s) is ~100 concurrent users** on one core. 250–500 still *succeed with zero errors* but users wait seconds.

## Write path — `booking-flow` (service → slots → OTP → verify → create booking), 50 concurrent

| Metric | Value |
|---|---|
| Total samples | 5,611 |
| Successful creates (HTTP 201) | **360** |
| Slot conflicts (HTTP 409) | 5,251 |
| Server failures / 5xx / crashes | **0** |
| Successful-create latency | **p50 506 ms · p95 679 ms · p99 781 ms · max 1887 ms** |
| 409 reject latency | p95 229 ms (fast, correct) |

**The 93.6% "error" rate is HTTP 409 slot-conflict — not a failure.** With only **2 seeded test vendors**, 50 concurrent bookers fight over the same slots; the `bookings_no_overlap` exclusion constraint correctly rejects the losers (no double-bookings) and 360 real bookings were created. The server stayed up and behaved correctly under concurrent writes.
- **A successful booking create is ~500–680 ms** on the empty Mumbai DB.
- This is a **test-data limit, not a capacity limit.** Real production has many vendors → little slot contention. To load-test *write throughput* at scale, seed many vendors with wide availability (a follow-up).

## Stages not run (require distributed load)
| Users | Status |
|---|---|
| 1,000 / 2,500 / 5,000 / 10,000 | ⛔ not run — a single laptop can't generate this realistically (the box already both serves and generates at 500u). Needs **distributed JMeter** (controller + N workers) or a cloud load service, per `STAGING_SETUP.md` §6. |

## Headline
- **Reads: zero errors through 500 concurrent users**, but the single core caps useful throughput at ~160–175 req/s; good latency (<1 s p95) holds to ~100 users, then degrades (250u ≈ 1.5 s, 500u ≈ 3.9 s).
- **Writes: correct and stable under concurrency** (exclusion constraint enforced, ~500–680 ms per create); a proper write-throughput test needs more vendor inventory.
- **No crashes, no DB/connection errors** at any level — the failure mode at scale is **latency, not errors**. The fix is horizontal scale (see `FINAL_VERDICT.md` / `OPTIMIZATION_REPORT.md`).
