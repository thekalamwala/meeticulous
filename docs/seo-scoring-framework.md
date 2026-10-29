# SEO + GEO/AEO Scoring Framework (v2)

Internal, auditable scoring for the SEO control center. Two independent 0–100 scores
per page: **SEO** (traditional search health) and **GEO/AEO** (readiness for AI answer
engines to understand, retrieve and cite the page).

> **These are Book A Sloth's diagnostic scores, not any search engine's ranking
> formula.** No vendor publishes a weighted ranking formula. Every weight below is our
> engineering judgement, tagged with an evidence level so it can be challenged.

Code: `server/services/seo/scoring/` (`seoScore.js`, `geoScore.js`, `weights.js`,
`signals.js`). Pure functions; input is one crawled page + its issues + DB content
model + GSC data. Tested in `server/tests/unit/seoScoring.test.js`.

## Evidence levels

| Tag | Meaning |
|---|---|
| **official** | Documented by Google / OpenAI / Anthropic. Scored hard. |
| **proxy** | An observable stand-in for an official *qualitative* signal (E-E-A-T etc.). Soft. |
| **industry** | Correlation from credible studies (Princeton GEO, etc.), not vendor-confirmed. Lower weight. |
| **heuristic** | Reasonable engineering inference. Lowest weight. |

## Design principles

1. **Weighted sum, then hard caps.** A page computes a weighted dimension sum, then
   caps clamp it so cosmetic wins can't hide a real failure (spec §12).
2. **Caps beat metadata.** A `noindex`, non-200, wrong canonical, or thin page can
   never score "healthy" no matter how good its title/meta is.
3. **Page-type profiles.** Services, profiles, blogs and static/landing pages carry
   different weight tables (spec §9) — a bodiless expectation isn't applied to a page
   type that legitimately lacks it.
4. **Every lost point is traceable.** Each dimension emits `{lost, reason, fix,
   evidence}`. The "why not 100" list is `weight × (1 − subScore/100)` per dimension,
   plus any active cap, sorted by points lost.
5. **Never reward the myths.** No points for word count, keyword density, llms.txt,
   blind FAQ schema, or AI-specific files. Invisible `aggregateRating` is a *penalty*,
   not a reward. Blocking training crawlers (GPTBot/ClaudeBot) is **not** penalized.

---

## SEO score — dimensions & weights

Weights are per page-type profile (`weights.js`). Base profile = **content page**
(static/landing/blog). Sub-score is 0–100 within the dimension.

| Dimension | Content pg | Service | Profile | Evidence | Measured from |
|---|--:|--:|--:|---|---|
| Indexability & crawlability | 18 | 18 | 18 | official | http 200, not noindex, robots allows Googlebot |
| Canonicalization | 10 | 10 | 10 | official | self/intended canonical; GSC google-chosen-canonical match |
| Metadata quality | 14 | 18 | 18 | official | title present/length/unique, meta desc, single descriptive H1 |
| Content quality & depth | 20 | 12 | 12 | proxy | body text volume vs boilerplate, heading outline, originality proxy |
| Internal linking | 12 | 10 | 10 | official | inbound + outbound contextual links, orphan check |
| Structured data | 8 | 12 | 12 | official | valid JSON-LD, type appropriate to page, matches visible text |
| Media accessibility | 5 | 5 | 5 | official | img alt coverage |
| Search performance (GSC) | 13 | 15 | 15 | official | impressions/CTR/position evidence, intent coverage vs queries |

Weights sum to 100 per column. **Page experience / Core Web Vitals is intentionally
absent** — we do not yet ingest CrUX/PSI field data, so scoring it would be fake
precision. Wiring CWV is a documented future dimension (see "Not yet measured").

### Sub-score rules (summary; see `signals.js` for exact thresholds)

- **Indexability**: 100 if 200 + indexable + Googlebot-allowed. 0 on non-200 or
  unexpected noindex (also triggers a cap).
- **Metadata**: title 40–60 chars & unique (+), missing/duplicate/too-long (−); meta
  desc present 70–160 (+); exactly one non-generic H1 (+). No keyword-density check.
- **Content depth**: banded by extractable words *relative to page type* (services/
  profiles have lower bars — they're not articles). Depth, not a word-count target;
  above the band gives no extra points (spec: no word-count reward).
- **Internal linking**: outbound contextual links ≥3 and not orphaned = full; orphan
  or <2 inbound = major deduction.
- **Structured data**: appropriate valid type = full; invalid JSON-LD or type/visible
  mismatch = deduction; `aggregateRating` with no visible reviews = deduction (policy).
- **Search performance**: uses GSC. Ranks 1–10 with clicks = full; high impressions +
  low CTR = deduction (fixable title/meta); ranks 4–15 = opportunity, not full.

### SEO hard caps (applied after weighted sum)

| Condition | Cap | Why |
|---|--:|---|
| Non-200 / fetch error | 20 | Page is broken; nothing else matters (official) |
| Unexpected `noindex` | 30 | Can't rank at all (official) |
| Blocked from Googlebot in robots.txt | 25 | Can't be crawled (official) |
| Canonical points to an unexpected URL | 55 | Signals may consolidate away from this page (official) |
| Thin content on a content page | 60 | Metadata can't rescue thin/low-value content (spec §12) |

---

## GEO / AEO score — dimensions & weights

Diagnostic only. Rewards properties that make a page understandable, retrievable and
quotable by AI answer engines. Same page-type profiling applies.

| Dimension | Weight | Evidence | Measured from |
|---|--:|---|---|
| AI-crawler access | 18 | official | robots.txt allows OAI-SearchBot, Claude-SearchBot, Claude-User, Googlebot; no page-level `nosnippet` |
| Text extractability | 15 | official | important content is in server-rendered HTML text, not locked in images/JS |
| Entity clarity | 15 | official+heuristic | Organization/Person/ProfilePage schema, author/provider named, `sameAs`, consistent naming |
| Answer coverage | 15 | industry+heuristic | page directly addresses its ranking queries; Q→A structure; answer-first paragraphs |
| Structure & extractable blocks | 12 | industry | clean heading outline, lists/tables, self-contained sections |
| Evidence | 12 | industry (Princeton GEO) | statistics, quotations with attribution, citations to reputable sources |
| Structured-data validity & match | 8 | official | valid JSON-LD that matches visible content |
| Freshness (where relevant) | 5 | heuristic | published/updated dates present on blog/time-sensitive pages |

Weights sum to 100. **GPTBot / ClaudeBot (training) access is decoupled** — shown in
the crawler map but never scored, because blocking training does not affect AI-search
visibility (OpenAI/Anthropic docs).

### GEO hard caps

| Condition | Cap | Why |
|---|--:|---|
| `noindex` | 25 | Ineligible for Google AI Overviews (needs to be indexable) |
| Page-level `nosnippet` | 40 | Explicitly ineligible for snippet/AI citation (official) |
| Both OAI-SearchBot **and** Claude-SearchBot blocked | 45 | AI search crawlers can't fetch it |
| No extractable text (image/JS-locked) | 50 | Nothing for an AI engine to quote (official) |

---

## Data source separation (spec §8)

- **GSC** (`seo_gsc_urls`, `seo_gsc_queries`): clicks, impressions, CTR, position,
  queries, coverage. Authoritative for outcomes. Last ~3 days preliminary; row-capped;
  privacy-filtered — page rollups can undercount. Labeled "Search Console" in the UI.
- **Crawler / content model** (`seo_crawl_pages`, DB content model): title, meta, H1,
  canonical, schema, links, structure, text. Labeled "Site analysis".
- **GEO analysis**: robots.txt crawler map, extractability, entity/answer/evidence
  heuristics. Labeled "AI/GEO analysis (diagnostic)".
- Analytics **organic visits are not ingested** (analytics is write-only server-side).
  The UI shows GSC clicks as the outcome metric and does not fabricate a visits number.

## Not yet measured (honest gaps)

- **Core Web Vitals / page experience** — needs CrUX or PageSpeed Insights API. Until
  wired, not scored (no fake precision). Future SEO dimension.
- **Real rendered HTML for services/profiles** — Cloudflare blocks the crawler UA, so
  these page types are scored from a **DB-derived content model** (source of truth we
  own) rather than scraped HTML. More accurate for our own data; does not catch a
  client-render regression the way fetching the live page would.

## Sources

Google Search Central (ranking systems, helpful content, page experience, AI features,
structured data, GSC metrics docs); OpenAI bots doc (OAI-SearchBot / ChatGPT-User /
GPTBot); Anthropic crawler docs (ClaudeBot / Claude-User / Claude-SearchBot); Princeton
"GEO: Generative Engine Optimization" (KDD 2024) for the industry-evidence GEO factors.
Full URLs in the PR description / research notes.
