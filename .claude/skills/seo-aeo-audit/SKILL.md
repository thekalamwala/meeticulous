---
name: seo-aeo-audit
description: Use to run a repeatable, evidence-gated technical-SEO + AEO/GEO audit of Meeticulous against 6 pillars (technical baseline, topical authority, query fan-out, backlink-worthiness, digital-PR readiness, SEO automation). Produces docs/seo-aeo-audit.md with a scorecard, Gap→Evidence→Fix→Impact/Effort findings, P0/P1/P2 priorities, and missing-page briefs. Every finding must cite a file:line or a prod/DB observation. Trigger "SEO audit", "AEO audit", "technical SEO review", "/seo-aeo-audit". This is the AUDIT step of the chain audit→plan(seo-topical-map)→write(blog-seo-optimizer)→measure.
---

# Meeticulous — SEO/AEO Audit (repeatable)

Audit the **codebase AND prod config** against the 6 pillars below. Output is a single report at
`docs/seo-aeo-audit.md`. The rule that makes this useful: **evidence or it didn't happen** — every
claim cites a `file:line` or a prod/DB observation. No vibes.

## 0. Before you start — know the stack (it trips people up)
- **Vite SPA, NOT Next.js.** No SSR. Crawler HTML comes from: build-time prerender
  (`client/scripts/prerender.mjs`), the server bot-prerender (`server/controllers/prerenderController.js`
  via `client/middleware.js`), and the static shell (`client/index.html` → `dist/spa-shell.html`).
- Per-route tags: `client/src/components/common/Seo.jsx`; schema builders: `client/src/utils/seo.js`;
  sitemap: `server/services/sitemapService.js`; routes: `client/src/App.jsx`.
- **If egress is blocked** (cloud sessions often are): you cannot curl prod or run Lighthouse.
  Derive "what crawlers see" from the prerender SOURCE (it generates that exact HTML) and **tag every
  live-only claim `[VERIFY LIVE]`** in a dedicated "access I don't have" section. Never fake a status code.

## 1. The 6 pillars — what to check, where
**P0 Technical baseline** — per-route title/description/canonical/OG (`Seo.jsx`, `index.html`);
sitemap vs reality (does every prerendered route appear? grep `prerender.mjs` route lists against
`sitemapService.js` STATIC_ROUTES — drift is the classic bug); robots (`client/public/robots.txt`);
JSON-LD types present (Organization, WebSite+SearchAction, SoftwareApplication, Product, Service,
FAQPage, BreadcrumbList, Article); **check every asset a schema references actually exists**
(e.g. a `logo` URL → `find client/public`); noindex leaks; 404 handling (`middleware.js`); one h1.
**P1 Topical authority** — build the ideal map for the core topic; map existing pages; **reconcile
targeting against real host supply** (DB — see §2); flag empty-vertical pages (doorway risk).
**P2 Query fan-out (AEO)** — per money keyword, 6–10 sub-questions → map to page/section or MISSING;
answer-first H2s; FAQPage backed by visible FAQ. Check pages that have FAQ content but emit no schema.
**P3 Backlink-worthiness** — "would anyone link here without search engines?"; inventory tools/
calculators/templates/glossary/data; entity NAP consistency (schema vs `Footer.jsx` vs legal pages).
**P4 Digital-PR readiness** — press/data page? dataset? embeddable chart? **Gate data-story angles on
volume** (see §2 — a headline off 49 bookings is malpractice).
**P5 SEO automation** — what skills exist (`.claude/skills/`), what's missing in audit→plan→write→measure.

## 2. The DB checks that change conclusions (read-only, aggregates only, NO PII)
Prod project `ayjhlwyzszykqtnaktpb` (staging `xwvciqkayammbvsidqig`). Always run these — they have
overturned "looks fine" audits before:
- **Review honesty:** `select count(*), round(avg(rating),2) from reviews` — compare against any
  hardcoded `aggregateRating.reviewCount` (e.g. `Home.jsx`). A big gap = a structured-data policy risk,
  and it violates the repo's own real-reviews-only rule. Flag as P0, do NOT invent a replacement number.
- **Supply vs targeting:** `select primary_category, count(*) from profiles where role='host' and
  is_verified and coalesce(is_indexable,true) group by 1 order by 2 desc` — compare the top categories
  against the `/for/*` + `/services/:profession` pages. Pages for professions with ~0 hosts are thin.
- **Funnel scale:** `select status, count(*) from bookings group by 1` + totals of hosts/services/blogs.
  This sets the data-PR thresholds and the honesty of any "X% of appointments…" claim.

## 3. Output format (write to docs/seo-aeo-audit.md)
1. Scope/assumptions/method + platform-scale table (the DB numbers) + **[VERIFY LIVE]** note if egress blocked.
2. Scorecard: `Pillar | Score /10 | Biggest gap | Top fix`.
3. Per-pillar findings, each: **Gap → Evidence(file:line / obs) → Fix → Impact(H/M/L) → Effort(S/M/L)**.
   Mark shipped fixes "✅ shipped"; mark judgment calls "NEEDS YOU".
4. Priority list: P0 (this week) / P1 (this month) / P2 (backlog).
5. Missing pages: `slug · role · target query · 5-line brief` each.
6. "Access I don't have" — exact commands/tools for the user to run (curl, Lighthouse, GSC, Ahrefs, crawl).

## 4. Then implement (only if asked / only the safe subset)
On a feature branch, implement **low-risk, code-only P0s** one commit per fix: metadata, schema, sitemap,
robots, internal links, alt text. **Run `cd client && npx vitest run src/utils/__tests__/seo.test.js`
before committing schema changes.** Do NOT auto-change anything that needs a human number (review counts)
or per-page content judgement; leave those as "NEEDS YOU". No PRs/merges unless explicitly asked
(CLAUDE.md: stop at the PR, user merges).

## Landmines (learned the hard way)
- Shared layouts hide `<Seo>` — a page can be "covered" via `LegalLayout.jsx`/a Hero even if the page
  file has no `<Seo>`. Grep the layout before declaring a gap.
- `prerender.mjs` route lists and `sitemapService.js` are hand-mirrored (ESM vs CJS) — they drift.
- Googlebot is deliberately excluded from `middleware.js` bot-prerender (it runs JS) — not a bug.
- `SearchAction` must point at a real route (`/search` exists) — verify before flagging.
