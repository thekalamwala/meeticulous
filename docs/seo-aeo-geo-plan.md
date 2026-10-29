# SEO / AEO / GEO Plan — Book A Sloth

_Last updated: 2026-07-01 • Owner: Shubham • Status: infra shipped, content strategy active_

## Objective

Qualified organic traffic that converts to bookings, trials, paid customers. Never chase vanity traffic.

## Product context

- **Product:** Book A Sloth — online booking / appointment scheduling / business management platform.
- **Audience:** coaches, consultants, therapists, doctors, fitness trainers, tutors, freelancers, agencies, photographers, salons, small businesses.
- **Geography priority:** 1. India → 2. UAE → 3. UK → 4. Australia → 5. US.

---

## Infra status (code-verified)

- **Stack:** React 18 + Vite SPA, client-rendered, deployed on Vercel (`client/vercel.json`, `client/middleware.js`).
- **Phase 0 (quick wins) — DONE.** `robots.txt` + `llms.txt` in `client/public/`. Per-route canonical/OG/JSON-LD via [`Seo.jsx`](../client/src/components/common/Seo.jsx) (upserts head tags, restores on unmount for SPA nav).
- **Phase 1 (structured data) — DONE, wider than originally scoped.** JSON-LD live on Pricing, Home, HostProfile, About, ServiceDetail, JobDetail, Careers.
- **Phase 2 (crawlability) — DONE.** DB-driven sitemap ([`sitemapService.js`](../server/services/sitemapService.js)): static routes + host/service URLs gated by `is_verified`+`is_indexable`+`is_active`+not-banned; noindexed host cascades to drop its services. Admin `SeoDrawer.jsx` for per-page overrides. v3.19 both DBs.
- **Phase 3A (build-time prerender) — DONE.** Custom Puppeteer post-build script (`client/scripts/prerender.mjs`) prerenders 17 marketing routes to static `.html` files with full meta/OG/JSON-LD baked in. Vercel serves these directly. Analytics scripts stripped from prerendered output.
- **Phase 3B (dynamic route bot prerender) — DONE.** Server-side meta-tag endpoint (`server/controllers/prerenderController.js`) serves lightweight HTML shells for host profiles and service pages. Vercel edge middleware (`client/middleware.js`) detects bot User-Agents and proxies them to this endpoint. Admin SEO overrides (SeoDrawer) reflected within 2 min — no redeploy needed. Fail-open: bots get SPA on error.
- **Phase 4 (measurement) — OPEN.** No GSC/Bing Webmaster submission confirmed yet, no CI schema validation.

Infra work funds the content strategy below — structured data + crawlable sitemap are prerequisites for AEO/GEO citation, not optional polish.

---

## Definitions

| Term | Means | Primary surface |
|---|---|---|
| **SEO** | Rank in classic search results | Google, Bing |
| **AEO** | Win answer boxes / rich results / featured snippets | Google AI Overviews, featured snippets, voice |
| **GEO** | Get cited inside generative answers | ChatGPT, Perplexity, Gemini, Claude, Copilot |

Every page: **Intent → Experience → Trust → Conversion.** Never write for search engines only; always solve a real user problem.

---

## Search intent framework

Classify every keyword before writing.

| Intent | Example | Goal |
|---|---|---|
| Informational | "how to reduce appointment no-shows" | Teach |
| Commercial | "best scheduling software", "calendly alternative" | Convince |
| Transactional | "book a sloth pricing", "appointment software india" | Convert |
| Navigational | "book a sloth login" | Route to destination |

---

## Content pillars

1. **Appointment Scheduling** — online booking, booking page, appointment calendar, recurring appointments.
2. **Payments** — collect advance payment, UPI booking, Razorpay integration.
3. **Business Automation** — reminders, follow-ups, WhatsApp notifications, no-shows.
4. **Industry Guides** — one cluster per profession: coach, doctor, salon, tutor, photographer, fitness, consultant, agency, etc.
5. **Growth** — marketing, pricing, client retention, customer experience.

---

## Priority sequence

1. **Commercial intent pages** — buying keywords: appointment scheduling software, best appointment booking software, calendly alternative, online booking software india, appointment software for coaches.
2. **Industry pages** — one landing page per profession (booking software for therapists / salons / tutors / photographers / ...).
3. **Feature pages** — one page per feature: WhatsApp reminders, recurring bookings, online payments, availability management, booking forms, Google Calendar sync.
4. **Educational blogs** — only publish articles that lead readers toward Book A Sloth; every post connects back to a feature, use case, or landing page. Traffic without a conversion path is a chart, not a strategy.

---

## Writing rules

Write for humans. No keyword stuffing. Simple English. H2/H3 hierarchy. Short paragraphs. Prefer examples over abstraction. Avoid AI-sounding language and generic intros — start with the answer.

## AEO checklist (every article answers)

What? · Why? · How? · Cost? · Pros? · Cons? · Alternatives? · Mistakes? · Checklist? · FAQs

## GEO (optimize for ChatGPT, Gemini, Claude, Perplexity, Copilot)

Include: clear definitions, lists, tables, bullet summaries, FAQ, comparisons, sourced statistics, original insights, strong entity relationships.

## EEAT

Always include: author, updated date, sources, internal links, external authority links, real screenshots, examples, templates, original opinions. Never fabricate statistics.

## Internal linking

Every article links to: parent pillar, related guides, pricing, features, homepage, relevant integrations, CTA.

## URL / title / meta / images

- **URLs:** short hyphenated, e.g. `/blog/appointment-reminders`. Not `/blog/how-you-can-start-using-the-best-appointment-reminder-software-ever`.
- **Titles:** 50–60 chars, primary keyword first, natural language, benefit-driven.
- **Meta description:** 140–160 chars, includes keyword + CTA, readable.
- **Images:** alt text, caption, compressed, WebP, meaningful filename.

## Schema (use where applicable)

Article, FAQ, SoftwareApplication, Product, Review, Breadcrumb, Organization, LocalBusiness, HowTo, Video.

## Content quality checklist (before publishing)

☐ Intent satisfied ☐ Original examples ☐ Internal links ☐ External references ☐ FAQ ☐ CTA ☐ Schema ☐ Images ☐ Meta title ☐ Meta description ☐ Slug ☐ Mobile friendly ☐ Fast loading

## Forbidden

Never: write for keyword density, copy competitors, invent statistics, generate fake reviews, use clickbait, publish without a CTA, duplicate content.

## Success metrics

Organic traffic, qualified leads, trial signups, paid conversions, time on page, CTR, bounce rate, returning visitors, brand searches, AI search mentions, featured snippets, top-3 rankings.

---

## Suggested sequence

```
Infra Phase 0-2  (quick wins + structured data + crawlability)  ── DONE
Infra Phase 3A (marketing route prerender)                       ── DONE (17 static routes)
Infra Phase 3B (dynamic route bot prerender)                     ── DONE (host+service pages)
Content Priority 1-4 (commercial → industry → feature → blog)   ── ACTIVE
Infra Phase 4  (measure + iterate)                                ── ongoing
```

## Open questions

- [ ] Additional landing pages / comparison targets?
- [ ] Target keywords / queries to own first, per pillar?
- [ ] Prerender decision (Phase 3, option A vs B) — timeline?
- [ ] _Your ideas here →_
