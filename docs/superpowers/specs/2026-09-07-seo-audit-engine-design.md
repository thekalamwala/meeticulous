# SEO Audit Engine — Design Spec (Phase 1)

_Created: 2026-09-07 • Owner: Shubham • Status: approved design, pre-implementation_
_Branch: `feat/seo-audit-engine` • Companion docs: [`seo-aeo-geo-plan.md`](../../seo-aeo-geo-plan.md), [`seo-gsc-sop.md`](../../seo-gsc-sop.md)_

## Objective

Stand up a **read-only SEO Audit Engine**: a crawler + deterministic rule engine + prioritized issue dashboard at `/admin/seo`. It automates the manual weekly [`seo-gsc-sop.md`](../../seo-gsc-sop.md) escalation checks and continuously surfaces on-page / technical / indexability issues across the site's own indexable URLs.

Phase 1 is the **foundation** for the larger "SEO Autopilot" roadmap. It writes **nothing** to live SEO fields — it cannot regress production SEO. Later phases add Claude analysis, auto-fix, approval queue, and verification on top of these tables and modules.

## Scope

### In (P1)
- Nightly + on-demand crawl of all indexable URLs (seeded from the existing sitemap).
- A DB-scan pass for data-level meta issues (dup/missing/oversized `seo_*`) without HTTP.
- Deterministic rule engine → issues, mapped to the GSC SOP escalation list + the plan's meta rules.
- Prioritization (P0–P4) + per-category health scores (all deterministic, explainable).
- Admin dashboard: overview (scores + crawl stats), prioritized issue list, crawled-pages list, detail drawers, mute/ignore.
- 5 new tables, 1 migration, an admin API, one nightly job line.

### Out (roadmap — explicitly NOT P1)
Claude/AI analysis · auto-fix / any write to `seo_*` · approval queue · verification re-crawl · static-page override table · internal-link *insertion* · cannibalization / embeddings · redirects / migration planner · Core Web Vitals / PSI · GSC Search Console API · hreflang (site is single-locale).

### Roadmap context
- **P1** — Audit + Dashboard (read-only). ← this spec
- **P1.5** — GSC Search Console API as a second data source (isolated service account, `webmasters.readonly`).
- **P2** — Shared `callClaude` wrapper + AI titles/meta/alt on DB pages + auto-apply-safe + approval queue + re-crawl verify + change log + rollback.
- **P3** — Static-page (route-keyed) SEO override table consumed by `Seo.jsx` + `prerender.mjs` + internal-link recommender + schema opportunities.
- **P4** — Cannibalization (Voyage), redirect/migration planner, CWV/PSI, `llms.txt` auto-gen, crawl sampling (only past ~2k URLs).

## Reuse vs net-new

| Concern | Reuse (exists) | Net-new (P1) |
|---|---|---|
| URL inventory | `server/services/sitemapService.js` (DB-driven, visibility rules) | seed adapter |
| Nightly scheduling | `server/utils/jobRunner.js` `runIfDue` + `SCHEDULED_JOBS` in `server.js`; `jobLock.runLocked` | `{name:'seo-crawl'}` entry (1 line) |
| Meta resolution truth | `client/src/utils/seo.js` resolvers; `server/controllers/prerenderController.js` bot shells | crawler reads rendered output, not resolvers |
| Admin page/nav/perm | `client/src/components/admin/adminNav.js` NAV; `seo.manage` (defined, unused, in marketing role) | NAV item + route + page |
| Admin API pattern | GST: `adminRoutes.js` → `gstRoutes.js` → `gstAdminController.js`, `requireAdmin('gst.manage')` | `seoRoutes.js` → `seoAdminController.js`, `requireAdmin('seo.manage')` |
| Drawer UI pattern | `client/src/components/admin/SeoDrawer.jsx` | issue/page detail drawers |
| Migrations | `server/scripts/migrate.js`, `v3.NN_*.sql` idempotent | `v3.145_seo_audit.sql` |
| Crawler / audit / issue store | — nothing exists — | all of it |

## Architecture / data flow

```
nightly (runIfDue, 24h)  OR  POST /api/admin/seo/crawl (admin)
  → seoCrawler.run()                         [runLocked 'seo-crawl' — nightly+manual can't collide]
     1. seed     ← sitemapService: all indexable host/service/blog/static URLs
     2. dbScan   ← SQL over services/profiles/blogs: dup/missing/oversized seo_* (no HTTP)
     3. fetch    → each URL, bot UA, concurrency ~4, timeout, retry-once, politeness delay
     4. parse    → head + signals (title/meta/canonical/robots/h1/links/images/jsonld/words)
     5. rules    → rules/*.js pure fns → issues[]
     6. prioritize → severity P0–P4 + score (Impact×Confidence×Scope÷Effort, config weights)
     7. score    → per-category health 0–100, each point traceable to issues
     8. persist  → seo_crawls + seo_crawl_pages + seo_issues + seo_score_snapshots
  → GET /api/admin/seo/* reads the latest crawl
```

Design principles: every module has one purpose and a clear interface; rules/prioritize/score are **pure** and table-testable; Claude is absent (all P1 signals are deterministic).

## Server modules (`server/services/seo/`)

- **`seoCrawler.js`** — orchestrator. `run({ trigger })` → seeds, runs dbScan + fetch/parse over the URL set, invokes the rule engine, prioritizes, scores, persists a crawl. Wrapped in `runLocked('seo-crawl', …)`. Concurrency-limited (pool ~4, matching prerender). Records progress on the `seo_crawls` row.
- **`seoFetch.js`** — `fetch(url)` → `{ status, finalUrl, redirectChain[], responseMs, contentType, headers, body }`. Bot User-Agent (so host/service resolve prerendered meta via edge→`/prerender`; static pages serve `dist` HTML). Timeout + one retry. Politeness delay between requests.
- **`seoParse.js`** — `parse(html, headers)` → normalized page signals: `title`, `metaDescription`, `canonical`, `robots` (meta + `X-Robots-Tag`), `h1[]`, `headings[]`, `links{internal[],external[]}`, `images[{src,alt}]`, `jsonLd[]` (parsed), `wordCount`, `viewport`. Parser dependency resolved in the plan (prefer an already-installed HTML parser; else add `node-html-parser`).
- **`dbScan.js`** — `scan()` → data-level issues via SQL over `services` / `profiles` / `blogs`: duplicate `seo_title` / `seo_description` across rows, missing meta, length violations. Cheaper and exact vs rendering each row.
- **`rules/`** — one file per group, each exporting pure `(pageData, ctx) => issue[]`:
  - `technical.js`, `onpage.js`, `indexability.js`, `links.js`, `images.js`, `structuredData.js`, `sitemap.js`.
  - `ctx` carries cross-page state (all crawled URLs, sitemap set, internal-link graph, homepage title) so rules like orphan-detection and prerender-regression work.
- **`prioritize.js`** — pure. `prioritize(issue) => { severity: P0..P4, impact, effort, confidence, score }`. Weights + severity thresholds in one exported config object.
- **`healthScore.js`** — pure. `score(issues, pageStats) => { overall, technical, onpage, content, indexability, internal_linking, breakdown }`. Deterministic weighted deductions; `breakdown` lists what cost points.
- **`seoAuditService.js`** — read API for the controller: latest overview, filtered/paginated issues, page detail, score history.

## Rule catalog v1

Anchored to the GSC SOP escalation triggers and the plan's URL/title/meta rules.

**Indexability (SOP-mirrored):**
- `indexability.unexpected_noindex` — should-index URL carries `noindex`.
- `indexability.robots_blocked_in_sitemap` — robots-blocked URL present in sitemap.
- `indexability.error_url_in_sitemap` — 404 or redirect URL present in sitemap.
- `indexability.canonical_sitemap_mismatch` — canonical ≠ the sitemap-listed URL.
- `indexability.soft_404` — 200 status but thin body / error-catalog markers.
- `indexability.prerender_regression` — host/service snapshot `<title>` equals the generic homepage title (prerender failed).

**Technical:** `technical.non_200`, `technical.redirect`, `technical.redirect_chain` (>1 hop), `technical.slow_response` (> threshold ms), `technical.missing_canonical`, `technical.duplicate_canonical`, `technical.canonical_to_other`, `technical.missing_viewport`.

**On-page:** `onpage.missing_title`, `onpage.title_length` (∉ 50–60), `onpage.duplicate_title`, `onpage.missing_description`, `onpage.description_length` (∉ 140–160), `onpage.duplicate_description`, `onpage.missing_h1`, `onpage.multiple_h1`, `onpage.title_h1_mismatch`.

**Links:** `links.broken_internal` (non-200), `links.broken_external` (sampled), `links.orphan_page` (indexable, in sitemap, 0 internal links seen across crawl).

**Images:** `images.missing_alt`. _(dimensions deferred — needs render.)_

**Structured data:** `schema.missing` (none on a page-type that expects it), `schema.invalid_json` (unparseable), `schema.wrong_type` (required type for page-type absent).

**Sitemap:** `sitemap.child_error` (child fetch fails), `sitemap.unreachable_url`, `sitemap.missing_indexable` (indexable page absent from sitemap).

Each rule declares a default `severity`, `confidence`, `category`, and `auto_fixable` flag (informational in P1 — pre-labels what P2 could safely fix, e.g. `onpage.missing_description` = true, `onpage.title_h1_mismatch` = false).

## Database — `server/migrations/v3.145_seo_audit.sql`

Idempotent (`CREATE TABLE IF NOT EXISTS`), applied to **both** DBs via `migrate.js`. All tables server-only (RLS enabled, no policy — service-role writes, like other job tables).

- **`seo_crawls`** — `id uuid pk`, `started_at`, `finished_at`, `status text` (running|done|failed), `trigger text` (nightly|manual), `triggered_by` (admin id, nullable), `url_count int`, `page_count int`, `issue_count int`, `error text`, `progress jsonb`.
- **`seo_crawl_pages`** — `id uuid pk`, `crawl_id fk→seo_crawls on delete cascade`, `url text`, `page_type text` (host|service|blog|static|other), `http_status int`, `final_url text`, `redirect_chain jsonb`, `response_ms int`, `title text`, `meta_description text`, `canonical text`, `robots text`, `h1 jsonb`, `word_count int`, `indexable bool`, `in_sitemap bool`, `raw_signals jsonb` (extensible bag), `created_at`. Index `(crawl_id)`, `(crawl_id, page_type)`.
- **`seo_issues`** — `id uuid pk`, `crawl_id fk`, `page_id fk→seo_crawl_pages null` (null for site-level e.g. sitemap), `rule_key text`, `category text`, `severity text` (P0..P4), `priority_score numeric`, `confidence numeric`, `title text`, `detail text`, `evidence jsonb`, `affected_url text`, `auto_fixable bool default false`, `status text default 'open'` (open|ignored), `first_seen_crawl_id uuid`, `created_at`. Index `(crawl_id, severity)`, `(rule_key, affected_url)`.
- **`seo_score_snapshots`** — `id uuid pk`, `crawl_id fk`, `taken_at`, `overall int`, `technical int`, `onpage int`, `content int`, `indexability int`, `internal_linking int`, `breakdown jsonb`.
- **`seo_issue_mutes`** — `id uuid pk`, `rule_key text`, `url_pattern text null` (null = mute the whole rule type), `muted_by`, `created_at`. Crawler skips (or marks `ignored`) matching issues → satisfies §21 "ignore this issue / this type".

`seo.manage` already exists in `server/lib/adminPermissions.js` and is granted to the marketing role → **no RBAC migration**.

## API — `/api/admin/seo` (mounted under `adminRoutes`, all `requireAdmin('seo.manage')`)

`server/routes/seoRoutes.js` → `server/controllers/seoAdminController.js`:
- `GET /overview` — latest crawl: scores, counts by severity/category, crawl stats.
- `GET /issues?severity=&category=&rule_key=&status=&page=` — paginated.
- `GET /issues/:id` — evidence, affected URLs, explanation.
- `GET /pages?type=&status=&page=` — crawled URLs.
- `GET /pages/:id` — all extracted signals + its issues.
- `GET /scores/history` — snapshot trend.
- `POST /crawl` — trigger on-demand (returns crawl id; `runLocked` guards against overlap).
- `GET /crawl/:id` — status/progress.
- `POST /issues/:id/mute` (+ optional `{ ruleType:true }`) — write to `seo_issue_mutes`; `audit()`.

Mounting line in `adminRoutes.js` mirrors GST: `router.use('/seo', require('./seoRoutes'))`.

## Frontend — `client/src/pages/admin/AdminSeo.jsx`

Lean v1. Reuse the GST admin page shell, design tokens, and the `SeoDrawer` drawer pattern.
- **Overview** — 6 health-score tiles (overall + 5 categories); clicking a tile reveals the issues dragging it. Crawl-stats strip: pages / indexable / non-indexable / errors / redirects / last-crawl time. "Run crawl now" button (POST /crawl, poll /crawl/:id).
- **Issues** — prioritized table (severity chip · category · title · affected count) with severity/category filters; row → detail drawer (evidence, affected URLs, why-it-matters, mute / mute-type).
- **Pages** — crawled-URL table (url · type · status · indexable · #issues); row → page detail.

Wiring:
- `client/src/App.jsx` — lazy import + `<Route path="/admin/seo" element={<AdminWrapper><AdminSeo/></AdminWrapper>} />`.
- `client/src/components/admin/adminNav.js` — one `NAV` item `{ label:'SEO', icon, to:'/admin/seo', perm:'seo.manage' }` (+ `PATH_LABELS` entry).
- API client method(s) in the existing admin api service.

## Nightly wiring

`server/server.js` `SCHEDULED_JOBS` array:
```js
{ name: 'seo-crawl', min: 24 * 60, run: () => require('./services/seo/seoCrawler').run({ trigger: 'nightly' }) }
```
One line; `runIfDue` on the existing 5-min `SCHEDULER_TICK` handles pod-churn. `run()` self-guards with `runLocked`.

## Risks / landmines

- **ipGuard self-ban (#876).** Crawling host/service URLs proxies through Render `/prerender`. Throttle + add the crawler's egress to an ipGuard exemption (or crawl via a path that skips offense tracking). Verify against the `isExempt` boundary bug history.
- **Crawl politeness / cost.** ~245 URLs today; concurrency ~4 + delay is plenty. Do **not** build sampling now (YAGNI until ~2k URLs).
- **Bot-UA fetch correctness.** Confirm the edge middleware treats the chosen UA as a bot (proxies to `/prerender`) so host/service meta is real, not spa-shell.
- **Route-list drift.** The crawler seeds from the sitemap (single source), so it inherits sitemap correctness — but the sitemap's static-route list is hand-mirrored; a missing static route won't be crawled. `sitemap.missing_indexable` partially covers this.
- **Deploy gate.** Full client `vitest run` gates Vercel deploy — run `npx vitest run` before the client PR; watch for admin-nav / route mock drift.
- **Two DBs.** Apply `v3.145` to staging then prod; keep code schema-fallback-tolerant until confirmed on both.

## Testing

- Unit (server, pure): every `rules/*.js` (table-driven fixtures), `prioritize.js`, `healthScore.js`, `seoParse.js`.
- Integration (server): `seoCrawler.run()` over a small fixture server / mocked `seoFetch` → asserts persisted crawl + issues.
- Client: `AdminSeo` render + issue filter with a mocked API (vitest, no jest-dom — use `.getAttribute()`).

## Success criteria

1. `POST /api/admin/seo/crawl` produces a crawl row with per-page rows + prioritized issues, no writes to any `seo_*` live field.
2. `/admin/seo` shows 6 explainable health scores, a prioritized issue list, and crawl stats; "Run crawl now" works.
3. The engine reproduces the GSC SOP escalation checks automatically (soft-404, canonical mismatch, unexpected noindex, prerender regression, sitemap errors).
4. Nightly job runs via `runIfDue` without colliding with manual crawls.
5. `v3.145` applied to both DBs; server + client test suites green.
