# Performance Audit — Book A Sloth backend

_2026-06-18 — pre-launch baseline analysis. Source: `server/` Express app._

Findings that shape the load-test plan. Companions: `ENDPOINT_INVENTORY.md`, `LOAD_TEST_STRATEGY.md`. Full design: `docs/superpowers/specs/2026-06-18-jmeter-performance-testing-design.md`.

## 1. Single-process Node — no clustering
`server/server.js` runs one Node process; no `cluster` / PM2 fork. One CPU core serves all traffic. On Render Starter (~0.5 vCPU / 512 MB) this is the hard ceiling. Implication: throughput is bounded by single-core event-loop saturation long before the dev laptop's 12 cores matter.

## 2. Auth verification cost — ~175 ms per authed request
`middleware/authMiddleware.js` `protect` calls `supabaseAdmin.auth.getUser(token)` — a network round-trip to Supabase Auth (~175 ms measured) on EVERY authed request. `/auth/me` fires on every client mount. Under load this is the dominant fixed cost on authed endpoints and a prime optimization candidate (local JWT verification vs remote `getUser`).

## 3. FreeBusy cache — the critical mitigation
`services/availabilityService.js` + `google_freebusy_cache` table. TTL `FREEBUSY_CACHE_TTL_MS` (default 60 s). On hit, slot lookup ≈150-200 ms (3 Supabase queries + compute). On miss, ≈1-2.5 s (live Google FreeBusy round-trip). Stale-on-Google-failure fallback returns cached busy intervals with `unverified:true` so a Google outage never blocks bookings. **Cache hit-rate is the single biggest lever on `available-slots` latency** — validated directly in load testing (cold vs warm).

## 4. Deferred I/O — response returns before side-effects
`utils/background.js` `runInBackground` (setImmediate, fires after `res.json`). Used by:
- `createBooking` → confirmation emails (free services)
- `verifyPayment` → ledger posting, PostHog analytics, confirmation emails

The response is sent first; this work runs after. So POST latency should NOT include email/ledger time — load testing confirms the response stays fast despite heavy follow-up.

## 5. Rate limiting — all per-IP
`middleware/security.js`: authLimiter 10/15min, otpLimiter 5/60min, apiLimiter 100/min, adminLimiter 30/min, paymentLimiter 20/60min, slugLimiter 30/15min, slotsLimiter 40/5min, bookingLimiter 15/60min, freeDownload 10+20/60min, speedLimiter ramps past 300/15min. **All keyed by IP** — a single load generator is throttled instantly, which is why `LOAD_TEST_MODE` bypasses them (off by default, prod-safe).

## 6. No app cache beyond FreeBusy
Feature flags synced once at boot. Razorpay config (`services/razorpayConfig.js`) and notification config (`services/notificationEngine.js`) have 60 s in-memory TTL caches. Plans/platform config queried per request (small tables). Admin permissions embedded in the JWT (no lookup).

## 7. External-dependency latency budget (per call)
- Google FreeBusy: 1-2 s (cache-mitigated to ~0 on hit)
- Google createEvent: 500-1500 ms (deferred / stubbed under load)
- Razorpay order/fetch: 200-500 ms
- Supabase query: ~50 ms each
- Supabase Auth (login / getUser): 200-500 ms

## Headline expectations for the baseline
1. `available-slots` P95 dominated by FreeBusy cache hit-rate.
2. Authed endpoints carry a ~175 ms `getUser` floor.
3. Write endpoints (`/bookings`, `/payment/verify`) return fast because heavy work is deferred.
4. Single-core saturation is the throughput wall on Render Starter.
