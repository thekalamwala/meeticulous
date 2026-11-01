---
name: bas-seo-schema
description: Use when adding, editing, or reviewing JSON-LD / structured data / aggregateRating / prerender SEO for Meeticulous's public pages (host profiles, services, professions, org, home) — the AEO/GEO schema layer that is NOT blog. Enforces the two-path (client seo.js ↔ server prerender shell) sync rule, the real-reviews-only rating guard, sameAs mirroring, and the prerender/ipGuard/reservedSegments landmines. Trigger: "add JSON-LD", "schema for host/service", "aggregateRating", "structured data", "AEO schema", "prerender SEO", "/bas-seo-schema". (For blog posts use blog-seo-optimizer instead.)
---

# Meeticulous — SEO/AEO/GEO Schema (non-blog)

Structured data for public pages lives in **two hand-mirrored implementations**. The #1 failure
mode is editing one and forgetting the other → Google sees different schema for bots vs users.
This skill exists to make that impossible to forget.

## The two paths (ALWAYS edit both)

| Path | File | Serves | JS dep on client? |
|---|---|---|---|
| **Client (SoT)** | [client/src/utils/seo.js](../../../client/src/utils/seo.js) | Real users + build-time Puppeteer prerender (`client/scripts/prerender.mjs`) | — |
| **Server shell** | [server/controllers/prerenderController.js](../../../server/controllers/prerenderController.js) | Runtime **bot-only** HTML shell (`buildHtml()`) | **No** — deliberately independent (own `faqPageLd()`), so a client refactor never breaks the bot shell |

Client `seo.js` is the source of truth. The server shell re-implements the same nodes by hand.
**Any schema change to a host/service node must land in BOTH files in the same PR.**

Coverage gap: **profession pages (`/services/:slug`) have NO server shell** — they get JSON-LD
only via build-time Puppeteer capture of client `Seo.jsx` in `client/scripts/prerender.mjs`.
So for professions the "second path" is the build prerender, not `prerenderController.js`.

### Node → function map (client seo.js)
- `serviceJsonLd()` :72 — `Service` + nested `Offer` (+ optional `aggregateRating`).
- `profileJsonLd()` :132 — `ProfilePage` → `mainEntity` Person, `makesOffer` Offers, host rating.
- `organizationJsonLd()` :209 / `orgNode()` :283 — `Organization` (+ logo ImageObject). `ORG_SAME_AS` :200.
- `breadcrumbJsonLd()` :225 · `collectionPageJsonLd()` :245 · `faqJsonLd()` :267 · `contactPageJsonLd()` :415.
- `articleGraphJsonLd()` :311 — single `@graph` for blog (owned by **blog-seo-optimizer**, not this skill).
- Home `SoftwareApplication` + platform rating: `client/src/pages/Home.jsx:137` (reviewCount hardcoded, :154).
- Profession landing: `client/src/pages/for/ProfessionLanding.jsx:256` — `SoftwareApplication`+`Service`+`FAQPage`+`BreadcrumbList`, **no aggregateRating by design** (:272).

Server mirrors: host `resolveProfileMeta()` :177 (Person jsonLd :219), service `resolveServiceMeta()` :292 (jsonLd :326).

## Hard rules

1. **aggregateRating = REAL reviews only.** The node is emitted ONLY behind the guard
   `reviewCount > 0 && avgRating > 0`. Never a fallback/platform default on a host or service —
   that would be reviews not about that entity. Present in all 4 places, keep identical:
   - client service `seo.js:93`, client profile `seo.js:147`
   - server profile `prerenderController.js:235`, server service `prerenderController.js:343`
   Platform-wide rating lives ONLY on the homepage `SoftwareApplication` node (keep it truthful).
   Fabricated/global ratings on entity pages = GSC structured-data violation → manual action risk.

2. **sameAs is mirrored.** Client `sameAsFromSocials()` `seo.js:126` ↔ server
   `sameAsFrom()` in `server/services/seo/pageContentModel.js`. Both read `host.social_links`
   (JSONB), keep only `http(s)` identity URLs, drop email/whatsapp/blanks. Change the allow-list
   in one → change the other.

3. **Never render null on a prerendered page.** Prerendered React must not return `null`
   (hydration mismatch). See memory `prerender-hydration-null-and-font-bake`.

4. **New public SEO route → register the first segment in BOTH reserved lists** or it collides
   with usernames:
   - client `client/src/config/reservedSegments.js` (`RESERVED_FIRST_SEGMENTS`)
   - server `server/config/reservedNamespaces.js`
   Sync tests will fail otherwise: `client/src/__tests__/routeManifestSync.test.jsx`,
   `server/tests/unit/reservedSegmentsSync.test.js`.

5. **Stop at the PR. Never merge** (merge auto-deploys prod). Fresh branch from `origin/main`.

## Prerender / crawler landmines
- **ipGuard self-ban:** build-time fetches burst from a raw Render IP → 429 → auto-ban → soft-404
  shells shipped. Fix is identity, not IP: `PRERENDER_BUILD_TOKEN` must be set on **Render AND
  Vercel**; `client/scripts/prerender.mjs:337` sends `x-prerender-token`, `server/middleware/ipGuard.js:79`
  (`isPrerenderBuild()`) exempts it. Memory: `prerender-ipguard-selfban-dynamic-pages` (#1047),
  `prerender-build-self-ban-876`.
- Sitemap/prerender paths exempt via `EXEMPT_PREFIXES` `ipGuard.js:33` (`/prerender /sitemap /api/blogs`).
- Sitemap host/service/profession routes are **PROD-ONLY** (`sitemapService.js` fetchers; consumed
  by `hostServiceRoutes()` `prerender.mjs:207`). Memory: `prerender-host-service-routes`.
- Verify OG/prerender as a bot: `curl -A facebookexternalhit <url>` and `curl -A Googlebot <url>` —
  a normal browser fetch hits the SPA, not the shell.

## SEO audit engine (admin, separate from schema emit)
Read/score/propose/apply pipeline — touch only when the task is the audit tooling, not page schema.
- Engine: `server/services/seo/seoAuditService.js` (crawl/score/dashboard/opportunities).
- Fixes: `server/services/seo/fixes/index.js` (`generateProposals()`), `.../fixes/apply.js`
  (`FIELD_MAP` :19 **empty by default**, `SEO_APPLY_DB_FIELDS`, `SEO_FIX_DRY_RUN` defaults `true`).
  DB auto-apply is inert until a column is opted into `FIELD_MAP` + `SEO_APPLY_DB_FIELDS` +
  `SEO_FIX_DRY_RUN=false`. Memory: `seo-audit-phase1-990`.
- Admin UI: `client/src/pages/admin/AdminSeo.jsx` (route `/admin/seo` `App.jsx:585`); backend
  `server/routes/seoRoutes.js` gated by `requireAdmin('seo.manage')`.

## Workflow for a schema change
1. Fresh branch from `origin/main`.
2. Edit the node in **client `seo.js`** (source of truth).
3. Mirror the SAME change in **server `prerenderController.js`** (host/service) — and, for a
   sameAs/allow-list change, in `pageContentModel.js`. Profession-only change → also
   `ProfessionLanding.jsx` + confirm `prerender.mjs` captures it.
4. Keep every `aggregateRating` behind `reviewCount > 0 && avgRating > 0`.
5. New route? Register first segment in both reserved lists.
6. Validate JSON-LD: paste emitted output into a schema validator; confirm required fields;
   `FAQPage` only when FAQs exist.
7. Bot-check: `curl -A Googlebot`/`facebookexternalhit` the affected URL(s) — schema present, one
   JSON-LD per type, no duplicate/conflicting `@type`.
8. `cd client && npx vitest run` (SEO/route-sync tests are a deploy gate — one stale test blocks
   ALL Vercel deploys). `cd server && npm test` if server changed.
9. Commit → `gh pr create` → **STOP.** PR body: note "edited both JSON-LD paths" + any env
   (`PRERENDER_BUILD_TOKEN`) or reserved-list changes.

## Review checklist (for auditing an existing schema PR)
- [ ] Both paths edited (client seo.js + server shell) — or professions justified via prerender.
- [ ] Every `aggregateRating` guarded by real-review counts; no platform default on entity pages.
- [ ] sameAs allow-lists still match across client/server.
- [ ] New route registered in both reserved lists; sync tests pass.
- [ ] No `null` render on a prerendered page.
- [ ] Validator-clean; no duplicate `@type`; FAQPage only with FAQs.
- [ ] Bot curl shows the schema in the shipped HTML.
