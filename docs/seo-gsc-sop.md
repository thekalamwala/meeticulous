# SOP — Google Search Console Monitoring & Indexing

_Owner: Shubham • Created: 2026-07-19 • Cadence: weekly (Monday), plus after every deploy that touches SEO surface or publishes content._

Scope: the `meeticulous.com` domain property in GSC. Companion docs: `seo-aeo-geo-plan.md` (strategy), `seo-audit-2026-07-19.md` (fix history).

---

## 0. Baseline (recorded 2026-07-19, day of PR #435 deploy)

| Metric | Value |
|---|---|
| Sitemap index | Processed successfully, 5 children all "Success", 201 discovered |
| Indexed pages | 5 |
| Not indexed | 116 (107 = Discovered-not-crawled queue) |

Every future reading is judged against this, not against zero.

---

## 1. Weekly routine (~10 min)

1. **Indexing → Sitemaps.** All 5 children still "Success". `sitemap-pages.xml` discovered count should read **71** once Google re-reads the post-#435 file (was 28). If a child shows an error → escalate (§4).
2. **Indexing → Pages.** Note two numbers in a running log (bottom of this file): **Indexed** and **Discovered – currently not indexed**. Healthy motion = Indexed climbing, queue draining.
3. **Read the "Why pages aren't indexed" table** against §2 below. Only act when a row is marked ACT.
4. **Performance tab** (once impressions exist): note total impressions + clicks weekly. Watch the brand query `Meeticulous` and note any near-name competitors in the SERP.
5. **Request indexing** (§3) for any newly published high-value page (new LP, feature page, blog post).

## 2. How to read "Why pages aren't indexed"

| Row | Meaning | Action |
|---|---|---|
| Discovered – currently not indexed | Known from sitemap, not crawled yet. Crawl-budget queue of a young domain. | NONE. Watch it drain over weeks. |
| Crawled – currently not indexed | Crawled, judged not index-worthy yet. | NONE unless a **marketing page** (LP/feature/for/blog) sits here **>3 weeks** → then it's a content-quality signal: expand/differentiate that page. |
| Alternate page with proper canonical tag | Duplicate correctly pointing at canonical (www→apex, /blogs→/blog, booking funnel). | NONE — working as intended. |
| Excluded by 'noindex' tag | /search, /og/*, spa-shell — all deliberate. | NONE. Verify the URL is one of ours if count jumps. |
| Not found (404) | Dead URLs. Dead/renamed usernames now 404 honestly (PR #435). | NONE. This row **growing** after 07-19 = the fix working, not a regression. |
| Soft 404 | Page serves 200 but looks empty/error to Google. | Should be **0** after the 07-19 recrawl. Any NEW soft-404 → escalate (§4). |
| Duplicate without user-selected canonical | Raw HTML claimed the wrong/no canonical. | Should be **0** after recrawl (spa-shell fix). New entries → escalate (§4). |
| Duplicate, Google chose different canonical | Google overrode our canonical. | Host profiles appearing here → escalate immediately (fallback regression). |

## 3. Request indexing (manual accelerator)

For a young domain this is the one free lever. Quota ≈ 10 URLs/day per property.

1. GSC search bar → paste full URL → Enter.
2. Wait for inspection → **Request indexing**.
3. Priority order when unsure: `/` → `/pricing` → `/explore` → `/lp/*` comparisons → top `/for/*` pages → newest blog posts → `/features/*`.
4. Every new blog post / LP gets this on publish day.

## 4. Escalation triggers (something is actually wrong)

Any of these → investigate the same day (start with `docs/seo-audit-2026-07-19.md` methods: curl the raw HTML, check canonical, check status code):

- A sitemap child flips to error, or `sitemap-pages.xml` still reads 28 URLs after 2 weeks.
- NEW Soft 404s or canonical-duplicate rows dated after 2026-07-19.
- Host profile URLs under "Duplicate, Google chose different canonical" (spa-shell/fallback regression).
- Indexed count **drops** week-over-week without a deliberate removal.
- Coverage of a prerendered route shows the generic homepage title in its Google snippet (prerender regression — check the Vercel build log for `[prerender] FAIL`).

## 5. Standing rules that feed this SOP (from PR #435)

- **Publish a blog post → run `npm run og:blog`** (see script header for env invocation) **before the next prod deploy** — the build fails on missing cards by design.
- **New `/features`, help-doc, or careers slug → mirror it in `server/services/sitemapService.js`** (client lists are ESM, server is CJS; lists are hand-mirrored with KEEP IN SYNC comments).
- Deploy order when auth/middleware/resolver change together: **Render first, then Vercel** (edge middleware depends on API behavior).
- `og:check` is a manual pre-flight after uploading marketing cards — deliberately not in CI.

## 6. Definition of "aligned with the SEO goal"

From `seo-aeo-geo-plan.md`: qualified organic traffic that converts — never vanity traffic. Concretely, this SOP is succeeding when, quarter over quarter:

1. Indexed count trends toward sitemap count (~245 today, grows with hosts/posts).
2. Commercial pages (`/pricing`, `/lp/*`, `/for/*`) earn impressions for buying keywords (GSC Performance → Queries).
3. Host profiles index under their own canonicals.
4. Brand query `Meeticulous` shows our pages, not only the namesake book app.
5. Zero rows in §4's escalation list.

---

## Weekly log

| Date | Indexed | Discovered queue | Notes |
|---|---|---|---|
| 2026-07-19 | 5 | 107 | Baseline. PR #435 live same day; sitemap-pages re-read pending (28→71). |
