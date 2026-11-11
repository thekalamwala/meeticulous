# Weekly SEO/AEO audit — 2026-11-11 (VANI, ASH-74)

Delta vs last week `docs/seo-audit-weekly-2026-11-04.md` and baseline `docs/seo-aeo-audit.md`.
Live HTTP probes (`curl` status+size, WebFetch body) + code read. GSC data **still not synced**
(`seo.sh` → `status:gsc_not_synced`, `GSC_SA_KEY`/`GSC_PROPERTY` unset) → no query/position numbers;
targeting worked from the topical map + sitemap, not search data.

## Live probes (2026-11-11 ~05:16 UTC, https://meeticulous.com)

Shell = 5,559 B `spa-shell.html` (documented last week). Big byte count = prerendered.

| Route | Status | Bytes | Prerendered? | Δ vs 11-04 |
|---|---|---|---|---|
| `/` | 200 | **5,559** | **NO — shell** | ⚠️ regressed / still failing |
| `/pricing` | 200 | 196,218 | yes | = |
| `/blog` | 200 | 146,525 | yes | ✅ was shell |
| `/services` | 200 | 204,905 | yes | ✅ was shell |
| `/compare/calendly-alternative` | 200 | 209,546 | yes | ✅ was shell |
| `/for/doctors` | 200 | 130,481 | yes | ✅ was shell |
| `/glossary` (index) | 200 | **5,559** | **NO — shell** | ⚠️ still shell |
| `/glossary/buffer-time` | 200 | **5,559** | **NO — shell** | ⚠️ still shell |
| `/glossary/no-show` | 200 | **5,559** | **NO — shell** | ⚠️ still shell |
| `/sitemap.xml` | 200 | index, 6 children | — | +`sitemap-community.xml` |
| `/robots.txt` | 200 | AI crawlers named | — | = |
| `/llms.txt` | 200 | — | — | = |

WebFetch confirmed `/` and `/glossary/buffer-time` both reduce to the single shell tagline
("Meeticulous — the calm way to sell your time") with no body, title, `<h1>` or JSON-LD.

## Finding W1 (P0) — homepage serves the bare SPA shell

**Gap:** `/` returns the 5,559 B `spa-shell.html` (3 consecutive samples, WebFetch sees no body),
not prerendered HTML. The homepage is **first** in `PRERENDER_ROUTES` (`client/scripts/prerender.mjs:88`)
and **priority 1.0** in `sitemap-pages.xml`.
**Mechanism:** `client/vercel.json` catch-all rewrite `"/((?!assets/).*)" → "/spa-shell.html"` fires
only when no baked static file matches the path. So `/` falling through to the shell means `index.html`
is **not present / not resolving** in the Vercel output for `/`. This is NOT the time-budget tail-drop
that explains glossary (W2) — the budget drops the *tail* of the queue, and `/` is the *head*. It is a
prerender failure or a static-file resolution miss specific to the homepage.
**Impact:** H (highest). Non-JS crawlers — Bing and every AI crawler (GPTBot, ClaudeBot, PerplexityBot,
which do not run JS) — get an empty page for the site's #1 URL, **and** the homepage Organization +
`aggregateRating` JSON-LD (`client/src/utils/seo.js:253`) never reaches static HTML, so AI engines see
no entity/brand schema at all. Google (renders JS) is less affected. Directly guts the GEO posture.
**Fix → Senapati (eng):** pull the last Vercel prerender build log; confirm whether `/` was baked
(look for `index.html` in output + any skip/crash line for `/`). If `/` crashes/times out during
prerender, fix the page's prerender path; if it bakes but Vercel serves shell, fix the output-dir /
rewrite precedence so `index.html` wins for `/`. Add the fail-loud guard noted at
`prerender.mjs` once reliable.
**Effort:** S–M. Carries over + escalates last week's W1 (which was the whole hub set; hubs are now fixed,
homepage is the remaining — and worst — case).

## Finding W2 (P1) — `/glossary` index + all 30 term pages serve the shell

**Gap:** `/glossary` and every `/glossary/<slug>` (30 slugs, all listed in `sitemap-pages.xml`) return
the 5,559 B shell. They sit mid-queue in `PRERENDER_ROUTES` (`prerender.mjs:141-142`, after FEATURES),
so the time budget drops them as the tail — the exact pattern the file comment at `:84` describes.
**Impact:** M. 30 indexed URLs (priority in sitemap) that AI crawlers see empty. Glossary is a pure
AEO/definition play — high citability if served, zero value as a shell.
**Fix → Senapati (eng):** raise the prerender time budget (`BUDGET_MS`) OR move the `/glossary` block
ahead of the long `/for/*` + help/changelog tail so the 30 definition pages bake inside budget.
**Effort:** S.

## Finding W3 (P2) — CCBot not explicitly named in robots.txt

Named AI group covers GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, Claude-Web, PerplexityBot,
Google-Extended. **CCBot** (Common Crawl — feeds several LLM training sets + some AI search) is absent,
so it only inherits the `*` group (which is Allow: /, so not blocked — just not explicitly welcomed).
Optional: add CCBot to the named allow group for parity. Low impact.

## Resolved since baseline (verified this week)
- **aggregateRating honesty risk (baseline P0-1):** now gated `rating.count > 0 && rating.avg > 0`
  before emitting any `AggregateRating` node (`client/src/utils/seo.js:253`, mirrored for services
  `:340`). Profession/utility/product pages carry NO aggregateRating by design. No fabricated rating
  in code. (Moot on the homepage itself while W1 stands — the node never reaches static HTML.)
- **Hub prerender (last week W1):** `/blog`, `/services`, `/compare/*`, `/for/*` now serve real HTML.

## Content gaps
- **Blocker, not a gap:** GSC is still unsynced, so striking-distance/low-CTR targeting is impossible.
  This is the single biggest lever on data-driven content and should be unblocked (eng/founder: set
  `GSC_SA_KEY` + `GSC_PROPERTY` on the server, run first `gsc-sync`). Until then every content target
  is a guess against the topical map. **Raised as a task.**
- No new thin/missing-page gaps surfaced this week beyond the glossary pages being unservable (W2);
  coverage of `/compare/*` and `/for/*` clusters is intact and now crawlable.

## Not done
Lighthouse/CWV (homepage 0.25–0.41s TTFB this week, no longer the 3.07s W2 from 11-04 — that was a cold
edge). Full `geo-audit` skill (subagent-heavy; run on request). DB platform-scale refresh.

## Tasks raised
- **Senapati (P0):** W1 — homepage serves SPA shell (prerender/output miss).
- **Senapati (P1):** W2 — glossary cluster (31 pages) budget-dropped from prerender.
- **Founder/eng (blocker):** configure GSC sync so SEO can work from real search data.
