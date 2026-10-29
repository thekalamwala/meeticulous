# Forensic SEO Audit — Book A Sloth Blog

**Date:** 2026-09-07 · **Property:** `https://bookasloth.com` (canonical `.com`) · **Analyst:** Claude (Opus 4.8)
**Question asked:** *Why aren't our blog posts ranking, and what exactly needs to change to make them competitive?*

> **One-line answer:** The blog is not ranking **poorly** — it is **absent from search**. 50 of 51 posts earned **zero impressions in the last 6 months** because ~78% of them target topics with essentially **zero search demand** (a build-in-public product changelog written in brand voice), on a **young domain with near-zero — and partly toxic — authority**. This is a **content-strategy** failure, **not** a technical-SEO or crawl/index failure (the blog is verifiably indexable). The one thing the domain *does* rank for is a single **host's profile page** — which points to where the real organic opportunity is.

This audit is a one-time, human-grade diagnosis. It is the qualitative counterpart to the automated **SEO Audit Engine** being built in parallel (`feat/seo-audit-engine`, `server/services/seo/*`, migration `v3.145_seo_audit.sql`). §14 maps every finding to that engine's rule registry so the recurring version can watch these signals continuously.

---

## 0. Executive summary — the 7 questions, answered

### 1) Why aren't the blog posts ranking? (top 5 root causes, ranked by impact)

| # | Root cause | Type | Evidence (measured) |
|---|---|---|---|
| **1** | **Topic/keyword demand mismatch** — the blog is written for itself, not for searchers | Content strategy | 50/51 posts = **0 impressions / 6 mo**; **0 of 282** ranking queries relate to any blog topic; 40/51 posts classify as brand/changelog or no-real-query |
| **2** | **Near-zero + partly toxic off-site authority** | Authority | **0 backlinks** point to *any* blog post; 54% of all 322 links are self-referential (`shubhamdatarkar.com`); toxic PBN/Fiverr anchors present |
| **3** | **Young domain / low crawl priority** | Time/authority | GSC data begins ~June 2026; the 2 genuine guides are only ~2 months old and have 0 authority to rank competitive terms |
| **4** | **No topical authority structure** — clusters are shaped by product features, not searchable topics | Structure | 18/51 posts are orphans (0 inbound internal links); the 2 real guides are themselves orphans; 7 cannibalization groups |
| **5** | **Blog is disconnected from the money pages it should lift** | Structure/commercial | 19/51 posts have **0** links to `/pricing` or `/be-a-sloth`; those pages themselves rank poorly (`/pricing` position **32**) |

**Not a root cause:** Technical indexability. Live-verified — posts return HTTP 200, no `noindex`, correct canonical, full `BlogPosting`+`BreadcrumbList` JSON-LD, and all 51 are in `sitemap-blog.xml`. Google *can* index the blog; it simply has almost nothing worth surfacing for a real query.

### 2) Is the problem primarily technical / intent / content / authority / …?

Supported by the dataset:

- **~78% of posts (40/51)** target near-zero-demand topics → **content & keyword strategy is the dominant cause.**
- For the **~22% (11/51)** that target real queries, the blockers are **off-site authority (0 blog backlinks)** + **domain youth** + **weak internal support** (cannibalization/orphaning).
- **Technical SEO ≈ 0% of the ranking problem** (indexable, sitemapped, canonical/schema present). The technical defects found (§4) are real but do not explain the invisibility.
- **Freshness / decay ≈ 0%** — this is a *never-ranked* problem, not a *lost-rankings* problem.

Rough attribution of "why is the blog invisible": **Strategy/topic ~65% · Authority ~20% · Domain youth ~10% · Structure (internal links/cannibalization) ~5%.** (Directional, from the evidence above — not an algorithmic measurement.)

### 3) What to fix first — top 10 actions

1. **Stop treating the blog as a changelog.** Move pure product-update/postmortem/team posts to `/changelog` (which already ranks better than the whole blog: 8 impr, pos 4.9) and out of `/blog`. (30 posts → consolidate/retire; see §11.)
2. **Consolidate the commission cluster into one authority page.** `zero-commission-bet` + `the-arithmetic-of-commission` + `you-only-pay-when-you-earn` compete for the same buyer query — merge into one deep "0% commission booking / commission calculator" page. (Highest opportunity scores: 75/75/70.)
3. **Invest in the 6 posts that target real demand** (§10): the commission page, `what-a-booking-page-needs-in-india`, `advance-payments-without-the-screenshot-dance`, `digital-marketing-strategy-vibe-coders`. Expand, add FAQ schema, internal-link them, and earn real links.
4. **Fix the toxic-link footprint.** Review and **disavow** the PBN/Fiverr links (§9) before they draw a manual action.
5. **Add `FAQPage` schema** to the two flagship guides — they render FAQs as `<h2>` and emit no FAQ structured data (verified live). Cheap SERP-feature win.
6. **Build real internal links** from the 2 guides + commission page to `/pricing`, `/be-a-sloth`, and the `/for/<vertical>` pages; and from those money pages back into the guides.
7. **Fix the blog soft-404**: unknown `/blog/<slug>` returns 200 + an indexable shell with **no `noindex`** (the `#954` soft-404 fix skipped `/blog`). Make it a real 404/`noindex`.
8. **Give posts a real author identity.** `author` is an Organization ("Bolt 958"); use a `Person` with an author page for E-E-A-T (matters for money/tax/payments topics).
9. **Point new content at the demand that actually exists** (§12): the `/for/<vertical>` local/professional queries the host profiles already prove (e.g. "education/study-abroad/salon/doctor booking"), plus the commercial "calendly/topmate alternative", "0% commission", "advance payment" terms.
10. **Redirect SEO effort to host profiles + `/for/` pages** — the domain's only working organic engine (§5). The blog should *support* that system, not run parallel to it.

### 4) Which existing articles to Keep / Optimize / Refresh / Rewrite / Consolidate / Redirect / Retire

Deterministic buckets from `blog-audit-dataset.csv` (51 posts):

| Bucket | Count | Meaning |
|---|---:|---|
| **OPTIMIZE + PROMOTE / OPTIMIZE / EXPAND** | **9** | Real demand, fixable — the investment list |
| **KEEP (monitor)** | 10 | Acceptable, low priority |
| **KEEP (dev audience)** | 2 | Real query but developer audience, ~no business value |
| **CONSOLIDATE** | 8 | Fold into a stronger sibling (cannibalization) |
| **CONSOLIDATE / RETIRE** | 15 | Brand/changelog, 0 demand, 0 impressions → `/changelog` or retire |
| **REWRITE-or-RETIRE** | 6 | Thin, no demand |
| **RETIRE (noindex)** | 1 | Team page, navigational only |

There is no **REFRESH** bucket: nothing here *decayed* — it never ranked. (Full per-article table: §11 + CSV.)

### 5) Which new topics to create
See §12. Priority: the commercial/alternative cluster (calendly/topmate alternative, 0% commission, advance payments in India) and the vertical cluster mirroring the `/for/` pages and the profile pages that already rank.

### 6) Structural changes
See §13: split changelog from blog; rebuild clusters around search topics not features; wire blog↔money-page↔`/for/` links; add author entities; decide on category/tag pages deliberately (currently none exist — that's fine, keep it that way unless each earns its own indexable content).

### 7) What to automate
See §14: 10 of the finding-types map cleanly onto the `feat/seo-audit-engine` rule registry (orphan detection, thin-content, missing-schema, duplicate/near-duplicate intent, soft-404, money-page-link coverage, brand-only-title). Content strategy and merges stay human.

---

## 1. Scope, data sources & limitations

**In scope:** all 51 published posts in the `blogs` table (prod, Mumbai `ayjhlwyzszykqtnaktpb`), the blog's architecture, and its search/authority performance.

**Data sources (all real, no assumptions):**
- **Prod DB** — live `blogs` query (51 rows: dates, category, structure).
- **Content analysis** — every post body parsed from `client/src/data/blogPosts.js` + `blogClusters.js` (word counts, H2 outlines, internal-link graph, intent, thin flags).
- **Architecture** — code map of routing, prerender, sitemap, canonical, schema, internal linking.
- **Google Search Console** — Performance export, **last 6 months**, Web (`bookasloth.com`): Queries (282), Pages (46), Countries, Devices, daily trend.
- **Backlinks** — Semrush export, 322 links / 100 referring domains.
- **Live crawl** — fetched production HTML for the 2 flagship guides + a control post + an unknown slug + `sitemap-blog.xml`.

**Limitations (stated honestly):**
- **GSC window is 6 months**, and the domain is young (first impressions ~June 2026). "0 impressions" therefore partly reflects **age + zero authority**, not topic choice *alone*. The topic/demand mismatch is nonetheless structural — it would not resolve with time.
- **No keyword-volume tool** was available, so per-post **search demand is an analyst proxy** (documented constant per target query, 0–100), not measured volume. All *other* scoring inputs are measured. Swap in real volumes to sharpen the Opportunity Score.
- **No GSC "Page indexing (coverage)" export** yet — so exact *indexed vs. Discovered/Crawled-not-indexed* counts per blog URL are inferred (from impressions + live checks), not read directly. Recommended as a follow-up input; it would size the technical piece precisely but does not change the headline.
- One post (`write-with-bolt-drafts-your-listing`) exists in the DB + sitemap but not in the repo source (`blogPosts.js`); its content metrics are marked `MISSING` in the dataset.

---

## 2. The core finding & the strategic reframe

Across the **entire domain**, only **46 URLs received any impression in 6 months**, and a **single host profile page — `/theedulocusway` — accounts for 14,181 of ~14,438 total impressions (~98%)**. Every meaningful query is that host's education-consultancy business (`edulocus` 11,468 impr; `education consultants in nagpur`; `study abroad consultants`; `neet counsellor in nagpur`). **Nepal alone = 11,593 impressions** (the host does MBBS-abroad counselling).

Against that, the company's own funnel is invisible: `/pricing` position **32**, `/be-a-sloth` 10.6, `/how-it-works` 17. And the **blog contributes 3 URLs total** to the impression list: `/blog` (10), `/blog/going-live` (4), `/blog?page=2` (1).

**The reframe:** Book A Sloth's *only* working organic engine is **host/professional profile pages ranking for those professionals' local + brand queries** — the marketplace long-tail. That is where demand lives. The blog, as currently conceived, runs parallel to it and targets nothing anyone searches. The strategic recommendation that falls out of the data (§13) is to **make the blog serve that engine** — support the `/for/<vertical>` pages, the profile pages, and the money pages — instead of narrating the changelog.

---

## 3. Blog architecture (condensed map)

| Element | State |
|---|---|
| Routes | `/blog` (index), `/blog/:slug` (post). **No** category / tag / author / archive / search pages. |
| Rendering | Client SPA (React/Vite) reading `/api/blogs`; made crawlable by a **build-time Puppeteer prerender** → static `dist/blog/**`. Bot edge-proxy explicitly **skips** `/blog` (reserved segment). |
| Sitemap | DB-driven `sitemap-blog.xml`, **51 URLs** (verified live), `lastmod` from `updated_at`. |
| Canonical | Self-referential, correct (verified). |
| Schema | `BlogPosting` + `BreadcrumbList` on posts; `CollectionPage` on index. `FAQPage` **only** when body has `{faq}` blocks. |
| Internal linking | Related-posts from **client-side** `blogClusters.js` (`POST_TAGS` + 10 curated clusters); in-body markdown links. Not modeled in DB. |
| Taxonomy | `category` = single free-text column (presentational); tags exist only client-side. Nothing taxonomy-related is indexable — **no faceted-crawl surface** (this is good). |
| Pagination | Client-side `?page=N`; only page 1 is prerendered. |

**Implication:** the architecture is *capable* — real HTML, schema, sitemap. It is not the bottleneck. Two structural quirks matter (below).

---

## 4. Technical eligibility — PASS, with 4 real but secondary defects

**Verified indexable (live fetch, 2026-09-07):** `digital-marketing-strategy-vibe-coders`, `how-explore-ranking-works`, `going-live` → HTTP **200**, **0** `noindex`, correct `<link rel=canonical>`, full `BlogPosting`+`BreadcrumbList` JSON-LD baked into static HTML, 16 `<h2>` of real content, `og:*` present. **Google can crawl and index the blog.**

Secondary defects (do **not** explain the invisibility, but worth fixing):

| Defect | Evidence | Severity | Fix |
|---|---|---|---|
| **Blog soft-404** | `/blog/this-post-does-not-exist-xyz` → **HTTP 200** + ~5.8 KB shell, **no `X-Robots-Tag: noindex`** (Vercel header matches original path, not the spa-shell rewrite target). The `#954` soft-404 fix covered HostProfile/ServiceDetail/ProfessionLanding/Explore — **not `/blog`**. | P2 | Serve 404/410 or a `noindex` `<ErrorPage>` for unknown slugs (BlogPost currently soft-redirects `<Navigate to="/blog">`). |
| **No `FAQPage` schema on the 2 guides** | Both flagship guides write "Frequently asked questions" as an `<h2>` section, not `{faq}` blocks → `faq_count=0`, no FAQ JSON-LD (verified live). | P3 | Convert those H2 FAQs to `{faq}` blocks (schema is already wired for that block type). |
| **`author` = Organization** | JSON-LD `author: {@type: Organization, name: "Bolt 958"}` on every post. | P3 | Use a real `Person` author + author page; strengthens E-E-A-T on money/tax/KYC topics. |
| **Publish→deploy noindex gap** | Posts published between deploys serve as `spa-shell.html` (noindex) until the next prerender, while the sitemap lists them live. Transient. | P3 | Trigger a rebuild (or server-render `/blog/*`) on publish. |
| **`?page=2+` not prerendered** | Only `/blog` (page 1) is prerendered; `?page=N` serves page-1 static content + `canonical=/blog` until JS runs; no `rel=prev/next`. Older posts are discoverable only via sitemap. | P3 | Prerender paginated pages, or add crawlable archive links. |

---

## 5. Search performance (GSC, 6 months)

**Totals:** ~75 clicks / ~14,438 impressions site-wide. **Mobile 12,716 impr** vs Desktop 1,232 — because the traffic is a Nepal/education audience on the one host profile.

**Blog performance:**

| URL | Impr | Clicks | Position |
|---|---:|---:|---:|
| `/blog` (index) | 10 | 0 | 13.6 |
| `/blog/going-live` | 4 | 0 | 7.0 |
| `/blog?page=2` | 1 | 0 | 3.0 |
| **All other 49 posts** | **0** | **0** | — |

**Scenario classification (spec §4):** the blog is overwhelmingly **Scenario C (almost no impressions)** — investigated and traced to **demand + authority + youth**, not indexing (verified) or intent-mismatch on a query it already surfaces for. The 2 real guides are a special case of C: indexable, but 0 impressions at ~2 months old with 0 authority → they have not yet earned surface for competitive terms.

**Money pages (for contrast):** `/enterprise` 44 impr (pos 8.4), `/pricing` 31 (pos **32**), `/be-a-sloth` 13 (pos 10.6), `/how-it-works` 5 (pos 17), `/explore` 2 (pos 2). These are the pages the blog *should* be lifting; they are themselves stranded.

---

## 6. Content, intent & quality

**Shape of the corpus:** 51 posts, published 2026-04-30 → 2026-08-26 (publishing then stopped, ~12 days quiet at audit time). **48 of 51 are changelog/news/postmortem/team narratives**, median ~640 words. **Only 2 are deep evergreen guides** built for external demand: `digital-marketing-strategy-vibe-coders` (2,439 w) and `how-explore-ranking-works` (2,526 w).

**Intent / demand classification** (`target_class` in the CSV):

| Class | Count | Business value | Examples |
|---|---:|---|---|
| brand/changelog | 20 | Low | `the-opening-again`, `going-live`, `welcome-mohini-daf` |
| niche/product | 20 | Low–med | `themes-doors-…`, `permanent-usernames-…`, `notifications-…` |
| host-info | 5 | Med–high | `advance-payments-…`, `digital-marketing-…`, `where-your-money-sits` |
| commercial | 4 | **High** | `zero-commission-bet`, `the-arithmetic-of-commission`, `what-a-booking-page-needs-in-india`, `you-only-pay-when-you-earn` |
| dev-traffic | 2 | Low (wrong audience) | `two-bookings-one-slot`, `razorpay-is-the-source-of-truth` |

So **40/51 posts have no real external search rationale**; **11** do; of those, **6** carry genuine commercial/host value.

**Low-information-density (thin) — 21/51 flagged**, including **4 of the 11 cluster "pillars"** (`onboarding-a-host-in-60-seconds` 176 w, `booking-in-under-a-minute` 213 w, `zero-commission-bet` 239 w, `meet-bolt-the-support-assistant` 452 w). Several are 3-unrelated-feature "roundups" (`refer-earn-studio-crm-offline-bookings`, `gst-invoices-host-verification-mobile`). Titles are brand voice with no head term: *"Money Follows, My Brotha. Money Follows"*, *"The Opening, again"*, *"Hello, World."* — these cannot match a query.

*(This is a low-information-density judgement per spec §9, not an "AI-written" judgement. Authorship is irrelevant; searchability is the issue.)*

---

## 7. Topical authority, clusters & cannibalization

The curated `blogClusters.js` defines 10 clusters, but they are **product-feature buckets, not search topics**, and **20 posts are unassigned**. **18/51 posts are orphans** (0 inbound internal links). Critically, **both genuine SEO guides are orphans** — the pages most able to rank get no internal support.

**Cannibalization — 7 groups** (same intent competing for one query):

| Group | Posts | Recommended keeper |
|---|---|---|
| C1 | `money-follows-my-brotha` · `where-your-money-sits` | merge → payout explainer |
| C2 | `zero-commission-bet` · `the-arithmetic-of-commission` · `you-only-pay-when-you-earn` | **merge → one "0% commission" money page** |
| C3 | `kyc-only-after-you-earn` · `what-happens-to-your-aadhaar` | merge → KYC/data-safety |
| C4 | `we-audited-our-own-booking-flow` · `two-bookings-one-slot` | keep `two-bookings-one-slot` |
| C5 | `how-explore-ranking-works` · `explore-ranking-and-a-more-app-like-app` | keep the guide; demote the summary |
| C6 | `welcome-aastha-nikhare` · `welcome-mohini-daf` | retire/noindex both |
| C7 | `your-phone-number-is-the-account` · `phone-login-and-reschedule-bookings` | merge → passwordless login |

C2 is the highest-value fix: the three top-opportunity posts on the whole blog are all fighting each other for "0% commission booking."

---

## 8. Internal linking & blog → money

- **18 orphans** (0 inbound internal links) — including the 2 guides.
- **19 posts carry 0 links to any money page** — worst, the highest-intent money/payments posts do it: `razorpay-is-the-source-of-truth`, `where-your-money-sits`, `the-ledger-nobody-asked-for`, `advance-payments-…`, `what-happens-to-your-aadhaar`. A reader who just learned "how payouts work" is given no next step.
- **Money pages receive almost no blog links back**, and (from §9) almost no external links — so even when the blog does link out, there's little authority to pass.
- Curated `priorityLinks` sometimes contradict a post's real topic (e.g. `notifications-that-actually-arrive` placed in the `bolt` cluster though it's a booking/guest-experience post).

---

## 9. Off-site authority & the toxic-link risk

**322 links / 100 referring domains — but the composition is the story:**

- **175 links (54%) come from one self-owned domain, `shubhamdatarkar.com`**, almost all pointing at the host profile `/sndatarkar`. This is a self-network signal, not earned authority.
- **Targets:** 141 → homepage, 173 → `/sndatarkar`, 2 → `/theedulocusway`, 1 each → `/how-it-works`, `/pricing`. **0 → any blog post.** The blog has **no external authority whatsoever.**
- **Toxic footprint:** anchor text includes **"…PBN Network Service"** (×70) and **"Fiverr niche edits, my bookasloth.com outranked competitors"** and "Premium SEO Backlinks" — classic paid/PBN link-scheme fingerprints. This is a **manual-action risk**, independent of the ranking problem.
- The remaining referring domains are launch/tool directories (`twelve.tools`, `debutly.app`, `stackscope.dev`, `comingup.io`, `findly.tools`) — low value, typical of an indie launch.

**Verdict:** authority is **not the *primary* reason the blog is invisible** (the topics have no demand regardless), but it is the **binding constraint for the 11 posts that *do* target real queries**, and the PBN/Fiverr links are a **liability to clean up (disavow review)** before they cause harm.

---

## 10. Ranking Opportunity Matrix

**Scoring method (deterministic, documented in `build_dataset.py`):**
`potential = 0.6·business_value + 0.4·demand_proxy` → `opportunity = potential · (100 − capture)/100`, where `capture` is derived from measured GSC impressions and demand ≤10 caps opportunity (you cannot capture demand that does not exist). `business_value` and `demand_proxy` are analyst constants (proxy — no volume tool); everything else is measured. Full column dictionary in Appendix A.

**Top 12 by opportunity** (the list worth funding):

| Opp | Action | Class | Post |
|---:|---|---|---|
| 75 | CONSOLIDATE→one page | commercial | `the-arithmetic-of-commission` |
| 75 | CONSOLIDATE→one page | commercial | `zero-commission-bet` |
| 70 | OPTIMIZE+PROMOTE | commercial | `you-only-pay-when-you-earn` |
| 70 | OPTIMIZE+PROMOTE | commercial | `what-a-booking-page-needs-in-india` |
| 61 | OPTIMIZE+PROMOTE | host-info | `advance-payments-without-the-screenshot-dance` |
| 56 | OPTIMIZE+PROMOTE | host-info | `digital-marketing-strategy-vibe-coders` |
| 41 | KEEP / merge (C1) | host-info | `money-follows-my-brotha` |
| 41 | CONSOLIDATE (C1) | host-info | `where-your-money-sits` |
| 41 | CONSOLIDATE (C3) | host-info | `what-happens-to-your-aadhaar` |
| 36 | KEEP (monitor) | niche/product | `kyc-only-after-you-earn` |
| 35 | OPTIMIZE | niche/product | `how-explore-ranking-works` |
| 34 | EXPAND | niche/product | `gst-invoices-host-verification-mobile` |

The **top 6** collapse to **~4 real assets** once cannibalization is resolved: **(1)** a "0% commission / commission-cost calculator" page (C2), **(2)** "what a booking page needs in India" (Calendly-alternative angle), **(3)** "how to take advance payments (India)", **(4)** the vibe-coders distribution guide.

---

## 11. Per-article action plan

Full deterministic table with all columns is in **`blog-audit-dataset.csv`** (sorted by opportunity). Bucket summary (§0 Q4) reproduced here; the CSV holds the per-row `recommended_action` + `action_reason`.

**The investment 9** (OPTIMIZE+PROMOTE / OPTIMIZE / EXPAND): the C2 commission page, `what-a-booking-page-needs-in-india`, `advance-payments-…`, `digital-marketing-strategy-vibe-coders`, `how-explore-ranking-works`, `gst-invoices-…`, `money-follows-my-brotha`, `kyc-only-after-you-earn`.

**The 30 to consolidate/retire:** the changelog/postmortem/team/thin majority → move to `/changelog`, merge into a sibling, or `noindex`. **Never auto-delete** — redirect or fold with a 301, keep the URLs' (tiny) equity.

**Do NOT touch (leave indexed, low priority):** the ~12 KEEP posts, including the 2 dev-audience posts (real traffic, but developers don't convert to hosts).

---

## 12. Content-gap roadmap (new topics)

Anchor new content to demand that is **proven to exist on this domain** (host verticals) or **commercially load-bearing** (money-page support). Priority order:

**A. Commercial / alternative cluster (supports `/pricing`, `/be-a-sloth`, existing `/lp/*`):**
- "Calendly alternative for India" (a `/lp/calendly-alternative` already exists — build the supporting guide) · "Topmate alternative" (`/lp/topmate-vs-bookasloth` exists) · "0% commission booking platform" (the C2 merge) · "How to take advance payments for appointments (India)" · "GST invoice for bookings — what a service business needs".

**B. Vertical cluster (mirrors the `/for/<vertical>` pages and the profile pages that already rank):**
- "Booking / appointment software for **education & study-abroad consultants**" (the exact niche `/theedulocusway` ranks in) · "…for **salons**" · "…for **doctors/clinics**" · "…for **coaches & therapists**" · "…for **lawyers**". Each links to its `/for/` page and to real host profiles as proof.

**C. Bottom-of-funnel informational (host retention/activation):**
- Keep/ą upgrade `how-explore-ranking-works` (already the flagship) and cross-link from onboarding.

**Rule:** each new post targets one real query, links to exactly one money page and one `/for/` page, and includes a `{faq}` block. No more untargeted changelog posts in `/blog`.

---

## 13. Structural recommendations

1. **Split changelog from blog.** Route product-update/postmortem/team posts to `/changelog` (or a `category=changelog` that is `noindex,follow`). Reserve `/blog` for search-targeted evergreen content. This alone removes ~30 low-value URLs from the indexable blog and concentrates authority.
2. **Rebuild clusters around search topics, not features.** Replace the 10 feature buckets with ~4 topic pillars: **Commission/pricing**, **Payments & payouts**, **Getting-found/marketing**, **Vertical guides**. Each pillar = one deep page + supporting posts that link up to it.
3. **Wire the three-way link system:** blog post ↔ money page ↔ `/for/<vertical>` page ↔ host profile. This is how the blog finally *supports the only engine that ranks.*
4. **Author entities:** real `Person` authors + author pages.
5. **Taxonomy:** keep having **no** thin category/tag pages — do not create them unless each carries unique indexable content. (Current absence is a strength.)
6. **URLs:** leave existing slugs alone (changing URLs risks equity for ~0 gain here). Only redirect on consolidation.

---

## 14. Automation — feeding the SEO Audit Engine

The parallel engine (`server/services/seo/*`, registry pattern `<category>.<slug>`, `v3.145` tables `crawls/pages/issues/scores/mutes`) can carry most of this audit as **recurring** checks. Mapping:

| Finding | Suggested rule key | autoFixable? | Notes |
|---|---|---|---|
| Missing/short/duplicate title, meta, H1 | `onpage.*` (exists) | some | already implemented |
| Post has 0 inbound internal links | `links.orphan_no_inbound` | no | needs `internalLinkTargets` (already in ctx) vs page URL |
| Thin content | `content.thin_wordcount` | no | parser can count body words |
| FAQ present as H2 but no FAQPage schema | `schema.missing_faqpage` | **yes** | detect "FAQ" heading + absent `FAQPage` JSON-LD |
| `author` = Organization not Person | `schema.author_not_person` | yes | JSON-LD check |
| Money/commercial post with 0 money-page links | `links.no_money_page_link` | no | link-target allowlist |
| Near-duplicate title/intent across posts | `cannibalization.duplicate_intent` | no | `siteCheck` over titleCounts + embeddings |
| Unknown slug returns 200 + indexable shell | `indexability.soft_404` | no | crawler already sends bot UA; check status vs sitemap membership |
| Brand-only title (no head term) / changelog in `/blog` | `strategy.zero_demand_topic` | no | flag-for-review only |
| Sitemap URL with 0 impressions after N days | `perf.zero_impressions` | no | requires GSC ingest into `pages`/`scores` |

**Keep human:** topic/keyword strategy, merge/consolidate decisions, disavow file, new-content roadmap. **Auto-fixable safely:** metadata length/description, FAQ-schema emission, author-schema. **Never auto:** URL changes, redirects, deletions, `robots.txt`/canonical changes (require approval) — matches the engine's `autoFixable` gating.

---

## 15. Prioritized roadmap

**Immediate (this week) — unblock & de-risk:**
- Disavow-review the PBN/Fiverr links (§9).
- Fix the blog soft-404 (§4).
- Add `FAQPage` schema to the 2 guides (§4).
- Submit the 6 real posts for indexing in GSC.

**High impact (2–4 weeks) — concentrate authority:**
- Execute the C2 commission merge into one page; resolve the other 6 cannibalization groups.
- Move ~30 changelog posts to `/changelog` / `noindex`.
- Wire blog ↔ money-page ↔ `/for/` internal links; add `Person` authors.

**Medium (1–2 months) — build the real assets:**
- Expand the 4 core assets (§10) to genuine depth + earn 3–5 real links each.
- Ship the vertical cluster (§12B), one post per `/for/` page.

**Long term (quarter+) — earn authority the domain lacks:**
- Real link acquisition (not PBN): launch directories done right, guest posts, host co-marketing, HARO/expert quotes.
- Feed GSC data into the SEO Audit Engine so these signals are monitored continuously (§14).
- Re-pull GSC in 90 days to measure whether the 4 assets began earning impressions (the true success metric — impressions on target queries, not "rankings").

---

## Appendix A — dataset column dictionary (`blog-audit-dataset.csv`)

`slug, url, category, author, published, updated, age_days, days_since_update, read_mins, word_count, block_count, title_len, excerpt_len, faq_count, faq_schema_emitted, has_table, intent, target_query, target_class, demand_proxy, business_value, internal_links_in, internal_links_out, money_page_links, is_pillar, cluster, is_orphan, thin_flag, cannib_group, gsc_impressions, gsc_clicks, gsc_position, backlinks_to_url, opportunity_score, recommended_action, action_reason`

- **Measured:** everything except `demand_proxy` / `business_value` (analyst proxy) and `target_class` (derived from those two).
- **`is_orphan`** = 0 inbound internal links. **`faq_schema_emitted`** = has `{faq}` block (H2 FAQs = false). **`cannib_group`** = C1–C7 (§7).

## Appendix B — cannibalization groups
See §7 table. Keepers chosen by depth (word count) then inbound links; the human decision on which URL survives a merge is deliberately left open (spec: never auto-merge).

## Appendix C — reproducing this audit
Scripts + raw inputs live in the analyst scratchpad: `parse_inputs.py` (GSC xlsx + backlinks → CSV), `build_dataset.py` (join + scoring), `blog_content_dataset.json` (per-post content analysis), `db_meta.csv` (prod snapshot), `gsc_*.csv` (GSC tabs). The Opportunity Score and buckets are fully deterministic — rerun `build_dataset.py` to regenerate `blog-audit-dataset.csv` + `aggregates.json`.
