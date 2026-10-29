---
name: seo-topical-map
description: Use to turn a money keyword into a plan — build the ideal topical map (hub/supporting/definitional/question), run the AI-search query fan-out (6-10 sub-questions per keyword), map Book A Sloth's existing public pages onto it, and emit ready-to-write page briefs (slug/role/target query/5-line brief). Reconciles targeting against ACTUAL host supply in the DB so you don't plan pages for professions with no hosts. Trigger "topical map", "content plan", "query fan-out", "what pages should we build", "/seo-topical-map". This is the PLAN step of audit→plan→write(blog-seo-optimizer)→measure; hand briefs to blog-seo-optimizer / bas-seo-schema to build.
---

# Book A Sloth — Topical Map & Query Fan-out Planner

Input: one or more **money keywords** (ask for them; infer from `docs/seo-aeo-geo-plan.md` + pricing
copy if blank). Output: a topical map with coverage gaps + page briefs you can hand to the writer.

## Step 1 — Inventory what exists (don't re-plan what's built)
Read the route table in `client/src/App.jsx` and the prerender list in `client/scripts/prerender.mjs`.
Group public pages by role:
- **Hub:** `/appointment-booking-software`. **Commercial:** `/pricing`, `/lp/*-alternative`, `/compare`, `/solutions`.
- **Feature cluster:** `/features/:slug` (data: `client/src/pages/features/featureData.js`).
- **Industry cluster:** `/for/:profession` (bespoke in `client/src/pages/for/`; data fallback
  `professionLandingData.js`). **Directory:** `/services/:profession` (`professionSeoContent.js`).
- **Question tier:** `/blog/:slug` (DB `blogs`; seed `client/src/data/blogPosts.js`; clusters
  `client/src/data/blogClusters.js`). **Definitional:** `/help/docs/*` (+ any glossary).

## Step 2 — Build the ideal map for the keyword
For the core topic, lay out the tiers: HUB → SUPPORTING (commercial) → FEATURE → INDUSTRY → DIRECTORY →
DEFINITIONAL ("what is…") → QUESTION (blog). Mark each node EXISTS / THIN / MISSING with the file path.
Compute a coverage ratio (live nodes / ideal nodes). Call out: the **definitional/glossary tier is the
usual gap**; competitor `/lp` pages are the usual "exists but under-schema'd".

## Step 3 — Query fan-out per money keyword (the AEO core)
For each keyword, write the **6–10 sub-questions an AI engine researches before answering** (what/why/
how/cost/vs-competitor/for-whom/integrations/free-tier/India-specifics). Map each to an existing
page#section or mark **MISSING**. A sub-question answered only "scattered across blog" = a page brief.
Verify the target page opens its answer **answer-first** (self-contained 1–2 sentence H2) and has a
FAQPage-backed FAQ — if not, that's a fix, not just a gap.

## Step 4 — Reconcile against REAL supply (the step everyone skips)
Run (read-only, aggregates only, prod `ayjhlwyzszykqtnaktpb`):
`select primary_category, count(*) from profiles where role='host' and is_verified
 and coalesce(is_indexable,true) group by 1 order by 2 desc`.
- Industry/directory pages for a category with **~0 hosts** are thin doorway pages — do NOT prioritise
  them; either enrich with genuinely useful profession content or exclude from the sitemap until supply exists.
- Categories with **real supply but no `/for` page** are your highest-ROI new pages. (Historically the
  supply skews consultants / software-engineers / creators / career-coaches — not the healthcare/salon
  verticals the program over-built.)

## Step 5 — Emit page briefs
For every MISSING or THIN node that supply + intent justify, output a 5-line brief:
```
slug · role (map tier) · target query
Brief: intent · angle · key sections (answer-first H2 + FAQ) · internal links · schema type
```
Prefer schema builders that already exist in `client/src/utils/seo.js`
(`professionGraphJsonLd`, `articleGraphJsonLd`, `faqJsonLd`, `collectionPageJsonLd`). New tool/glossary
pages → `WebApplication`/`DefinedTermSet` + `FAQPage`.

## Handoff
- Blog/question pages → **blog-seo-optimizer** (it does SERP/gap analysis, scoring, PR).
- Landing/feature/industry pages → build the component, then **bas-seo-schema** for the JSON-LD (two-path sync).
- Keep every planned page in exactly one map tier with a distinct target query (no cannibalisation —
  if two briefs share intent, merge them).

## Guardrails
- Plan for intent that converts to bookings/trials, never vanity traffic (`docs/seo-aeo-geo-plan.md`).
- Never propose a page whose only content would be invented stats/fake reviews.
- India-first (then UAE/UK/AU/US); surface India-specific angles (UPI, GST) — they're under-served and link-worthy.
