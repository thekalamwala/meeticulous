# SEO / AEO / GEO Playbook (portable)

_Written 2026-10-09 from what Book A Sloth (BAS) actually built and measured. Use it to set up the same system on another site. The other site is on **Next.js (App Router, SSR)**, so every BAS technique comes with its Next.js equivalent._

**How to use this file:** copy it into the other repo (e.g. `docs/seo-aeo-geo-playbook.md`) and give your coding agent the prompt in [§12](#12-prompt-to-paste-into-the-other-codebase). Work through the [§11 checklist](#11-execution-checklist-phased) in order.

---

## 0. Definitions and the one goal

| Term | Means | Where you win it |
|---|---|---|
| **SEO** | Rank in normal search results | Google, Bing |
| **AEO** (Answer Engine Optimization) | Get chosen for answer boxes, rich results, featured snippets, voice answers | Google AI Overviews, snippets, People Also Ask |
| **GEO** (Generative Engine Optimization) | Get cited inside AI-written answers | ChatGPT search, Perplexity, Gemini, Claude, Copilot |

**Goal:** organic traffic from people who then book, start a trial or pay. Traffic without a path to conversion doesn't count.

Every page should go: **Intent → Experience → Trust → Conversion.**

---

## 1. The hard lessons (read these first)

BAS learned these by measuring. They matter more than any single technique below.

1. **Good technical SEO doesn't get you rankings; it only gets you a chance.** BAS built prerendering, sitemaps, JSON-LD and canonicals, and passed every technical audit. Even so, **50 of 51 blog posts got 0 impressions in 6 months.** The forensic audit put the causes at roughly **65% topic choice, 20% authority (0 backlinks), 10% young domain, 5% internal linking. Technical problems accounted for about 0%.**
2. **Write for queries people actually search, not for yourself.** About 78% of posts were changelog or brand-voice pieces with no search demand. Put product updates on `/changelog`. The blog is only for topics with real search volume.
3. **The pages that ranked were the money pages:** host profile pages (user-generated, local, specific). Expect the same on the new site: entity pages (profiles, listings, locations, products) and commercial pages ("X for Y", "Z alternative") get traffic before blog posts do.
4. **Order of work:** commercial-intent pages → industry/profession pages → feature pages → blog posts. Every blog post must link to one of the first three.
5. **Never fake trust signals.** Only add `aggregateRating` when real reviews are visible on the page. Only add FAQ schema when the Q&A is visible on the page. Never invent statistics. Google penalises these, and so does the BAS scoring engine.
6. **Toxic backlinks hurt.** BAS found PBN and Fiverr links. Audit backlinks early and disavow bad ones.
7. **Thin or empty pages that return HTTP 200 become soft-404s.** Unknown slugs must return a real 404 status with `noindex`. Never redirect a dead URL to the homepage; Google treats that as a soft-404 too.

---

## 2. Strategy

### 2.1 Classify intent before writing anything

| Intent | Example | Page goal |
|---|---|---|
| Informational | "how to reduce appointment no-shows" | Teach, then link to a feature or commercial page |
| Commercial | "best scheduling software", "calendly alternative" | Convince (comparison, alternatives, "for X" pages) |
| Transactional | "appointment software india pricing" | Convert (pricing, signup) |
| Navigational | "brand login" | Send the visitor to the right page |

### 2.2 Content pillars → clusters

Pick 4–6 pillars that match what the product does. BAS used Scheduling, Payments, Automation, Industry guides and Growth. Each pillar gets:
- **one hub/pillar page** (e.g. `/appointment-booking-software`)
- **supporting pages** (features, professions)
- **definitional pages** (glossary)
- **question pages** (blog/help answers to People Also Ask questions)

Write a **topical map** (hub, then supporting, definitional and question tiers) for each money keyword before writing any page.

### 2.3 Page types BAS shipped (copy the ones that apply)

| Page type | BAS route | Count | Why it exists |
|---|---|---|---|
| Profession landings | `/for/<profession>` | 26 | "booking software for therapists" queries |
| Feature pages | `/features/<feature>` | 10 | One page per feature query ("whatsapp appointment reminders") |
| Comparison / alternatives | `/lp/<competitor>-alternative` | 6 | "calendly alternative", "X vs Y" (high buying intent) |
| Hubs | `/solutions`, `/compare`, `/appointment-booking-software` | 3 | Crawlable links to the landing pages, which hide the main nav |
| Programmatic directory | `/services/<profession>` | DB-driven | Category pages with **unique** intro and FAQ copy each (no template spam) |
| Glossary | `/glossary/<term>` | 23 | Definitions that AI engines can quote |
| Free tools | `/tools/<calculator>` | 2 | Link bait plus a commercial hook |
| Help docs | `/help/docs/<slug>` | 26 | Long-tail "how do I" queries |
| Entity pages (user-generated) | `/<username>`, `/<username>/<service>` | DB | **The only pages that actually ranked** |
| Blog | `/blog/<slug>` | DB | Only for topics with real search demand |

**Rule for programmatic pages:** each page needs unique, factually guarded copy (intro, FAQ, card text). If 200 pages differ only by a swapped noun, they're thin content.

---

## 3. Technical foundation: BAS (Vite SPA) → Next.js

BAS is a client-rendered SPA, so it needed a lot of workarounds: a Puppeteer prerender, an edge middleware that sniffs bot user-agents, a server-side HTML builder for bots, and two copies of the JSON-LD code. **Next.js SSR/SSG removes all of that. Don't port the workarounds, only the rules.**

| Concern | BAS implementation | Next.js equivalent |
|---|---|---|
| Crawlable HTML | Puppeteer prerender at build (`prerender.mjs`) plus edge middleware sending bot user-agents to `/prerender/:user` | Server Components with SSG (`generateStaticParams`) for marketing pages and ISR (`revalidate`) for DB entities. **No user-agent sniffing**, because everyone gets the same HTML. |
| Head tags | Custom `<Seo>` component that edits `document.head` | `export const metadata` / `generateMetadata()` |
| Canonical | Built from the current path, never stored; apex `.com`; www→apex 308 | `metadataBase: new URL('https://site.com')` + `alternates: { canonical: '/path' }`; www→apex in `next.config` `redirects` or at DNS/host level |
| JSON-LD | `seo.js` builders on the client **plus a hand-kept copy on the server** (the two had to be synced every time) | One builder module rendered in a Server Component, so there's **one source of truth**. This is the biggest win. |
| Sitemap | Express controller, index + chunks of 45k URLs, built from the DB, 1h cache | `app/sitemap.ts`; `generateSitemaps()` for chunks; `revalidate` |
| robots.txt | static `public/robots.txt` | `app/robots.ts` |
| OG images | Puppeteer screenshots of `/og/*` routes run as a GitHub Actions cron, plus status/hash columns in the DB | `opengraph-image.tsx` with `ImageResponse` (`next/og`): generated on request and cached. No cron or Chromium needed. |
| Soft-404 | `.bas-error` detection during prerender, plus 404 + noindex for unknown usernames | `notFound()` inside the page/`generateMetadata` gives a real 404 status. Add `robots: { index: false }` on `not-found.tsx`. |
| noindex | `is_indexable` column → robots meta + left out of the sitemap | Same column → `metadata.robots` **and** the sitemap filter (always both together) |
| Renamed slugs | 301 to the current username in middleware | `permanentRedirect()` in the page, or `redirects()` |
| Fonts / CLS | Self-hosted woff2 + hand-tuned `size-adjust` fallbacks | `next/font` (it generates metric-matched fallbacks automatically) |
| LCP image | `fetchpriority=high` on the hero/cover image | `<Image priority />` (or `fetchPriority="high"` in Next 15+) |
| Analytics weight | PostHog loaded via dynamic import when the browser is idle; marketing tags only after consent | `<Script strategy="lazyOnload">`, or a dynamic import inside `useEffect` |
| Critical CSS | Beasties inline at prerender | Mostly built in (CSS chunked per route). Don't bolt anything on. |

### 3.1 Snippets (App Router)

**JSON-LD component (single source):**
```tsx
// components/JsonLd.tsx
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // escape "<" so user-generated text can't close the script tag
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
```

**Title fallback ladder (BAS rule: stay ≤60 chars, never truncate a user-written title):**
```ts
export function seoTitle(base: string, host?: string, brand = 'Brand') {
  const tries = [`${base} with ${host} | ${brand}`, `${base} with ${host}`, base];
  return tries.find(t => !t.includes('undefined') && t.length <= 60) ?? base;
}
// description: trim to 160 chars; "in {City}" only for in-person/local offerings
```

**Sitemap (chunked, DB-driven):**
```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next';
const PAGE = 45_000;
export async function generateSitemaps() {
  const n = await countIndexableEntities();             // verified && !banned && is_indexable
  return Array.from({ length: Math.ceil(n / PAGE) || 1 }, (_, id) => ({ id }));
}
export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  // Next 16: `id` arrives as a Promise; `await` it.
  const rows = await listIndexableEntities(id * PAGE, PAGE);
  return rows.map(r => ({ url: `https://site.com/${r.slug}`, lastModified: r.updated_at }));
}
export const revalidate = 3600;
```
Static pages, blog, categories: keep them in separate sitemap files (or separate `id` ranges) so a problem in one shows up on its own in Search Console.

**robots:**
```ts
// app/robots.ts
import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  const ai = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot',
              'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended'];
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/dashboard', '/api/', '/auth/', '/login', '/og/'] },
      ...ai.map(userAgent => ({ userAgent, allow: '/' })),
    ],
    sitemap: 'https://site.com/sitemap.xml',
  };
}
```

---

## 4. Structured data (JSON-LD) catalog

**Rules (apply to every page):**
- Use a single `@graph` per page with stable `@id`s (`https://site.com/#organization`, `/#website`, `<url>#author`, `<url>#primaryimage`) so the nodes reference each other.
- Schema must match the visible content. **FAQPage only when the Q&A is rendered on the page. `aggregateRating` only when `reviewCount > 0 && avgRating > 0` from real reviews.** The platform-level rating goes on the homepage only. Never add it to landing, comparison or tool pages; Google treats those as self-serving reviews.
- Leave out `price` when the price is "on request"; don't write `0`.
- `sameAs` must be an allow-listed set of real profiles (LinkedIn, IG, X, FB, Wikipedia/Wikidata if you have them).
- Set `inLanguage` (BAS uses `en-IN`).
- Validate every type with Google Rich Results Test and validator.schema.org before shipping.

| Page type | Schema types |
|---|---|
| Global (inside every graph) | `Organization` (legalName, logo ImageObject, PostalAddress, ContactPoint with languages, sameAs) + `WebSite` |
| Home | + `SearchAction`, `SoftwareApplication` (+ real AggregateRating) |
| Pricing | `Product` + `Offer`s + `Brand` (prices **must match** the visible pricing table and llms.txt) |
| Profession / "for X" | `SoftwareApplication`, `HowTo`, `FAQPage`, `BreadcrumbList`, `speakable` (`cssSelector: ['h1', '#faq']`) |
| Feature | `SoftwareApplication`, `HowTo`, `FAQPage`, `BreadcrumbList` |
| Comparison | `SoftwareApplication`, `FAQPage`, `BreadcrumbList`, `speakable` |
| Blog / help article | `@graph`: WebSite, Organization, ImageObject `#primaryimage`, **Person `#author`**, WebPage, `BlogPosting`, BreadcrumbList, + FAQPage when there's a visible FAQ |
| Entity profile | `ProfilePage` → `Person` (`hasOccupation`, `knowsAbout`, `sameAs`, `makesOffer`, `dateModified`) |
| Entity service / product | `Service` + `Offer` (+ AggregateRating only when it's real) |
| Listing / hub / directory | `CollectionPage` + `ItemList` |
| Glossary | `DefinedTermSet` / `DefinedTerm` + `speakable` (`#definition`) |
| Free tool | `WebApplication` (free Offer) |
| Careers | `JobPosting` · Contact → `ContactPage` |

---

## 5. AI crawler access (GEO)

- **Allow the AI search bots** (`OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`). These control whether AI search can cite you.
- **Training bots** (`GPTBot`, `ClaudeBot`, `Google-Extended`) are a business decision. Blocking them does **not** hurt AI-search visibility, according to OpenAI's and Anthropic's docs. BAS allows them.
- ⚠️ **Check your CDN/WAF.** BAS's robots.txt welcomes AI bots, but Cloudflare Bot Fight Mode returns 403 to them anyway. robots.txt has no effect if the edge blocks the request. Check with `curl -A "ClaudeBot" -I https://site.com/` and the same for `PerplexityBot` and `OAI-SearchBot`. You need a 200.
- Never add page-level `nosnippet` or `max-snippet:0` to pages you want cited.
- Important content must be in the HTML text, not inside images or loaded only after JavaScript runs. With SSR that's free; still keep FAQ answers in the DOM (use `<details>`, not lazy-loaded accordions).

### 5.1 llms.txt template

BAS ships `public/llms.txt`. It costs little but **don't expect it to move rankings.** The BAS scoring framework gives it no credit (no engine has confirmed using it). Keep it accurate. Stale prices in it are worse than not having the file.
```
# Brand
> One-paragraph plain summary: what it is, who it's for, where.

## Key facts
- Plans & prices (MUST match /pricing)
- Differentiators (e.g. 0% commission, local payments)
- Page URL pattern for entities

## Main pages
- [Pricing](https://site.com/pricing): one-line description
## Features
## Comparisons
## For professions / industries
## Legal
## Notes for crawlers
- Sitemap: https://site.com/sitemap.xml
- Private areas (/dashboard, /admin) are not for indexing or training.
```
Optional extra: `ai-catalog.json` (a list of agent entries with `representativeQueries`). Low priority.

---

## 6. Metadata rules

- **Title:** 50–60 chars, primary keyword first, written naturally, states the benefit. Unique per page. Use the fallback ladder in §3.1.
- **Meta description:** 140–160 chars, includes the keyword and a call to action. Use the **same** string for the meta tag and the schema `description`.
- **One H1** per page that describes the page; H2/H3 outline below it.
- **URL:** short and hyphenated (`/blog/appointment-reminders`). Don't change it once it's live; if you must, 301.
- **OG:** 1200×630 card per page type. Only include `og:image:width/height` when you're sure of the size. Avatars must be ≥200px (Facebook).
- **Admin overrides:** store `seo_title`, `seo_description`, `og_title`, `og_description`, `seo_image`, `is_indexable` per entity. The override wins over the generated value, and canonical can't be overridden.
- **Local SEO:** add "in {City}" only for offerings that are physically delivered there. Filter out junk location values.
- hreflang: BAS doesn't use it. Add it only if you publish real per-locale content.

---

## 7. Content production rules

### 7.1 Writing
Write for people. Simple English, short paragraphs, examples rather than abstraction. **Open with the answer**, no generic intros. No keyword stuffing and no AI-sounding filler.

### 7.2 AEO checklist: each article answers
What? · Why? · How? · Cost? · Pros? · Cons? · Alternatives? · Mistakes? · Checklist? · FAQs (taken from real People Also Ask questions)

### 7.3 GEO: make passages quotable
Include clear definitions, lists, tables, bullet summaries, comparisons, **sourced statistics, quotations with attribution, citations to reputable sources** (the Princeton GEO study's strongest factors), original insights, and consistent entity naming. **Extractability test:** each H2 section should still make sense if an AI engine quotes it alone.

### 7.4 E-E-A-T
- Author = a real `Person` with an on-site author page, photo, role and `sameAs`. **Not an Organization** (BAS's audit flagged "Bolt 958" as the author).
- Show published **and** updated dates, sources, real screenshots, templates and opinions.
- Never make up statistics, reviews or URLs.

### 7.5 Internal linking (enforced in code)
- Each post links to its pillar, 3–5 related posts (published slugs only), pricing, a feature page and a CTA. At most 4 outbound links to authoritative sources.
- Keep a `POST_TAGS` (slug → tags) and `CLUSTERS` (pillar, tags, priority links) data file. A related-posts selector fills slot 1 with the pillar, then priority siblings, then posts with overlapping tags, then the newest.
- **CI test fails the deploy** if any post is untagged, any pillar link is dead, or **any post is an orphan** (0 inbound links). BAS had 18 orphans before this test existed.
- Render related links on the server so they're in the HTML.

### 7.6 Blog pipeline gate (BAS `blog-seo-optimizer` skill)
1. Cannibalization check against published posts; stop if overlap is HIGH.
2. Classify intent and research the SERP and content gaps.
3. Optimize: title ≤60, excerpt 140–160, answer-first intro, FAQ from People Also Ask, internal links per §7.5.
4. Fact-check every claim and URL, then run the extractability test.
5. Score it (BAS target: **SEO ≥90 and GEO ≥90**, up to 3 rewrite passes).
6. Register it in the clusters file (no orphans), generate the OG card, open a PR.
7. After publishing: request indexing in Google Search Console the same day.

### 7.7 Forbidden
Writing for keyword density, copying competitors, invented stats, fake reviews, clickbait, publishing without a CTA, duplicate or near-duplicate pages.

---

## 8. Measurement

### 8.1 Google Search Console SOP (weekly, Monday, ~10 min)
1. Add a **Domain property** and submit `sitemap.xml`. Do the same in **Bing Webmaster Tools**, which also feeds Copilot and ChatGPT search.
2. **Sitemaps:** every child file shows "Success".
3. **Pages:** record *Indexed* and *Discovered – not indexed* in a running log. Healthy = indexed count rising and the discovered queue shrinking.
4. Read "Why pages aren't indexed":
   - *Discovered/Crawled – not indexed* on a young domain → wait. Act only if a marketing page has sat there for more than 3 weeks; then improve its content.
   - *Alternate with proper canonical* / *Excluded by noindex* → working as intended.
   - **Any new Soft 404, "Duplicate without user-selected canonical", or entity pages under "Google chose different canonical" → investigate the same day.**
5. **Request indexing** (~10 a day) for new high-value pages: home → pricing → comparisons → top profession pages → newest posts.
6. Track the brand query. Name collisions are real (BAS competes with "booksloth").

### 8.2 Scoring framework (optional, for a later admin tool)
BAS gives every page two diagnostic 0–100 scores. **These are internal scores, not Google's formula.**
- **SEO:** indexability 18 · canonical 10 · metadata 14 · content depth 20 · internal links 12 · structured data 8 · image alt 5 · GSC performance 13. **Hard caps:** non-200 → 20, unexpected noindex → 30, robots-blocked → 25, wrong canonical → 55, thin content → 60.
- **GEO:** AI-crawler access 18 · text extractability 15 · entity clarity 15 · answer coverage 15 · structure 12 · evidence 12 · schema validity 8 · freshness 5. **Caps:** noindex → 25, nosnippet → 40, both AI search bots blocked → 45, no extractable text → 50.
- **Never award points for** word count, keyword density, llms.txt, FAQ schema added blindly, or training-bot access. A hidden `aggregateRating` is a **penalty**.
- BAS also built an admin SEO control center: a daily crawl of sitemap URLs, a rule registry (onpage, technical, indexability, links/orphans, images, schema, sitemap, cannibalization, GSC), and a GSC sync through a service account. Auto-fix runs **dry-run by default**, and a fix is only marked FIXED after a re-crawl confirms it. Build this **after** the content engine works, not before.

---

## 9. Landmines BAS hit (the ones that carry over)

| Landmine | What to do |
|---|---|
| The SPA fallback shell carried the homepage canonical and JSON-LD, so every non-prerendered URL claimed `canonical=/` | With SSR this can't happen, but **never set a canonical in a root layout**; set it per page. |
| Prerender/SSR build got banned by its own rate limiter / IP guard, so empty shells shipped as soft-404s | Exempt your build and ISR fetches from rate limiting (token header). Make the build fail loudly when a page renders the error component. |
| Verifying on the wrong domain gave false 404s from the CDN | Always verify on the **canonical** domain. |
| WAF/Cloudflare blocked AI bots even though robots.txt allowed them | `curl -A` each bot after every edge change. |
| Pricing differed between `/pricing`, Product schema and llms.txt | Keep plans/prices in one constants file that all three read. |
| Logo URL differed between the Organization nodes on two pages | Keep one `ORG` constant. |
| Slug lists (features, jobs, landings) hand-kept in 2–3 places with "KEEP IN SYNC" comments drifted | In Next.js, derive the sitemap **and** `generateStaticParams` from the same data module. |
| Unknown `/blog/<slug>` returned 200 with an indexable shell | `notFound()` for every dynamic route, plus a test for it. |
| Rendering `null` while data loads caused CLS of 0.93 | Reserve space (skeleton with fixed min-height); never render null above the fold. |
| A full-screen preloader overlay became the LCP element (6–10s) | No splash or preloader on public pages. |
| Hidden or collapsed FAQ answers lazy-loaded via JS weren't extractable | Use native `<details>`, so the answer is always in the DOM. |
| An optimizer agent wrote `author` as an object, so the byline showed raw JSON | Assert `typeof author === 'string'` (or validate the shape) before saving. |

---

## 10. Do / don't summary

**Do:** commercial pages first · unique copy on programmatic pages · real reviews only · visible FAQs only · one schema source · `notFound()` for unknown slugs · `is_indexable` controls both robots and sitemap · no-orphan CI test · GSC + Bing on day 1 · audit backlinks.

**Don't:** write a changelog and call it a blog · chase word count · add fake ratings · redirect dead URLs to the homepage · sniff user-agents to serve bots different HTML (Next doesn't need it, and it risks looking like cloaking) · block AI search bots by accident at the WAF.

---

## 11. Execution checklist (phased)

**Phase 0: Foundation (day 1–3)**
- [ ] Choose the canonical host (apex or www) and redirect the other with 308/301. Set `metadataBase`.
- [ ] `app/robots.ts` (per §3.1) and private paths disallowed.
- [ ] `app/sitemap.ts`, split into static / entities / blog / categories, driven by the DB, with an `is_indexable` filter.
- [ ] `generateMetadata` on every route: title ladder, 160-char description, per-page canonical.
- [ ] `not-found.tsx` with noindex; `notFound()` in every dynamic route.
- [ ] Add a GSC Domain property and Bing Webmaster Tools; submit the sitemap; start the weekly log.
- [ ] `curl -A` check for ClaudeBot, PerplexityBot, OAI-SearchBot and Googlebot → all 200.

**Phase 1: Structured data (week 1)**
- [ ] `lib/seo/schema.ts`: `ORG`, `WEBSITE`, and graph builders per page type (§4). Prices and logo come from shared constants.
- [ ] `<JsonLd>` on every public page. Validate with the Rich Results Test.
- [ ] Guarded `aggregateRating`; FAQPage only when the FAQ is visible.

**Phase 2: Social / OG (week 1)**
- [ ] `opengraph-image.tsx` per route group (marketing, entity, blog), 1200×630.
- [ ] Twitter `summary_large_image`.

**Phase 3: Commercial and industry pages (weeks 2–4)**
- [ ] Keyword research for each pillar, then a topical map.
- [ ] Comparison / alternative pages for the top 3–6 competitors.
- [ ] "For <industry>" pages with unique copy and a FAQ each.
- [ ] Feature pages, one per feature query.
- [ ] Hub pages that link all of them (crawlable even when the landing pages hide the main nav).

**Phase 4: Content engine (ongoing)**
- [ ] Clusters data file + related-posts selector + **no-orphan CI test**.
- [ ] Person author page with schema and `sameAs`.
- [ ] Glossary and help docs for definitional and how-to queries.
- [ ] Blog only for queries with real demand; run each post through the §7.6 gate.
- [ ] `public/llms.txt` (§5.1), kept in sync with pricing.

**Phase 5: Performance (in parallel)**
- [ ] `next/font`, `<Image priority>` on the LCP image, analytics loaded lazily and after consent.
- [ ] No preloader or overlay on public pages; reserve space for async content.
- [ ] Check Core Web Vitals in PageSpeed Insights / CrUX for home, pricing and a top landing page.

**Phase 6: Authority (ongoing, the part BAS was missing)**
- [ ] Backlink audit; disavow toxic links.
- [ ] Earn links: free tools, original data or stats pages, directory and marketplace listings, partner and integration pages, founder content.
- [ ] Brand mentions on platforms AI engines read (Reddit, LinkedIn, YouTube, G2/Capterra, Wikipedia/Wikidata if you qualify).

**Phase 7: Measurement tooling (once content is flowing)**
- [ ] Weekly GSC log; act only on the escalation triggers in §8.1.
- [ ] Optional: daily crawl + rule registry + SEO/GEO scores (§8.2).

---

## 12. Prompt to paste into the other codebase

> Read `docs/seo-aeo-geo-playbook.md`. This is a Next.js App Router site. First audit the repo against §11 Phase 0–2 and report which items already exist (cite `file:line`) and which are missing. Then implement the missing Phase 0 items on a new branch: robots.ts, chunked DB-driven sitemap.ts filtered by indexability, generateMetadata with the §3.1 title ladder and per-page canonicals, not-found with noindex, and `notFound()` in every dynamic route. Use one shared constants module for brand, logo and pricing. Follow the §4 schema rules (no fake `aggregateRating`, FAQPage only when the FAQ is visible). Don't port any BAS workaround listed in §3 (no UA-sniffing prerender, no duplicated JSON-LD). Open a PR and stop.

---

### Reference: where this lives in the BAS repo
`client/src/utils/seo.js` (schema/meta builders) · `client/src/components/common/Seo.jsx` · `client/scripts/prerender.mjs` · `client/middleware.js` · `server/controllers/prerenderController.js` · `server/services/sitemapService.js` · `client/public/robots.txt` · `client/public/llms.txt` · `client/src/data/blogClusters.js` + `client/src/lib/relatedPosts.js` · `server/services/seo/` (audit engine, scoring) · docs: `seo-aeo-geo-plan.md`, `seo-scoring-framework.md`, `seo-gsc-sop.md`, `seo-audit-2026-09/README.md`.
