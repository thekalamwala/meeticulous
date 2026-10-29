# Scaling Recommendations — Book A Sloth

_2026-06-18. Derived from `PERFORMANCE_AUDIT.md` + the JMeter baseline (`BENCHMARKS.md`). Prioritized by impact-to-effort._

## Production ceiling today
- **Single-process Node** (`server.js`, no clustering) → one CPU core. On **Render Starter (~0.5 vCPU / 512 MB)** the event loop saturates well before the dev laptop's 12 cores would.
- **Every request hits Supabase in `ap-northeast-1` (Tokyo)** over the network. Round-trip latency — not Node CPU — dominates response time at low/medium load (the baseline shows this clearly).
- **Per-IP rate-limit + slow-down state is in-memory**, scoped to one process. The moment you run >1 instance, limits are per-instance (not global).

## Optimization opportunities (highest impact first)

### 1. Replace `supabaseAdmin.auth.getUser(token)` with local JWT verification — biggest single win
`middleware/authMiddleware.js` makes a **~175 ms network call to Supabase Auth on every authenticated request** (and `/auth/me` fires on every client mount). Verify the Supabase JWT **locally** with `SUPABASE_JWT_SECRET` (`jsonwebtoken.verify`) — ~1 ms, no network. Cuts the fixed cost off every authed endpoint. Keep a fallback to remote `getUser` only when local verify fails.

### 2. Cache/serve public reads at the edge
Service detail, host profiles, and category/service listings are public + slow-changing. Put a CDN/edge cache (Vercel/Cloudflare) or short-TTL HTTP `Cache-Control` in front of `GET /api/bookings/service/:id` and `GET /api/host/:username`. These are the highest-RPS surface (launch-day spike) and are trivially cacheable.

### 3. Keep the FreeBusy cache; widen + warm it
`availabilityService` already caches Google FreeBusy (`FREEBUSY_CACHE_TTL_MS`, 60 s). A cold `available-slots` is ~1–2.5 s vs ~150 ms warm. Consider a longer TTL (busy intervals change slowly) and a cron that pre-warms the next N days for active hosts, so date-picker clicks are never cold.

### 4. Reduce per-request Supabase round-trips
`createBooking` and `available-slots` issue 3–5 separate queries. Where possible, collapse into a single RPC/`select` with embedded relations, and narrow `select(...)` column lists. Each saved round-trip is ~50–200 ms (Tokyo).

### 5. Horizontal scale needs a shared limiter + session store
Before running multiple Render instances behind a load balancer:
- Move `express-rate-limit` / `express-slow-down` to a **shared store (Redis)** — otherwise limits multiply per instance.
- The OTP store is already DB-backed (good). Confirm no other per-process in-memory state is relied on for correctness.
Then Render horizontal autoscaling (or a larger instance) lifts the single-core ceiling.

### 6. Supabase tier + pooler
Sustained concurrency will hit **Supabase connection/pooler limits before Node saturates** (the audit's prediction; confirm at the 100u read level in `BENCHMARKS.md`). Use the transaction-mode pooler (pgBouncer) for the API, watch the Supabase dashboard's connection + CPU graphs under load, and size the Supabase compute add-on for launch.

## Launch-day readiness checklist
- [ ] #1 local JWT verify shipped (removes the ~175 ms authed-request floor)
- [ ] #2 edge cache on public reads (slots/profile/service)
- [ ] Render instance sized above Starter, or horizontal scale + shared rate-limit store (#5)
- [ ] Supabase compute/pooler sized; connection graph watched under a staging 500u run
- [ ] A real **staging** environment + a **separate test Supabase project** so 500u/1000u can be run safely (today's baseline is localhost → prod Supabase, which can't represent prod capacity)

## Getting trustworthy capacity numbers
The localhost baseline is a **relative** guard, not a capacity number (one machine generates + serves, and Supabase is the real Tokyo DB). To know true prod capacity:
1. Stand up a prod-sized **staging** server + a **test Supabase project**.
2. Point JMeter at it (`config/staging.properties`, `npm run perf:staging`).
3. Run scenarios C (500u) and D (1000u) — already authored — to find the real knee/failure point.
