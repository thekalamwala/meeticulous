# OPTIMIZATION_REPORT.md — Book A Sloth

_Phase 6 — Fixes & Optimization. 2026-06-18._
_Expected-gain figures are **estimates** (labelled), derived from the architecture + the measured baseline. They must be confirmed on staging. Per the hard rule "do not break production functionality," only changes that are **provably behavior-preserving** were applied in code; everything that changes a live response or needs ops is delivered as a reviewed recommendation + exact patch, not silently applied._

## Implemented now (zero production risk)

| Change | File | What it does |
|---|---|---|
| **Load-ceiling safety guard** | `performance/scripts/run.js` | Refuses >250-thread runs on `env=local` (the local server is wired to the prod Supabase project) and requires `PERF_ALLOW_LARGE_RUN=1` elsewhere. Verified: `local s10000` → `BLOCKED exit 2`. Prevents accidentally load-testing the live customer DB. |
| **Progressive ladder runner** | `performance/scripts/ladder.js` + `perf:ladder` script | Runs stages `s10…s10000` in order, gates each with `parse-jtl.js`, and **stops on the first SLA breach** or safety-cap refusal. Encodes "don't jump to 10k." Touches no production code path. |
| **Full stage ladder encoded** | `performance/scripts/run.js` | `s10 … s10000` scenarios added (legacy `smoke/normal/launch/spike` kept). |

These are test-tooling/safety only — they do not alter the running application.

## Recommended fixes (ranked) — NOT auto-applied; each notes why

| ID | Fix | Severity | Est. gain | Why not auto-applied |
|---|---|---|---|---|
| **O1** | Local JWT verification instead of `supabaseAdmin.auth.getUser` per request | **Critical** | **−~175 ms on every authed request**; removes load on Supabase Auth | Security-critical. Keys are asymmetric ES256/JWKS (`SUPABASE_JWT_SECRET` unset) → needs JWKS fetch+cache + `jose` + strict alg/exp/iss/aud + remote fallback. Must be its own reviewed task. |
| **O2** | Collapse the 3–5 sequential Supabase round-trips in `available-slots` & `createBooking` into a single RPC / embedded `select`; narrow `select('*')` to needed columns | **High** | **−50–200 ms per saved round-trip** (co-located less); fewer DB queries amplifies headroom | Changes query shape on the live booking path; needs tests + EXPLAIN review so behavior is identical. |
| **O3** | Move `express-rate-limit` / `express-slow-down` to a **shared Redis store** | **High** (enabler) | Correct limits across instances → **unblocks horizontal scale (O4)** | Adds infra (Redis) + config; ops decision. |
| **O4** | `cluster`/PM2 to use all cores per instance **+** multiple Render instances behind a load balancer | **Critical** for >1k | **~N× throughput** (N = cores × instances) | Requires O3 first (else limiter state splits) + infra; ops decision. |
| **O5** | Supabase **transaction-mode pooler** (pgBouncer) + sized compute add-on | **Critical** for >500u writes | Removes the connection-exhaustion wall (the first hard failure under write load) | Supabase dashboard / billing change; ops. |
| **O6** | Widen FreeBusy TTL + cron pre-warm next N days for active hosts | **Medium** | Cold date-picker **1–2.5 s → ~150 ms** for Google vendors | Behavior change (staleness window) + a new cron; review. |
| **O7** | Short-TTL `Cache-Control` + CDN/edge cache on public reads (`GET /api/bookings/service/:id`, `GET /api/host/:username`, listings) | **Medium–High** at launch | Offloads the highest-RPS surface from the single core + DB; near-zero latency on cache hits | Changes response caching semantics; must verify no per-user/auth variance leaks; edge config is ops. |
| **O8** | Observability before launch: Sentry (errors), external uptime, metrics (CPU/mem/DB latency/slow queries/connections), alerts | **Medium** | Not latency — **operability**; required to run safely at scale | Account/infra setup; ops. |

### Suggested exact patches (apply after review)

**O7 — public read caching (illustrative):**
```js
// in the GET /api/bookings/service/:id and GET /api/host/:username handlers, before res.json:
res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
```
*Confirm these responses contain no per-viewer/auth-specific fields before enabling.*

**O5 — pooler:** point the server's Supabase access at the **transaction pooler** connection (port 6543 / `...pooler.supabase.com`) for the API workload; keep the direct connection for migrations only.

## Recommended target architecture (for the "leave it alone for a year" goal)
Aligns with the growth path in `CAPACITY_ESTIMATE.md` stack C:
- **Edge:** Cloudflare — CDN, DDoS, bot protection, asset + public-read caching (O7).
- **App:** stateless, multiple replaceable instances, clustered per box (O3+O4). No in-memory correctness state.
- **Cache:** Redis — availability lookups, rate limiting (O3), config, temporary booking state.
- **DB:** Supabase Pro — indexing verified (O2), transaction pooler (O5), PITR + automated backups, weekly restore test.
- **Observability:** Sentry + uptime + metrics + alerts (O8).

## Priority order to reach each scale
1. **To ~1,000 reliably:** O1 + O7 + O5 (pooler) on Render Standard + Supabase Pro.
2. **To ~5,000:** add O3 + O4 (Redis + clustering + 2–3 instances) + O2.
3. **To 10,000:** add autoscaling + edge offload (O7 at CDN) + Supabase compute sizing, **proven on staging** with distributed JMeter.

Every gain above is an estimate until measured per `STAGING_SETUP.md`.
