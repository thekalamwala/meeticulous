# Profession Landing Pages — Design Spec

_Date: 2026-07-06 • Branch: `feat/profession-landing-pages` • Status: building (lawyers first)_

## Objective

High-converting, profession-specific marketing landing pages at `/for/:profession` that
sell Meeticulous to potential **hosts** in each profession. Each page must **feel distinct**
— its own color palette, tone of voice, and pain points — while sharing one maintainable
template. Connected to the main site navbar (not isolated like `/lp/*`).

Build order: **perfect ONE page (lawyers) first**, then replicate for the other 9.

## Approach

**Template component + per-profession data config.**

- `client/src/pages/for/ProfessionLanding.jsx` — one template, reads `:profession` param.
- `client/src/pages/for/professionLandingData.js` — per-profession config (theme, copy, pains, FAQ, schema bits).
- Route: `<Route path="/for/:profession" element={<ProfessionLanding />} />`. Unknown slug → `<Navigate to="/" replace />`.
- `for` added to `reservedSegments` (host can't claim it as username).
- Navbar mega menu (`useCasesConfig.js`) hrefs repointed `/explore?category=…` → `/for/<slug>`.

## Per-profession distinctiveness

Each config entry carries a `theme` (primary, accent, surfaces, hero gradient) + `voice`
(headline, subline, pains in that profession's language). Lawyers = authoritative, dark
slate + gold. Doctors = trust blue + green. Photographers = creative slate + orange.

## Section order (conversion-optimized, per reference wireframes)

1. Navbar (shared, connected)
2. Hero — profession headline + subline + CTA + themed gradient, social-proof faces + 5/5
3. Social proof bar — "Trusted by N+ professionals" + relevant testimonials
4. Problem / Agitation — 3–4 host pain points in their language (strike-through problem)
5. Solution — how BAS fixes each pain (check + framing)
6. Features / Benefits — 4 benefit-first cards, profession-relevant
7. How It Works — reuse homepage `HowItWorks` component (3 steps)
8. Testimonials — reuse `TESTIMONIALS`, weight profession-relevant roles first
9. Pricing teaser — Starter free + paid, "₹10/day" framing, reuse `plans.js`
10. FAQ — profession-specific objection handling (drives FAQPage schema)
11. Final CTA — urgency + themed button → `/be-a-sloth`

## SEO / OG / AEO / GEO

Reuse `<Seo>` (client/src/components/common/Seo.jsx). Per page:

- **Title** (Google, commercial intent, 50–60 chars): `Appointment Booking Software for Lawyers | Meeticulous`
- **Meta description** (140–160, keyword + CTA)
- **OG title/desc** (social-share CLICKBAIT, ₹10/day hook — intentionally distinct from SEO title):
  e.g. `Your law practice runs on WhatsApp. Fix it for ₹10/day.`
- **OG image**: 1200×630 on `company-assets.meeticulous.in/images/seo/for-lawyers-og-1200x630.png`
  (clickbait creative — **needs founder upload**; URL wired now, falls back gracefully).
- **JSON-LD graph** (AEO/GEO citation surface for ChatGPT/Claude/Gemini/Perplexity):
  - `SoftwareApplication` — subCategory "Appointment Scheduling Software", `Offer` price 0 INR + paid tier.
  - `FAQPage` — mirrors the on-page FAQ (answer-box + AI citation).
  - `BreadcrumbList` — Home › For › Lawyers.
  - `Service` — "Appointment booking for lawyers", provider Organization.
- **Prerender**: add `/for/lawyers` (and each profession) to `client/scripts/prerender.mjs`
  `PRERENDER_ROUTES` so baked HTML (meta/OG/JSON-LD) is served to non-JS scrapers + AI crawlers.
- **Sitemap**: add profession landing routes to the static-route list in `sitemapService.js`.

Note: the AEO/GEO plan doc lists "clickbait" under Forbidden — that rule governs Google-indexed
title/meta (kept clean & commercial here). The ₹10/day clickbait lives ONLY in OG/social tags,
by explicit product decision.

## Reused assets

`Reveal`, `HowItWorks`, `useLenis`, `TESTIMONIALS`, `PAID_PLANS`/`STARTER_PLAN`, design tokens
(`--c-*`, Plus Jakarta / Poppins), brand CTA classes.

## Out of scope (v1)

Live host listings on the page (marketing only). Per-profession real testimonials (reuse shared set,
weighted). Additional 9 pages beyond lawyers (replicated after lawyers is perfected).
