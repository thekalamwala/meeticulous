# BOTTLENECK_ANALYSIS.md — Book A Sloth

_Phase 5 — Bottleneck Analysis. 2026-06-18._
_Each item: the failure surface, the exact code/query evidence, and why it bites under load. Latency attribution uses the measured baseline (`performance/docs/BENCHMARKS.md`). Items needing `EXPLAIN ANALYZE` / live metrics are flagged "confirm on staging" — they cannot be proven without the isolated environment (`LOAD_TEST_BLOCKERS.md`)._

## Severity-ranked

| # | Bottleneck | Severity | First binds around |
|---|---|---|---|
| BN1 | Auth `getUser` network call per authed request | **Critical** | every authed RPS |
| BN2 | Single Node process / no clustering | **Critical** | ~1 core saturation |
| BN3 | Supabase connection / pooler ceiling | **Critical** | write bursts, few-hundred users |
| BN4 | Per-request sequential Supabase round-trips | **High** | slots/booking latency at all loads |
| BN5 | In-memory rate-limiter & slow-down state | **High** | the moment you run >1 instance |
| BN6 | Cold FreeBusy path (1–2.5 s) | **Medium** | Google-connected vendors, cache miss |
| BN7 | Security middleware CPU per request | **Medium** | high RPS on the single core |
| BN8 | No edge/HTTP caching on public reads | **Medium** | launch-day read spike |

---

### BN1 — Auth verification is a network round-trip, every request
- **Route(s):** every endpoint behind `protect` — `/auth/me` (fires on every client mount), dashboard, bookings list, payouts, admin.
- **Evidence:** `server/middleware/authMiddleware.js:22` — `await supabaseAdmin.auth.getUser(token)`. No local JWT verify, no per-request cache.
- **Cost:** ~175 ms measured fixed tax per authed request (`performance/docs/PERFORMANCE_AUDIT.md:10–11`).
- **Why it bites:** under load this both **adds latency** to every authed call and **pushes RPS onto Supabase Auth**, a third-party with its own limits. At 1,000 authed req/s that's 1,000 getUser calls/s to Supabase.
- **Fix:** local JWKS/ES256 verification (see `OPTIMIZATION_REPORT.md` O1). Security-critical → its own task (keys are asymmetric; `SUPABASE_JWT_SECRET` unset).

### BN2 — Single process, one core
- **Evidence:** `server/server.js` boots one process; no `cluster`/PM2 fork.
- **Why it bites:** all CPU work (JSON parse/serialize, regex middleware, TLS) runs on one core. On Render Starter (~0.5 vCPU) the event loop saturates well before the DB does. Throughput cannot use multiple cores.
- **Fix:** `cluster`/PM2 to use all cores per instance **and** horizontal instances behind a load balancer (O4). Requires BN5 fixed first.

### BN3 — Supabase connection / pooler ceiling
- **Evidence:** `server/config/supabase.js:24–45` — supabase-js over PostgREST/HTTP, **no transaction pooler configured**. `createBooking` does real inserts against the live DB.
- **Why it bites:** sustained concurrency → concurrent in-flight queries → Postgres/pooler connection slots. **Supabase Free exhausts first** (shared compute, limited pooler). This is typically the *first hard failure* under write load, not Node CPU.
- **Confirm on staging:** watch the Supabase dashboard connection + CPU graphs during the 500u/1k stages.
- **Fix:** transaction-mode pooler (pgBouncer) + sized Supabase compute (O5).

### BN4 — Sequential Supabase round-trips per request
- **Routes/queries:**
  - `POST /api/bookings` — `server/controllers/bookingController.js:204–217` runs 4 parallel reads, then `validateSlot` (`bookingController.js:234`), then insert (`:344`). Measured **P95 1507 ms** at 5u (`BENCHMARKS.md:16`).
  - `available-slots` — `server/services/availabilityService.js` issues 3+ queries per lookup.
- **Why it bites:** each query is a separate round-trip; latency = sum of hops. On localhost (Tokyo) this is the dominant cost; co-located it shrinks but still multiplies DB query count ~4–5× per request (amplifies BN3).
- **N+1 / index check — confirm on staging:** run `EXPLAIN ANALYZE` on the slot-availability and booking-conflict queries. Known indexes (memory/schema): `services_slug_unique_idx`, `services_host_slug_idx`, and the `bookings_no_overlap` GiST exclusion index (`bookingController.js:372`). Verify the availability query filters (`host_id`, `scheduled_at` range) are index-backed and not sequential scans.
- **Fix:** collapse multi-read into a single RPC / embedded `select`; narrow column lists (O2).

### BN5 — In-memory rate-limiter / slow-down
- **Evidence:** `server/middleware/security.js:45–169` — `express-rate-limit` / `express-slow-down` default in-memory stores; 10 limiters + speed limiter, all per-IP, per-process.
- **Why it bites:** state lives in one process. Run 3 instances → effective limits are 3× intended (each instance counts independently), silently weakening abuse protection exactly when you scale out.
- **Fix:** shared Redis store before any horizontal scale (O3). Blocks BN2's horizontal fix.

### BN6 — Cold FreeBusy path
- **Evidence:** `server/services/availabilityService.js:128–163`; cache hit ≈150–200 ms, miss ≈1–2.5 s (live Google FreeBusy). TTL `FREEBUSY_CACHE_TTL_MS` default 60 s.
- **Why it bites:** for Google-connected vendors, every cache miss on the date-picker is a 1–2.5 s Google round-trip; also subject to Google per-project quota under load.
- **Fix:** longer TTL + cron pre-warm next N days for active hosts (O6). Cache already has stale-on-failure fallback (good).

### BN7 — Security middleware CPU per request
- **Evidence:** `server/server.js:64–68` — `helmet`, `permissionsPolicy`, `hpp`, `sanitizeBody`, `blockSuspiciousRequests` run regex/scan work on every request body/path.
- **Why it bites:** on the single core (BN2), this CPU is additive to every request; at high RPS it eats into the same core serving DB I/O callbacks. Small per-request, real in aggregate.
- **Confirm on staging:** profile CPU flame graph at the RPS knee. **Fix:** keep (security matters); offload volume via edge cache (BN8) so fewer requests reach it.

### BN8 — No edge/HTTP caching on public reads
- **Routes:** `GET /api/bookings/service/:id`, `GET /api/host/:username`, category/service listings — public, slow-changing, highest-RPS launch surface.
- **Evidence:** no `Cache-Control`/CDN in front (`server.js` sets none on these); `performance/docs/PERFORMANCE_AUDIT.md:26` confirms no app cache beyond FreeBusy.
- **Why it bites:** every public read travels the full stack (middleware → auth-optional → Supabase). Cacheable responses are recomputed every time.
- **Fix:** short-TTL `Cache-Control` + CDN/edge (O7).

---

## Evidence still required (only obtainable on staging)
The following are **predicted** from code but **not yet observed** — they are the explicit purpose of the staging load runs:
1. The single-core **RPS knee** (where P95 crosses 500 ms / 1 s).
2. **Supabase connection exhaustion** point under write load (BN3).
3. **Lock contention** on `bookings_no_overlap` for hot slots (BN4).
4. **Memory growth / leaks** over a 30-min sustained run (BN2/BN7).
5. Whether any hot query does a **sequential scan** (`EXPLAIN ANALYZE`, BN4).

→ Run order and targets in `STAGING_SETUP.md`; fixes and expected gains in `OPTIMIZATION_REPORT.md`; go/no-go per scale in `FINAL_VERDICT.md`.
