# SEO Engine P1.5 — Google Search Console Integration (Design Spec)

_Created: 2026-09-08 • Owner: Shubham • Status: approved design, pre-implementation_
_Branch: `feat/seo-gsc-integration` • Builds on: P1 SEO Audit Engine (PR #960/#963/#964, live)_
_Companion: [`seo-gsc-sop.md`](../../seo-gsc-sop.md) (the manual routine this automates), [`seo-aeo-geo-plan.md`](../../seo-aeo-geo-plan.md) Phase 4._

## Objective

Automate the weekly manual GSC routine (`seo-gsc-sop.md`) by pulling Google Search Console's real data into the SEO audit: per-URL **index-coverage states** (why pages aren't indexed) + **search performance** (impressions/clicks/CTR/position), and turning coverage anomalies into prioritized `gsc.*` issues alongside the crawler's own findings.

## Decisions (locked)
- **Both APIs:** URL Inspection (per-URL coverage) + Search Analytics (performance).
- **GSC anomalies → prioritized `seo_issues`** (`gsc.*` rule group) — the SOP-escalation automation.
- **Creds:** Render env vars `GSC_SA_KEY` + `GSC_PROPERTY` (single non-rotating service-account credential; not admin-editable).

## Hard prerequisite (user-provisioned; code no-ops until present)
A **service account** (separate from the user-facing Calendar OAuth — that stays untouched; adding `webmasters` scope there would regress its verification): GCP project → enable Search Console API → create SA + JSON key → add the SA email as a user on the `meeticulous.com` GSC property → set `GSC_SA_KEY` (JSON) + `GSC_PROPERTY` (`sc-domain:meeticulous.com`) on Render. Claude never handles the key.

## Architecture

```
daily gsc-sync (runIfDue)                          nightly seo-crawl (existing)
  gscSync.run()                                      seoCrawler.run()
   ├─ if !GSC_SA_KEY → no-op (log, return)            ├─ buildContext loads seo_gsc_urls → ctx.gscByUrl
   ├─ auth: google.auth.GoogleAuth (webmasters.ro)    ├─ rules/gsc.js emits gsc.* issues per page
   ├─ URL Inspection per crawled URL (throttled)         from ctx.gscByUrl (coverage anomalies)
   ├─ Search Analytics (1 batched query, by page)     └─ issues persisted in seo_issues (crawl-scoped)
   └─ upsert seo_gsc_urls (url PK)
                       │
                 seo_gsc_urls  ←── /admin/seo "Search Console" tab (coverage + performance)
```
**Clean split: `gsc-sync` writes data (`seo_gsc_urls`); the crawl turns that data into issues.** GSC issues are crawl-scoped (refreshed each crawl from the last sync), fitting the existing `seo_issues.crawl_id` model without coupling the two cadences.

## Reuse vs net-new
| Concern | Reuse | Net-new |
|---|---|---|
| Google SDK | `googleapis@173` (`google.searchconsole('v1')` — no dep bump) | separate `google.auth.GoogleAuth` SA client (NOT `config/google.js`) |
| Secret handling | env pattern (like other single creds) | `GSC_SA_KEY`/`GSC_PROPERTY` env |
| Job runner | `SCHEDULED_JOBS` + `runIfDue` | 1 `gsc-sync` entry |
| Rule engine | registry + runner + `buildContext`/`runRules` | `rules/gsc.js` group + registry keys + ctx.gscByUrl load |
| Admin API/UI | GST/SEO controller+service+api+tab patterns | `getGsc` + `adminSeoGsc()` + Search Console tab |
| Migrations | `migrate.js`, `vN.NN` idempotent, RLS-on | `v3.146_seo_gsc_urls.sql` |

## Modules (`server/services/seo/`)
- **`gscClient.js`** — `isConfigured()` (GSC_SA_KEY && GSC_PROPERTY present); `getClient()` → `google.searchconsole({version:'v1', auth})` via `new google.auth.GoogleAuth({ credentials: JSON.parse(GSC_SA_KEY), scopes:['https://www.googleapis.com/auth/webmasters.readonly'] })`, or `null` if unconfigured; `siteUrl()` → GSC_PROPERTY. Never throws on missing creds.
- **`gscSync.js`** — `run()`: if `!isConfigured()` → log + return `{skipped:true}`. Else: seed URL list from the latest crawl's `seo_crawl_pages` (indexable) capped at `GSC_INSPECT_MAX` (default 2000, quota-safe); for each, `urlInspection.index.inspect({inspectionUrl, siteUrl})` throttled (~small delay, ≤600/min); one `searchanalytics.query({siteUrl, startDate: today-28, endDate: today, dimensions:['page'], rowLimit:25000})`; merge + upsert `seo_gsc_urls`. Guarded per-URL (one failure doesn't abort the sync). Records a lightweight run summary.

## Database — `server/migrations/v3.146_seo_gsc_urls.sql` (idempotent, RLS-on/no-policy, both DBs)
```
seo_gsc_urls(
  url text PRIMARY KEY,
  coverage_state text,          -- URL Inspection coverageState/verdict
  indexing_state text,
  google_canonical text,
  user_canonical text,
  robots_txt_state text,
  last_crawl_time timestamptz,  -- Google's last crawl of the URL
  impressions int DEFAULT 0,
  clicks int DEFAULT 0,
  ctr numeric DEFAULT 0,
  position numeric,
  inspection_raw jsonb DEFAULT '{}'::jsonb,
  analytics_raw jsonb DEFAULT '{}'::jsonb,
  last_synced timestamptz DEFAULT now()
)
```
(No crawl_id — URL-keyed, survives crawls, own cadence.)

## `gsc.*` rules (`rules/gsc.js`) — anchored to SOP escalation triggers
`buildContext` loads `seo_gsc_urls` into `ctx.gscByUrl` (Map url→row). `check(pageData, ctx)` reads `ctx.gscByUrl.get(p.url)`; emits nothing if absent (creds unset / not yet synced → graceful). Rules:
- `gsc.crawled_not_indexed` — coverage = "Crawled – currently not indexed" (P2; P1 if a commercial/marketing page).
- `gsc.google_chose_different_canonical` — `google_canonical` ≠ url/user_canonical (P1 — SOP "escalate immediately").
- `gsc.soft_404` — GSC verdict soft-404 (P1; corroborates the crawler's heuristic).
- `gsc.indexable_mismatch` — our crawl `indexable=true` but GSC coverage = not indexed (P2 — reconciliation signal).
- `gsc.discovered_not_indexed` — "Discovered – currently not indexed" (P4 — usually crawl-budget, low; SOP says watch, don't act).
Registry `category: 'indexability'` (feeds the indexability health score). Each declares severity/confidence/title.

## Job wiring — `server/server.js` `SCHEDULED_JOBS`
```js
{ name: 'gsc-sync', min: Number(process.env.GSC_SYNC_INTERVAL_MIN) || 24 * 60, run: () => require('./services/seo/gscSync').run() },
```

## Admin API + dashboard
- `seoAuditService.listGscUrls(filters)` → `seo_gsc_urls` (order by impressions desc / coverage). Controller `getGsc` gated `requireAdmin('seo.manage')`, route `GET /api/admin/seo/gsc`. `adminSeoGsc()` in `client/src/services/api.js`.
- `AdminSeo.jsx`: add a **"Search Console"** tab — table of url / coverage_state / impressions / clicks / position, + a "last synced / not configured" banner. The `gsc.*` issues already appear in the existing Issues tab.

## No-op / degradation
Everything is schema-fallback + creds-optional: `gscSync` no-ops when unconfigured; `buildContext` GSC load fails soft (empty map) if the table is missing or unsynced; `gsc.*` rules emit nothing without data. So this ships safely and lights up the moment the env vars land — no coordinated cutover.

## Testing
- `gscClient`: isConfigured true/false; getClient null when unset (no throw).
- `gscSync`: mock the searchconsole client → asserts upsert of merged inspection+analytics rows; no-op when unconfigured; per-URL failure isolation.
- `rules/gsc.js`: table-driven per rule against a ctx.gscByUrl fixture; emits nothing when absent.
- `buildContext`: loads gscByUrl (supabase mock); fails soft on missing table.
- controller `getGsc` (supabase mock); client vitest for the Search Console tab (mock api).
- Full server jest + client `vitest run` before PR (deploy gate).

## Out of scope (later)
- URL "Request indexing" (separate ~10/day quota, not in the audit API) — stays manual per SOP §3.
- Query-level (keyword) analytics dashboard — P2+.
- Bing Webmaster.
