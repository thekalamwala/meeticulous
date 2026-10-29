# Explore Rebuild — PROGRESS

Branch: `explore-service`. Goal: replace profile-ranking `/explore` with a **service**
listing ranked by a precomputed quality score (0–100), new UI, cache-first.

---

## Phase 0 — Recon (DONE)

### Files in the current Explore path
| File | Role |
|---|---|
| `client/src/pages/Explore.jsx` | Public page. Currently lists **profiles** (`VendorCard`), `COMING_SOON=false`. Mock featured/collections rows still wired to empty stubs. Sort dropdown commented out. |
| `client/src/components/guest/VendorCard.jsx` | Current profile card (to be superseded by `ServiceCard`). |
| `client/src/components/guest/CategoryFilter.jsx` | Category rail. |
| `client/src/services/api.js` | `getExploreVendors/Featured/Categories/Collections/Sponsored`. |
| `server/routes/exploreRoutes.js` | `/api/explore*`, `searchLimiter` on `/`. |
| `server/controllers/exploreController.js` | `listVendors` = `profiles ⋈ services!inner`, ranks by `profiles.updated_at`. Featured/collections/sponsored = `[]` stubs. Admin paid-placement handlers (untouched). |
| `server/utils/searchSanitize.js` | `sanitizeLikeTerm` (shared, reuse). |
| `server/services/responseCache.js` + `server/utils/httpCache.js` | Redis-backed read-through cache + `setPublicCache`. |
| `server/middleware/security.js` | `searchLimiter` (30/min/IP). |
| `server/tests/integration/exploreList.int.test.js` | Existing explore controller test. |

### The 3 shipped protections (KEEP, build on — do NOT rebuild)
1. **`responseCache` 120s** wrapping `listVendors` (fail-open, Redis L1). New endpoint reuses it; cache key already includes `category|service|q|page|limit`.
2. **`searchLimiter` 30/min/IP** on `exploreRoutes`. Reuse on any new route. Change: fail-soft (serve stale cache on limit instead of hard 429) — TODO.
3. **`sanitizeLikeTerm` + min-2-char** `q` hygiene. Reuse for every new query path.

### Production data reality (measured 2026-07-11, DB `ayjhlwyzszykqtnaktpb`)
- **57 profiles / 50 hosts / 38 services (35 active) / 30 bookings ever / 0 reviews.** 1.46 services/host.
- booking status ∈ {cancelled, completed, confirmed, no_show}. **No "who cancelled" field.**
- booking_type ∈ {both, offline_only, online_only, null}. **No instant-book flag.**
- **No** views/impressions table → view→booking conversion uncomputable.
- **No** response-time / messaging data → response rate & speed uncomputable.
- services photos = single `thumbnail_url` (no gallery). No service `tags` column.
- `availability` = `weekly_schedule` jsonb + `blocked_dates` + `updated_at` (no discrete slot rows).
- `kyc_submissions.status` (host-verify proxy), `payout_requests` (payout-gate proxy) exist.
- `discovery_events` exists but unused; shape ≠ spec's `search_events` (no filters/page/results). New tables added instead.
- Extensions: `pg_cron`, `pg_trgm`, `btree_gin` **available but NOT installed**. `pg_stat_statements`, `btree_gist`, `pgcrypto` installed.

**Consequence:** ~50/100 rubric marks reference data that does not exist. Score is currently
driven by listing-quality (15) + booking counts (~17) + availability (10) + a little reliability.
The scoring function is built to the full rubric shape but **degrades every absent input to 0
and records availability in `score_components`**, so scores auto-improve as reviews/bookings/
data land — no rewrite needed later.

---

## Scope decision (per spec "make reasonable decisions and note them")

Reconciling three prompts + the founder-approved plan
(`~/.claude/plans/we-are-launching-explore-harmonic-bachman.md`, which explicitly defers
pg_trgm/FTS/MV as *"pointless at 27 rows"*) against real data:

### BUILD now
- Services-based Explore + `compute_service_score()` (real columns only) + `service_scores`,
  `search_events`, `explore_clicks` tables + backfill.
- Rank = `quality_score × penalties` (no-query) / `relevance × quality_score × penalties` (search).
  Relevance tiers computed on the small candidate set — no tsvector index needed at this scale.
- 12/page pagination, 96-cap math kept (future-proof; only ~3 pages have data today).
- New `ServiceCard` + `Pagination` + skeleton + empty state + debounced client search.
- Fire-and-forget `search_events` + `explore_clicks` (single INSERT, no buffer — 30 bookings
  of lifetime traffic does not need batching).
- Reuse the 3 protections. Zero duplicate cache/limiter/sanitizer.

### DEFER (with tripwire — add only when the tripwire trips)
| Deferred | Why pointless now | Tripwire |
|---|---|---|
| MV `explore_top_96` + REFRESH cron | 35 services, 3 pages; refresh load > query load it saves | active services > ~2k **or** no-query EXPLAIN > 20ms |
| `search_cache` table (L2) | Redis L1 (120s) already absorbs repeats; measure hit-rate first | Redis hit-rate < 80% under real search traffic |
| pg_cron 15min/4h cadence | recompute-on-write + 1 nightly is plenty at 35 rows | services > ~500 **or** compute run > 10s |
| Batched in-memory write buffer | single async INSERT is sub-ms at this volume | search_events insert rate > ~5/s sustained |
| Read-replica routing / Supavisor split | org plan has **no read replica**; `dbRead/dbWrite` seam left as one-line-flip stub | replica added to plan **or** primary read CPU sustained > 50% |
| tsvector/GIN + pg_trgm + BRIN indexes | seq-scan over 35 rows is microseconds; indexes add write cost | Explore search EXPLAIN > 50ms (≈ low-thousands of services) |

### Small decisions
- Client search: debounce **400ms**, min **3 chars** client-side; **server stays min 2** (don't
  break existing behavior). AbortController cancels in-flight.
- Migrations applied to **staging first** (`xwvciqkayammbvsidqig`), verified, then prod is the
  deploy step — matches the "keep code-side fallback until confirmed on both DBs" workflow.

---

## Phase log
- [x] Phase 1 — DB scoring engine `v3.72_explore_service_scoring.sql` **applied to STAGING + backfilled**.
      6 active services scored 11–26 (avg 18), all in [0,100], effective ≤ quality, breakdown
      sums verified (e.g. "Audit" 26 = B7+2 · C8 · D5 · E4, penalty ×1). `services.primary_category`
      is MISSING on staging (pre-v3.60 drift) → `mD_cat` uses `category` alone, robust on both DBs.
      Prod apply is the deploy step.
- [x] Phase 2 — `listServices` replaces `listVendors` (old profile-ranking path deleted).
      One DB read on `from('services')` (embed profiles!inner + service_scores), ranked in
      memory by `effective_score × relevance`, 96-cap, 12/page. Reuses `responseCache`
      (page-independent key now), `searchLimiter` (+ fail-soft `serveStaleOrEmpty` via new
      `responseCache.peek`), `sanitizeLikeTerm`. Added `POST /explore/click` (sendBeacon) +
      fire-and-forget `search_events` logging. Data path verified on staging (ranks 26→3.3,
      penalties applied).
- [x] Phase 3 — UI: `ServiceCard` (4:3 cover, host row, rating, price, New / Available-this-week
      badges, click logging), `Pagination` (crawlable `<Link>`, rel prev/next, ≤8 pages,
      scroll-top), `Explore.jsx` rewritten to services + debounced (400ms/min-3) search +
      AbortController + keep-previous-while-loading + skeleton + empty state. `api.js`:
      `getExploreServices` + `logExploreClick`.
- [x] Phase 4 — server `npx jest`: **1304/1304 pass** (8 new explore tests: ranking order,
      relevance gate, sanitize, 96-cap pagination, 400/500). client `npm run build`: **clean**.

## Verification
- DB: staging backfill 6 services scored 11–26; breakdown sums verified; ranking query
  ordered 26→3.3 with penalties applied. All scores ∈ [0,100], effective ≤ quality.
- Server: full suite green incl. new `exploreList.int.test.js` (services shape, rank-by-score,
  relevance exclusion, sanitize `.or(title/description/category)`, min-2 ignore, 12×8 pagination).
- Client: production build succeeds, no import/JSX errors.
- **Live browser check: PASSED** — ran local server against staging (dotenv preload of
  `.env.staging`, `server/.env` untouched) + Vite, loaded `/explore`:
  - 6 cards rendered ranked by score (Audit 26 → Book A Sloth Demo 3.3); category chip, host+
    avatar, area, "Available this week", price, "New" badge on the <30d host, correct URLs.
  - PostgREST embed (services→service_scores + profiles!inner) resolves — the one path mocks
    couldn't cover.
  - Debounced search "seo" → 1 result (relevance gate), URL `/explore?q=seo` (shareable),
    filter pill + clear button.
  - Fire-and-forget analytics landed on staging: `search_events` (no-query n=6, seo n=1),
    `explore_clicks` (rank 1 = SEO card via sendBeacon). No console errors.
  - (Prod still needs the migration below before its own live run — `server/.env` → Mumbai.)

## Deploy steps (do at cutover)
1. Apply `server/migrations/v3.72_explore_service_scoring.sql` to **prod** (Mumbai) in the
   Supabase SQL editor; it self-backfills (`select recompute_all_service_scores()`).
2. Deploy server (Render — auto-deploy is often OFF, may need Manual Deploy) + client (Vercel).
3. Wire a recompute trigger (see "Deferred/decisions"): simplest = call
   `recompute_all_service_scores()` from the existing booking/review write paths, or a lightweight
   cron. Until then scores are static from backfill.
4. Then run the live browser check on `/explore`.

## Notes / follow-ups
- `client/src/components/guest/VendorCard.jsx` is now UNUSED (was the profile card) — safe to
  delete; left in place to avoid churn (a comment in `ServiceCategoryCard.jsx` references it).
- Stack is Vite/React (not Next): `next/image` → `<img loading="lazy">`; ISR/CDN → the
  `Cache-Control` + Redis layer already present.
- Recompute automation SHIPPED (v3.73, both DBs): on-write DB triggers recompute the single
  affected service on booking/review writes (exception-guarded — can't break a booking) + weekly
  `pg_cron` full pass Fri 23:30 IST (`0 18 * * 5` UTC) to age time-window flags. The 15-min/4-hourly
  cadence stays deferred (still pointless at this scale) — this is the minimal freshness layer.
- `search_events`↔`explore_clicks` correlation is best-effort (click carries no event id) to keep
  render non-blocking; wire the id through if funnel analysis needs it.
