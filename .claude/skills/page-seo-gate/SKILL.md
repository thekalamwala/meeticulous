---
name: page-seo-gate
description: Use before shipping or when reviewing ANY non-blog public page for search/AI ranking readiness — landing pages (/for/*, ProfessionLanding, Home), product pages (pricing, courses, membership, become-a-host, compare), and any new marketing/website page. Runs the live v2 scorer against the page, gates on SEO≥90 + GEO≥90 with no score caps, reports PASS/FAIL per dimension with exact in-repo fixes, applies the safe ones, stops at the PR. Delegates schema to bas-seo-schema and blog posts to blog-seo-optimizer. Trigger: "does this page rank", "SEO-check this landing/product page", "pre-publish SEO", "tick all the SEO boxes", "/page-seo-gate".
---

# Meeticulous — Page SEO/GEO/AEO Pre-Publish Gate (non-blog)

One page in → PASS / FAIL against the full ranking checklist, with the exact file to fix each
miss, safe fixes applied, PR opened. **This skill never invents a rubric** — it drives the live
production scorer (`server/services/seo/scoring/`), the same engine the admin SEO dashboard and the
blog optimizer use. The checklist below IS that engine's dimensions.

## What this gates vs what it hands off
- **This skill:** landing pages (`client/src/pages/for/*`, `for/ProfessionLanding(V2).jsx`,
  `Home.jsx`), product/marketing pages (`Pricing`, `Courses`/`CoursePage`, `Membership`,
  `BecomeAHost`, `Compare`, `HowItWorks`, `Enterprise`, `About`, `Glossary`, …) — any public page
  rendered from a route.
- **Blog post** (a Markdown draft → `blogPosts.js`) → **STOP, use `blog-seo-optimizer`** (it has
  the cannibalization + cluster-link + claim-verify pipeline this one does not).
- **The JSON-LD itself** (adding/editing a schema node) → the emit + two-path sync rules live in
  **`bas-seo-schema`**. This skill only *checks* schema is present/valid and tells you to go there
  to add it.

## Hard rules
1. **Stop at the PR. Never merge** (merge auto-deploys prod). Fresh branch from `origin/main`
   (CLAUDE.md: worktree, never `git switch` the shared checkout). PR base = the open `release/YYYY-MM`.
2. **Score the HTML a bot sees, not the SPA.** This is a Vite SPA — a raw dev URL
   (`localhost:5173/...`) has an empty `<body>` and scores ~0. Point the scorer at **prod**, or at a
   `cd client && npm run build && npm run preview` of the route, or the server bot shell
   (`curl -A Googlebot <url>`). Scoring the dev SPA is the #1 false-fail.
3. **aggregateRating = REAL reviews only** (`reviewCount>0 && avgRating>0`). Never add a platform
   default rating to a landing/product page to lift a schema check — that is a GSC violation. Rule
   owned by `bas-seo-schema`; platform rating lives ONLY on `Home.jsx`'s SoftwareApplication node.
4. **No fabricated numbers, URLs, or claims** to pass a dimension. A missing stat/citation is a
   content gap to flag as NEEDS YOU, not to invent.
5. **Both schema paths** (client `seo.js` ↔ server `prerenderController.js`) — if a fix touches
   schema, it lands in both per `bas-seo-schema`. New route → register the first segment in BOTH
   reserved lists (`client/src/config/reservedSegments.js`, `server/config/reservedNamespaces.js`).

## The checklist = the scorer's dimensions (fix location in parens)
**SEO axis** (`server/services/seo/scoring/seoScore.js`):
- `indexability` — HTTP 200, not `noindex`, not robots-blocked (`client/public/robots.txt`).
- `canonical` — self-referential, absolute, matches final URL (`<Seo canonical>` → `Seo.jsx`).
- `metadata` — title ≤60 keyword-front-loaded, meta description 140–160, OG/Twitter set
  (`<Seo title/description/ogTitle/image>` on the page; component `Seo.jsx`).
- `media` — every `<img>` has real alt; OG `image` resolves to a file that exists.
- `structured_data` — ≥1 entity-type JSON-LD, valid, no duplicate `@type` → **go to `bas-seo-schema`**.
- `internal_linking` — enough in-context internal links out to intent-matched pages; not orphaned.
- `content` — real depth / word count for the page's job (thin landing = cap).
- `search_performance` — GSC-derived; `[VERIFY LIVE]`, cannot be raised pre-publish.

**GEO / AEO axis** (`geoScore.js`) — this is where the **Dec 2026 core update** signals land
(complex-query understanding + answer-first content):
- `crawler_access` — AI bots allowed for this path (`robots.txt` AI-crawler block).
- `extractability` — answers read self-contained (quotable, no "as above"/dangling pronouns).
- `entity_clarity` — one clear non-generic H1, entity schema names the thing; not "Home"/"Services".
- `answer_coverage` — the page answers the real sub-questions for its query (fan-out), answer-first
  H2s, a visible FAQ (and FAQPage schema only when the FAQ is visible).
- `structure` — scannable headings, lists/tables/steps where they fit.
- `evidence` — concrete stats / quotes / outbound citations (proxy for real claims).
- `freshness` — recent `article:modified_time` where applicable.

## Pipeline
1. **Locate the page.** Find the route component + its `<Seo>` usage (grep the component AND its
   shared layout — `LegalLayout`/Hero wrappers can supply `<Seo>`; a page file with no `<Seo>` may
   still be covered). Note page type: `static` | `product` | `profession`.
2. **Pick the URL to score** (rule 2): prod URL, or local `build && preview`. Confirm it returns
   200 as a bot: `curl -A Googlebot <url>` shows real content, not the shell.
3. **Score** (from `server/` — the crawler loads Supabase, so pass the env file):
   `node --env-file=.env scripts/scorePageUrl.mjs <url> [--type static|product|profession]`
   Read `SEO x/100`, `GEO y/100`, the `caps` line, and the priority-sorted fixes.
   (Verified live: `/pricing` → SEO 85 / GEO 81, no caps — a real FAIL with a fix queue.)
4. **Fix the safe misses in-repo**, highest-priority first (the recs are pre-sorted by
   Impact×Confidence×Ease). Safe = code-only: title/description/OG/canonical via `<Seo>`, image
   alt, internal links, headings, answer-first rewrites, a visible FAQ. Schema misses → do them the
   `bas-seo-schema` way (both paths). Re-score. **Max 3 passes.**
5. **Leave judgement calls as NEEDS YOU** — review counts, a claimed statistic, a data story,
   whether a thin page should exist at all. Never auto-fill them.
6. **Verify:** `cd client && npx vitest run` (SEO/route-sync tests are a deploy gate — one stale
   test blocks ALL Vercel deploys). `cd server && npm test` if server/schema changed.
   `node scripts/scorePageUrl.mjs --selfcheck` if you touched the scorer script.
7. **Report** (below), then: PASS → commit → `gh pr create --base release/YYYY-MM` → **STOP**.
   FAIL → leave fixes local, report, open no PR.

## Quality gate — PASS requires ALL of:
- `seo.score ≥ 90` AND `geo.score ≥ 90`.
- No score caps tripped (HTTP≠200, noindex, robots block, cross-canonical, thin content).
- ≥1 valid entity JSON-LD present; FAQPage only if a visible FAQ exists; no duplicate `@type`.
- Canonical self-referential + absolute; one non-generic H1; title/description within limits.
- No fabricated rating/stat/URL used to clear a dimension.
- Bot curl shows the scored content in the shipped HTML (rule 2).
Any failure → FAIL, no PR.

## Report format (emit before any git action)
DECISION: PASS | FAIL
Page / route file / page type / scored URL (prod | local preview)
SEO x/100  GEO y/100  (pre-publish ceiling — GSC dims excluded)
Caps tripped: none | [list]
Per-dimension: dimension → ✅ / ❌ (−Npt) → fix location
Fixes applied (safe) / Fixes left as NEEDS YOU (with why)
Schema: present? valid? → bas-seo-schema handoff if missing
Remaining gaps + whether each is markup vs real demand/authority

## Landmines
- **Dev SPA scores ~0** (rule 2) — always score prerendered/prod HTML.
- Egress blocked in cloud sessions → cannot fetch prod; score a local `preview` build or derive
  from the prerender source and tag live claims `[VERIFY LIVE]` (per `seo-aeo-audit`).
- `scorePageUrl.mjs` lazy-imports `crawlOne` (seoCrawler pulls Supabase at load) — a real run needs
  `server/.env`; `--selfcheck` runs pure without it.
- Googlebot is deliberately excluded from `middleware.js` bot-prerender (it runs JS) — not a bug.
- Profession pages have no server shell; their schema comes from build-time Puppeteer
  (`client/scripts/prerender.mjs`) — see `bas-seo-schema`.
