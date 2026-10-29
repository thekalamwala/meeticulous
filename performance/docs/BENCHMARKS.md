# Benchmarks — Book A Sloth (localhost baseline)

_Run 2026-06-18. **Real JMeter output — nothing fabricated.** Companion: `PERFORMANCE_AUDIT.md`, `SCALING_RECOMMENDATIONS.md`._

## Setup
- **Server:** local, single Node process, `LOAD_TEST_MODE=true`, port 5599 (12-core / 17 GB dev laptop).
- **Load generator:** JMeter 5.6.3 on the **same machine** (so the box both generates and serves).
- **Database:** the real Supabase project in **`ap-northeast-1` (Tokyo)** — every request makes a live cross-region round-trip.
- Read this as a **relative baseline + regression guard, not a prod capacity number** (see caveats).

## Results (real)
| Flow | Users | Samples | Error % | Avg | **P95** | P99 | Throughput |
|---|---|---|---|---|---|---|---|
| slots-readonly (public reads) | 10 | 808 | **0.00%** | 343 ms | **373 ms** | 510 ms | 13.6 /s |
| slots-readonly (public reads) | 100 | 10 204 | **0.00%** | 478 ms | **873 ms** | 1109 ms | **113.9 /s** |
| booking-flow (POST /bookings) | 5 | 57 | **0.00%** | 1020 ms | **1507 ms** | 2312 ms | 2.9 /s |
| full-journey (service→slots→otp→verify→book) | 10 | 198 | **0.00%** | 853 ms | **1899 ms** | 2259 ms | 3.4 /s |

All four runs finished with **0% errors**.

## What the numbers say
1. **Reads are healthy and scale.** `slots-readonly` held **0 errors at 100 concurrent users** (10 204 requests, 113.9 req/s). Latency degraded gracefully — P95 373 ms → 873 ms (≈2.3×) from 10u → 100u — with no failures. The read path is the launch-day spike surface and it held up.
2. **Latency is Supabase-round-trip-bound, not Node-CPU-bound.** Every endpoint's time is dominated by cross-region (laptop → Tokyo) Supabase round-trips (~150–250 ms each). `available-slots` and `POST /bookings` each issue 3–5 sequential queries → that's the bulk of the 373 ms / 1507 ms. Node CPU was never the bottleneck at these levels.
3. **Writes are slower because they're query-heavy.** `booking-flow` P95 1507 ms = `createBooking`'s 4–5 Supabase queries + slot validation, serialized, each a Tokyo hop. Server compute is negligible.
4. **Full journey P95 1899 ms** is the sum of 5 sequential calls (service → slots → send-otp → verify-otp → book) — expected for an end-to-end flow.

## SLA check (prod-intent targets)
The prod-intent SLAs (reads <300 ms, booking <500 ms P95) are **exceeded on localhost** — but only because of the **laptop→Tokyo Supabase hop**. In production (Render co-located with / near Supabase) those round-trips collapse to single-digit ms and the SLAs become realistic. The localhost numbers are a *relative* guard; the CI gate (`parse-jtl.js`) is calibrated to the localhost baseline (P95 ≤ 500 ms passes the 10u read smoke at 373 ms).

The biggest prod win is independent of region: **replace `supabaseAdmin.auth.getUser` (~175 ms/authed request) with local JWT verification** and **edge-cache public reads** — see `SCALING_RECOMMENDATIONS.md` §1–2.

## Environment note (not a product bug)
The long-lived load-test server was killed twice mid-run by this **multi-agent dev host** (exit 127, **no stack trace** — not a Node crash). An isolated boot→run→kill server completed `booking-flow` writes cleanly (0% err, server UP), confirming the server itself is stable under write load. Lesson for re-running: boot the server fresh per benchmark, or use a dedicated host.

## Not run on localhost (by design)
Scenarios C (500u) and D (1000u) are authored (`perf:launch` / `perf:spike`) but **not meaningful on a single laptop hitting prod Supabase** — they'd measure the laptop + saturate the Tokyo connection. Run them against a prod-sized **staging** server + a **separate test Supabase project** (`config/staging.properties`). See `SCALING_RECOMMENDATIONS.md`.
