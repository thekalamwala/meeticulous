# Book A Sloth — Technical SEO + AEO Audit

_Audited: 2026-10-04 · Auditor: automated senior technical-SEO/AEO pass over the codebase + prod config · Branch: `claude/seo-aeo-audit-9a2qny`_

---

## 0. Scope, assumptions & method

**Product (inferred from `README.md:3`, `docs/ai-context.md`, routes):** Book A Sloth is a multi-tenant appointment-booking SaaS for India — hosts (creators/professionals) publish services, guests book via phone-OTP or account and pay over UPI through Razorpay. Positioning line: _"the calm way to sell your time"_ (`client/index.html:15`).

**Prod URL:** `https://bookasloth.com` (apex; `www` → apex 308, `client/vercel.json:5-10`).

**Stack — correction to the brief.** The template assumed **Next.js + Supabase**. The real stack is a **React 18 + Vite client-rendered SPA** (hosted on Vercel) + a separate **Express API** (Render, `book-a-sloth.onrender.com`) + Supabase (Postgres/Auth/Storage). This is material: a Vite SPA has **no SSR** — indexable HTML for non-JS crawlers and social scrapers comes from a **build-time Puppeteer prerender** (`client/scripts/prerender.mjs`) and a **server-side bot-prerender endpoint** (`server/controllers/prerenderController.js` via `client/middleware.js`). Most of Pillar 0 hinges on that prerender path, not on a framework's Metadata API.

**Money keywords (template blank → inferred** from `docs/seo-aeo-geo-plan.md:68`, pricing copy, and `/lp` + `/for` targeting):
1. `appointment booking software` / `appointment scheduling software` (India)
2. `online booking software with UPI / online payments` (India)
3. `Calendly alternative` (+ `Topmate` / `Setmore` / `Acuity` / `SimplyBook` / `Zoho Bookings` alternative)
4. `booking software for <profession>` (consultants, coaches, doctors, salons, tutors…)
5. `booking page / booking link` (brand-adjacent transactional)

### Method & evidence rules
- Every finding cites a **file:line** or a **prod/DB observation**.
- **Live prod HTML / Lighthouse could NOT be fetched.** This environment's egress policy blocks all outbound web (verified: `bookasloth.com` and even `google.com` return HTTP 000 / proxy `403 connect_rejected`). So "what crawlers see" is derived from the **prerender source that generates that exact HTML** (`prerender.mjs`, `prerenderController.js`, `index.html`, `vercel.json`), which is authoritative for the markup but **cannot confirm live status codes, render timing, or Core Web Vitals**. Items needing live verification are tagged **[VERIFY LIVE]** and listed in §7.
- **Supabase: read-only aggregates only, no PII.** Figures below are counts/averages against prod (`ayjhlwyzszykqtnaktpb`).

### Platform scale (prod DB, 2026-10-04)
| Metric | Value |
|---|---|
| Hosts (role=host) | 82 total · 76 verified · **73 indexable** |
| Services | 72 total · **51 indexable** |
| Bookings (all-time) | **49** (35 completed · 12 cancelled · 2 no-show) |
| Reviews | **6** (avg rating **5.00**) |
| Published blog posts | **84** (DB) · 72 in seed `client/src/data/blogPosts.js` |
| Distinct host professions | 35 — top: **business-consultant 14, software-engineer 14**, content-creator 4, marketing-strategist 3 |
| Hosts with no location set | **64 / 82** (≈78% online-only) |

Two numbers drive several findings below: the platform is **very early** (49 lifetime bookings, 6 reviews), and **actual host supply (tech / consulting / creator) does not match the professions the SEO program targets (healthcare / salon / legal).**

---

## 1. Scorecard

| Pillar | Score /10 | Biggest gap | Top fix |
|---|---|---|---|
| **0 — Technical baseline** | **8** | `Organization.logo` points to a nonexistent file (404) on every `/for` + article page; 5 live `/for` pages absent from sitemap | Repoint logo to an on-domain 512px asset; add the 5 `/for` routes to the sitemap |
| **1 — Topical authority** | **6** | SEO targets professions with ~0 real supply (doctors/dentists/salons) while the actual supply (consultants, engineers, creators, career coaches) has **no `/for` page** | Build `/for` + `/services` pages for the professions that actually onboard; de-prioritise empty verticals |
| **2 — Query fan-out (AEO)** | **7** | 5 `/lp/*` competitor pages render FAQs/pricing but emit **zero JSON-LD**; no standalone `Review` markup | Add `FAQPage` + `SoftwareApplication` to the `/lp` pages; keep answer-first prerender bodies |
| **3 — Backlink-worthiness** | **4** | Only one linkable tool (earnings calculator); no org postal address/phone in schema despite a real registered office | Ship 2–3 genuinely linkable tools/datasets; add `legalName`+`PostalAddress` to Organization schema |
| **4 — Digital PR readiness** | **3** | No press/data page, no dataset, no embeddable chart — and the dataset (49 bookings) is too small for a credible data story today | Create a `/press` + lightweight stats page now; hold data-journalism angles until volume crosses the thresholds in §5 |
| **5 — SEO automation (skills)** | **6** | Strong "write" automation (blog skills) but no **audit / plan / measure** skills to close the loop | Added 2 skills (`seo-aeo-audit`, `seo-topical-map`); add a GSC-backed `seo-measure` next |

**Overall:** the **technical + AEO foundation is genuinely strong and well above typical for a startup** (full prerender of ~77 static routes + every DB-driven host/service/blog/profession page, a rich cross-referenced `@graph`, DB-driven sitemap with correct indexability cascade, bot-prerender with real body prose + FAQ, llms.txt, security headers, performance hygiene). The weak pillars are **off-page** (3, 4) and **strategic alignment** (1). The single most urgent item is a **truthfulness risk**, not a technical one — see P0-1.

---

## 2. Pillar 0 — Technical baseline

### What's already strong (verified in code)
- **Prerender covers all indexable routes.** `prerender.mjs:58-136` prerenders ~77 static routes; `blogRoutes()` (`:171`) + `hostServiceRoutes()` (`:223`) additionally bake every published blog post and every sitemap-listed host/service/profession page to static HTML with `<Seo>`-injected title/description/canonical/OG/JSON-LD. A failed render **fails the build** rather than shipping an empty shell (`:550`).
- **SPA fallback is a bare shell, not the homepage.** `prerender.mjs:34` copies the bare `index.html` to `spa-shell.html`; `vercel.json:17,32-34` rewrites non-file routes to it and stamps it `X-Robots-Tag: noindex`. This fixed a prior bug where every unrendered route shipped `canonical=/` + homepage JSON-LD (documented `index.html:18-22`).
- **Bot prerender for dynamic pages.** `middleware.js:73,127` detects social scrapers + non-JS crawlers (deliberately **excludes Googlebot**, `:71-73`) and proxies to `/prerender` which returns full `<head>` + **real visible body** (h1, service list, FAQ Q&A, reviews, internal links — `prerenderController.js:113-170`). This is excellent AEO hygiene.
- **Per-route metadata** via `<Seo>` (`Seo.jsx`) — title, description, canonical, robots, OG/Twitter, JSON-LD, with on-unmount restore for SPA nav. Canonical is always derived from the live URL (`seo.js:74,154`), so aliases/301s can't split equity.
- **Sitemap** is DB-driven (`sitemapService.js`) with the correct visibility cascade (verified + not-banned + `is_indexable` host; a noindexed host drops its services, `:221-227`) and a schema-missing fallback (`:172`). Served via `vercel.json:15-16` rewrite to the API.
- **robots.txt** (`client/public/robots.txt`) blocks app/auth/admin + the booking funnel (`/*/booking/`, a duplicate of the canonical service page) and **explicitly welcomes GPTBot/ClaudeBot/PerplexityBot/Google-Extended** (`:27-37`) — good GEO posture.
- **404 hygiene:** unknown usernames return a real **404 + noindex** branded page at the edge (`middleware.js:154-162`), killing the soft-404-forever problem; old usernames 301 to current (`:165-167`).
- **Schema breadth** (see Pillar 2): Organization, WebSite+SearchAction, SoftwareApplication, Product, Service, ProfilePage/Person, BreadcrumbList, FAQPage, HowTo, Article/BlogPosting, JobPosting, ContactPage, CollectionPage — mostly via one cross-referenced `@graph` per page (`seo.js:373,491`).
- **Perf hygiene (static):** preconnect to the 4 critical origins, preload of 2 above-the-fold fonts + hero image, consent-gated analytics, Razorpay loaded on demand (`index.html:39-71`). Security headers + CSP in `vercel.json:19-29`.

### Findings

**0-A · `Organization.logo` is a dead link (404) on every `/for` + article/blog page.** → **Evidence:** `seo.js:278` (`organizationJsonLd`) and `seo.js:344` (`orgNode`, used by `articleGraphJsonLd` + `professionGraphJsonLd`) emit `logo: ${site}/logo-512.png`. No `logo-512.png` exists in `client/public/` (`find client/public -iname 'logo-512*'` → empty; only `web-app-manifest-512x512.png` exists). The homepage uses a different, working logo (`Home.jsx:77` → `company-assets.bookasloth.in/images/brand/logo.png`), so the brand's logo is **both broken and inconsistent** across page types. → **Fix (shipped, P0):** point `seo.js` logo to the on-domain `web-app-manifest-512x512.png` (exists, genuinely 512×512 so the `width/height:512` claim stays truthful). → **Impact:** M (Organization logo is what Google uses for the knowledge panel / brand SERP; a 404 is silently dropped). → **Effort:** S.

**0-B · 5 live, prerendered `/for` pages are missing from the sitemap.** → **Evidence:** `prerender.mjs:103-108` prerenders `/for/astrologers`, `/for/architects`, `/for/dentists`, `/for/sports-turf`, `/for/chartered-accountants`; all are real routes (`App.jsx:664-668`). None appear in `sitemapService.js` STATIC_ROUTES `/for/*` block (`:106-126`). They are therefore crawlable only via internal links, not declared. → **Fix (shipped, P0):** add the 5 entries to STATIC_ROUTES. → **Impact:** M. → **Effort:** S.

**0-C · Homepage `aggregateRating` claims `reviewCount: 176` (5★) but the DB has 6 reviews.** → **Evidence:** `Home.jsx:95-100` hardcodes `ratingValue "5" / reviewCount "176"`; the code's own comment (`:92-94`) says _"reviewCount must reflect real 5★ user reviews/testimonials shown on the site — don't inflate."_ Prod `reviews` table: **6 rows, avg 5.00**. Even counting `/wall-of-love` testimonials, 176 is unlikely to be substantiated. → **Risk:** this is **self-serving markup on fabricated volume** — exactly what Google's structured-data policy penalises, and it undercuts the brand with AI engines that cross-check. → **Fix (NEEDS YOU — not auto-changed):** set `reviewCount` to the real number of displayed 5★ reviews/testimonials (the count rendered on `/wall-of-love`), or remove `aggregateRating` from the homepage SoftwareApplication until there's a defensible count. I did not guess a number. → **Impact:** **H** (manual action, penalty + trust risk). → **Effort:** S.

**0-D · `/lp/*` competitor pages render FAQ/pricing/comparison content but emit no structured data.** (Also an AEO finding — see 2-A.) → **Evidence:** `SetmoreAlternative.jsx:636-646` renders a visible `#faq` with no `jsonLd=`/`@type`; same across all 5 `*Alternative` pages (not `TopmateVsBookASloth`, which is also missing). These are high-commercial-intent pages. → **Fix (P1):** add `faqJsonLd` + the `professionGraphJsonLd`/`SoftwareApplication` builder (already in `seo.js`) from each page's existing FAQ/pricing arrays. → **Impact:** M. → **Effort:** M (per-page wiring; not a one-liner, hence not auto-shipped).

**0-E · Client↔server schema divergence on host/service pages.** → **Evidence:** the SPA emits `ProfilePage` + `BreadcrumbList` + `FAQPage` for a host page (`HostProfile.jsx:478-507`), but the bot-prerender shell emits only `ProfilePage` + `FAQPage` (no `BreadcrumbList`, `prerenderController.js:252-312`). Non-JS crawlers/scrapers get the subset. → **Fix (P2):** add a `BreadcrumbList` node to the prerender shells to match. The repo's own `bas-seo-schema` skill already mandates two-path sync. → **Impact:** L. → **Effort:** S.

**0-F · Heading structure — two pages need a verify.** → **Evidence:** `Home.jsx` and `Pricing.jsx` have exactly one `<h1>` (good); `About.jsx` and `HowItWorks.jsx` have **no literal `<h1>`** (may resolve to one via a shared Hero component). → **Fix (P2):** confirm each renders exactly one h1. → **Impact:** L. → **Effort:** S. **[VERIFY LIVE]**

**0-G · Entity/logo inconsistency within schema (see 0-A) + contact-email split.** `contactPageJsonLd` + footer use `bolt@bookasloth.in` (`seo.js:594`, `Footer.jsx:4`), while legal pages use `team@timewheel.co.in` (`Privacy.jsx:5`). Pick one canonical support address for schema consistency. → **Impact:** L. → **Effort:** S.

> **Non-finding (corrected):** the 6 legal pages (`Privacy/Terms/Refund/GuestTerms/HostAgreement/HostFees`) **do** get correct title/description/canonical — they render `<Seo>` via the shared `LegalLayout.jsx:53-57`. An earlier pass flagged them as gaps by grepping only the page files; verified false.

> **Non-finding:** homepage `WebSite.SearchAction` targets `/search?q=` which **is** a real route (`App.jsx:438`, `Search.jsx`) — valid.

---

## 3. Pillar 1 — Topical authority

### Ideal topical map (core topic: "appointment booking & scheduling for solo professionals in India")

```
HUB: Appointment booking software (India)  → /appointment-booking-software  [EXISTS]
├─ Supporting / commercial
│  ├─ Pricing / commission                  → /pricing                       [EXISTS]
│  ├─ Calendly/Setmore/Acuity/SimplyBook/   → /lp/*-alternative              [EXISTS ×6]
│  │  Zoho/Topmate alternatives
│  ├─ Comparison hub                         → /compare                       [EXISTS]
│  └─ Solutions / discovery hub              → /solutions                     [EXISTS]
├─ Feature cluster (one page per capability)
│  └─ scheduling, payments, calendar,        → /features/:slug                [EXISTS ×10]
│     notifications, booking-pages, products,
│     reviews, availability, analytics, CRM
├─ Industry cluster (one landing per profession)
│  └─ /for/<profession>                       → [EXISTS ×27 bespoke+data]
│     ⚠ targets healthcare/legal/salon; MISSING the professions that actually sign up
├─ Directory cluster (host-listing per profession)
│  └─ /services/:profession                   → [EXISTS, 6 rich + generated]
├─ Definitional / "what is"
│  ├─ What is a booking page/link?            → MISSING (only inside /help)
│  ├─ Glossary of booking/scheduling terms    → MISSING
│  └─ UPI/advance-payment for bookings        → partial (blog + /features/payments)
└─ Question / educational (blog)              → /blog/:slug                   [EXISTS ×84]
```

**Coverage ratio:** the map is **largely built** — hub, commercial, feature, industry, directory and question tiers all exist. The weak tier is **definitional/glossary** (0 dedicated pages; only help-desk articles).

### Findings

**1-A · The industry cluster targets the wrong professions.** → **Evidence:** 27 prerendered `/for` pages target astrologers, dentists, gynecologists, dermatologists, ENT, ophthalmologists, pediatricians, vets, salons, spa, lawyers, physios (`prerender.mjs:103-128`). But actual indexable host supply is **business-consultant (14), software-engineer (14), content-creator (4), marketing-strategist (3), career-coach, product-manager, UX-designer, startup-advisor** (prod `profiles`). There is **no `/for` page for software engineers, startup/career advisors, content creators, product/UX/designers, marketing strategists** — the people who actually onboard. Conversely, healthcare/salon `/for` pages and their `/services/:profession` directories will render **empty or near-empty host lists**, i.e. thin "doorway"-shaped pages Google may decline to index. → **Fix (P1):** build `/for` + `/services` pages for the real supply (see §6), and either enrich the empty-vertical pages with genuinely useful profession content or drop them from the sitemap until supply exists. → **Impact:** H. → **Effort:** M.

**1-B · `/services/:profession` content is thin vs `/for`.** → **Evidence:** `professionSeoContent.js` covers only **6 professions** with one intro paragraph + 5 FAQs each (`:5`), vs the rich bespoke `/for` pages. Generated professions get a generic template. → **Fix (P2):** expand the hand-tuned OVERRIDES for the professions with real supply; leave the generic generator for the long tail. → **Impact:** M. → **Effort:** M.

**1-C · No definitional/glossary tier.** → **Evidence:** content inventory found **no glossary, no "what is a booking page" hub page** outside `/help/docs`. These are the pages that win "what is…" and feed AI definitions. → **Fix (P1):** add a glossary + 3–4 definitional pages (see §6). → **Impact:** M. → **Effort:** M.

**1-D · Orphan/anchor-text checks need a live crawl.** → The internal-link graph uses discovery hubs (`/solutions`, `/compare`) that are prerendered so links land in static HTML (`prerender.mjs:79-82`) — good. But "pages >3 clicks from home", true orphans, and weak anchors ("click here"/"learn more") can only be confirmed on the live rendered graph. **[VERIFY LIVE]** — run Screaming Frog / Sitebulb against `https://bookasloth.com` and the sitemap. → **Impact:** M. → **Effort:** S (once a crawl is available).

---

## 4. Pillar 2 — Query fan-out (AI search)

For each money keyword, the sub-questions an AI engine researches before answering, mapped to a page/section (✅ = covered, ⚠ = partial, ❌ = missing).

### KW1 — "appointment booking software (India)"
| Sub-question | Mapped to |
|---|---|
| What is appointment booking software? | ✅ `/appointment-booking-software` (SoftwareApplication+FAQ, `:95,122`) |
| How much does it cost in India? | ✅ `/pricing` (Product+3 Offers, `Pricing.jsx:49`) |
| Does it support UPI / Indian payments? | ✅ `/features/payments` + llms.txt |
| Is there a free plan / commission? | ✅ `/pricing`, `/host-fees` |
| How do clients book without an app? | ✅ host/service prerender body + `/features/booking-pages` |
| Does it send WhatsApp reminders? | ✅ `/features/notifications` |
| Can I take payments before the appointment? | ⚠ blog + `/features/payments` (no single answer page) |
| Best appointment software for <profession>? | ⚠ `/for/*` (only for targeted verticals; see 1-A) |
| How is it different from Calendly? | ✅ `/lp/calendly-alternative`, `/compare` |

### KW2 — "Calendly alternative (India)"
| Sub-question | Mapped to |
|---|---|
| What's the best Calendly alternative in India? | ✅ `/lp/calendly-alternative` |
| Calendly alternative with payments/UPI? | ✅ `/lp/calendly-alternative` + `/features/payments` |
| Cheaper than Calendly? | ✅ `/pricing` |
| Calendly vs Book A Sloth feature table? | ⚠ page exists but **no comparison/FAQ JSON-LD** (0-D/2-A) |
| Free Calendly alternative? | ✅ `/pricing` (Starter) |
| Calendly alternative for coaches/consultants? | ⚠ `/for/business-consultant` (not linked from the `/lp` page) |
| Does it integrate Google Calendar? | ✅ `/features/google-calendar` |
| Alternatives to Setmore/Acuity/Zoho/Topmate? | ✅ `/lp/*-alternative` ×5 |

### KW3 — "booking software for <profession>"
Covered for 27 verticals via `/for/*`, but **answer quality is high only where host supply exists**; for empty verticals the AI answer would cite a page with no real providers (see 1-A).

### Findings

**2-A · The 5 `/lp/*Alternative` pages are the best-targeted commercial pages and emit no schema.** (Same as 0-D.) These should carry `FAQPage` (they already show FAQs) and `SoftwareApplication`+`Offer`. → **Impact:** M · **Effort:** M · **P1**.

**2-B · Answer-first formatting is strong where prerendered.** → **Evidence:** bot-prerender bodies open with `<h1>` + a self-contained summary line and a visible FAQ section (`prerenderController.js:117-137,97-103`); `/for` pages emit `speakable` on `h1`+`#faq` (`seo.js:532`). This is textbook AEO. No fix. **Keep it.**

**2-C · No standalone `Review` structured data.** → **Evidence:** reviews appear as visible `<blockquote>` in the prerender body (`prerenderController.js:105-111`) and feed `aggregateRating`, but there is no `@type: Review` anywhere (schema agent, `seo.js`). With only 6 real reviews this is low-priority, but worth adding to host/service pages once review volume grows. → **Impact:** L · **Effort:** S · **P2**.

**2-D · "Collect payment before appointment" has no single answer page.** A high-intent AEO query with only scattered coverage. Candidate for a new page (see §6). → **P1**.

---

## 5. Pillar 3 — Backlink-worthiness & Pillar 4 — Digital PR

### Pillar 3 — "Would anyone link here if search engines didn't exist?"

**Linkable-asset inventory:**
- ✅ **Earnings calculator** — `/earnings-calculator` (`EarningsCalculator.jsx` + `lib/earningsCalc.js`). The one genuinely linkable interactive tool.
- ✅ `/wall-of-love`, `/moments`, `/changelog`, `/explore` (directory) — mild link magnets.
- ❌ **Missing:** glossary, free templates/downloads (e.g. "appointment reminder templates", "cancellation policy template"), other calculators (no-show cost, GST, pricing), generators (invoice, booking-link QR), original data/benchmark reports.

**Findings**

**3-A · Only one linkable tool.** → For an SEO strategy that depends on organic links (and the plan explicitly does, `seo-aeo-geo-plan.md`), a single calculator is thin. → **Fix (P1):** ship 2–3 tools that professionals share: **no-show cost calculator**, **GST-on-services calculator** (India-specific, high link value), **free cancellation-policy / reminder-message templates**, **booking-link QR generator**. → **Impact:** H (links + topical breadth) · **Effort:** M.

**3-B · Organization schema has no postal address / phone / legalName despite a real registered office.** → **Evidence:** the legal entity and NAP exist in prose — **Timewheel Internet Private Limited**, CIN `U62012OD2026PTC052654`, GSTIN `21AAMCT8270C1ZF`, registered office _Ground Floor, Holding No-55, Ward No-19, Natapada, Jajpur Road, Byasanagar, District Jajpur, Odisha – 755019, India_ (`Privacy.jsx:28-31,204`). But `organizationJsonLd`/`orgNode` (`seo.js:271-353`) and the homepage Organization (`Home.jsx:102-116`) carry only name/url/logo/sameAs — no `legalName`, `address`, or `contactPoint`. → **Fix (shipped, P1):** add `legalName` + `PostalAddress` + a support `contactPoint` to the central Organization schema (truthful — the company's own published details). → **Impact:** M (entity disambiguation, local/India trust, GEO) · **Effort:** S.

**3-C · Entity consistency is otherwise good.** sameAs (LinkedIn/Instagram/Facebook/X) is identical across `seo.js:262-267` and `Footer.jsx:29-35`. Author E-E-A-T is modelled (blog author → on-site host profile + external sameAs, `blogPosts.js:36-50`). No fix.

**3-D · Off-site profiles to claim (no code; action list for you).** Non-negotiable, India-weighted:
- Global: **Google Business Profile**, **Bing Places**, **LinkedIn Company** (exists), **Crunchbase**, **Product Hunt**, **G2**, **Capterra**, **GetApp/Software Advice**, **Trustpilot**.
- India-specific: **MCA/company listing** (already a real entity — leverage it), **IndiaMART**, **Justdial**, **Sulekha**, **YourStory / Inc42 / Entrackr startup directories**, **SaaSworthy**, **Techjockey** (India SaaS marketplace), **AppSumo** (if a deal fits). These are both citations and backlinks; claim + NAP-consistent with 3-B.

### Pillar 4 — Digital PR readiness

**4-A · No press/data page, no dataset, no embeddable chart.** → **Evidence:** content inventory found none. → **Fix (P1):** add a `/press` page (logo pack, boilerplate, founder bios, contact) and a lightweight public `/stats` page. → **Impact:** M · **Effort:** M.

**4-B · The dataset is too small for a credible data story — today.** → **Evidence:** 49 lifetime bookings (35 completed / 12 cancelled / 2 no-show), 6 reviews, 82 hosts. A "24% of appointments get cancelled" headline off 49 bookings is statistically meaningless and reputationally risky — **do not pitch it.** → **Honest recommendation:** instrument now, pitch later. Proposed angles + the exact query, each gated on a volume threshold:

| # | Headline (when data supports it) | Query (already runnable, re-run at threshold) | Outlet types | Threshold |
|---|---|---|---|---|
| 1 | _"The hidden cost of no-shows: what India's solo professionals lose every month"_ | `select count(*) filter (where status='no_show')::float/count(*) as no_show_rate, sum(vendor_amount) filter (where status='no_show') as lost_value from bookings` | India business/SMB press (YourStory, Inc42), finance verticals | ≥2,000 bookings |
| 2 | _"Which professions in India are fastest to get booked?"_ (time-to-first-booking by category) | `select primary_category, avg(first_booking_at - created_at) from profiles … group by 1` (requires a first-booking timestamp) | Creator-economy, freelancing press | ≥500 hosts across ≥10 categories |
| 3 | _"UPI vs cards: how India actually pays for appointments"_ (payment-method split, advance vs on-arrival) | aggregate `payments` by method + advance flag | Fintech press (Entrackr, Medianama), Razorpay co-marketing | ≥5,000 payments |

Until thresholds are met, the credible PR is **build-in-public** (already seeded: `docs/build-in-public-blog-series.md`, `blog-autopost` recap mode) — ship that, not data journalism.

---

## 6. Pillar 5 — SEO automation (Claude skills)

**Existing skills (strong "write" leg):** `blog-seo-optimizer` (optimise+score+PR a post), `blog-autopost` (unattended daily publish), `bas-seo-schema` (the AEO schema layer). The loop is missing **audit → plan → measure**.

**Proposed chain:**
```
seo-aeo-audit   → seo-topical-map   → blog-seo-optimizer   → seo-measure
 (this audit,       (keyword →          (EXISTS: write +        (GSC/Bing pull →
  repeatable)        topical map +       score + PR)             rank/CTR deltas →
                     fan-out → briefs)                          feed next cycle)
```

**Written in full (this PR):**
1. **`.claude/skills/seo-aeo-audit/SKILL.md`** — codifies this exact 6-pillar audit as a repeatable, evidence-gated pass (incl. the "derive crawler HTML from the prerender source when egress is blocked" technique and the real-reviews honesty check that caught P0-1).
2. **`.claude/skills/seo-topical-map/SKILL.md`** — takes a money keyword, builds the ideal topical map + per-keyword query fan-out, maps existing pages onto it, and emits ready-to-write page briefs (slug / role / target query / 5-line brief), reconciling targeting against **actual host supply** (the DB check that surfaced finding 1-A).

**Next (not written, by instruction — write 3rd/4th later):** `seo-measure` (GSC + Bing Webmaster API → impressions/CTR/position deltas per cluster → auto-open a "decay" issue), and optionally `seo-internal-link` (orphan + weak-anchor fixer from a crawl).

---

## 7. Access I don't have — what you must pull manually

- **Live rendered prod HTML & status codes** — egress is blocked here. Run: `curl -sL -A "Googlebot" https://bookasloth.com/` and a host/service URL; confirm the prerender shells actually serve (header `X-Prerender: true`), legal-page canonicals, and that the 5 newly-sitemapped `/for` pages return 200.
- **Core Web Vitals / Lighthouse** — `npx lighthouse https://bookasloth.com --preset=desktop` and mobile; the static hints (`index.html`) look good but LCP/INP/CLS need real measurement. **[VERIFY LIVE]**
- **Google Search Console + Bing Webmaster** — coverage/indexing, which `/for` + `/services` pages are "Crawled – not indexed" (expect the empty-supply verticals from 1-A), query/CTR data. The plan notes GSC submission was never confirmed (`seo-aeo-geo-plan.md:25`).
- **Backlink data (Ahrefs/Semrush)** — for Pillar 3 baseline and competitor gap.
- **A full site crawl (Screaming Frog/Sitebulb)** — for the orphan/click-depth/anchor-text items in 1-D and the h1 verifies in 0-F.
- **Decision on P0-1** — the real displayed review/testimonial count for the homepage `reviewCount`.

---

## 8. Priority list

### P0 — this week
- **P0-1 · Fix the homepage `reviewCount: 176` vs 6 real reviews** (0-C). _Needs your number_ — not auto-changed. Highest risk item.
- **P0-2 · Repoint `Organization.logo` off the 404** (0-A). **✅ shipped on this branch.**
- **P0-3 · Add the 5 missing `/for` pages to the sitemap** (0-B). **✅ shipped on this branch.**

### P1 — this month
- **P1-1 · Add JSON-LD (FAQPage + SoftwareApplication) to the 5 `/lp/*` pages** (0-D / 2-A).
- **P1-2 · Realign the industry cluster to actual supply** — build `/for` + `/services` for consultants(exists)/software-engineers/startup-&-career-advisors/content-creators/product-&-UX/marketing; demote empty verticals (1-A). _(See §9 briefs.)_
- **P1-3 · Enrich Organization schema with legalName + PostalAddress + contactPoint** (3-B). **✅ shipped on this branch.**
- **P1-4 · Ship 2–3 linkable tools** (no-show cost, GST, templates, QR) (3-A).
- **P1-5 · Definitional/glossary tier** (1-C) + "collect payment before appointment" page (2-D).
- **P1-6 · `/press` + `/stats` page; start instrumenting data-PR metrics** (4-A/4-B).
- **P1-7 · Claim the off-site profiles** (3-D).

### P2 — backlog
- P2-1 · `BreadcrumbList` in the bot-prerender shells (0-E).
- P2-2 · Verify single-h1 on About/HowItWorks (0-F).
- P2-3 · Standalone `Review` schema once review volume grows (2-C).
- P2-4 · Expand `/services/:profession` OVERRIDES content (1-B).
- P2-5 · Reconcile support email across schema/footer/legal (0-G).
- P2-6 · `seo-measure` + `seo-internal-link` skills (Pillar 5).

---

## 9. Missing pages to create

_Role = place in the topical map. Each brief is 5 lines: intent, angle, key sections, internal links, schema._

**1. `/for/consultants` → fix the slug mismatch for the #1 supply vertical** _(there are 14 consultant hosts; the page is `/for/business-consultant`)_
- Intent: commercial — "booking software for consultants India".
- Angle: 1:1 paid consults, advance payment over UPI, no back-and-forth.
- Sections: hero + answer line; pains (chasing payment, no-shows); how it works; pricing; FAQ.
- Links: `/pricing`, `/features/payments`, `/lp/calendly-alternative`, 2–3 consultant host profiles.
- Schema: `professionGraphJsonLd` (already available). _Add a 301 from `/for/consultants` → `/for/business-consultant` or vice-versa._

**2. `/for/software-engineers` (NEW — 14 real hosts, no page today)**
- Intent: commercial — "booking link for mentoring / mock interviews / code review".
- Angle: paid mentorship & mock-interview booking with UPI, calendar sync.
- Sections: use-cases (mentoring, interviews, consulting); payments; calendar; FAQ.
- Links: `/features/google-calendar`, `/features/payments`, `/pricing`, engineer host profiles.
- Schema: `professionGraphJsonLd`.

**3. `/for/career-coaches` (NEW)**
- Intent: commercial — "booking software for career coaches / resume reviewers".
- Angle: sessions + digital products (resume templates) in one link.
- Sections: coaching session booking; digital products; reminders; FAQ.
- Links: `/features/digital-products`, `/features/notifications`, `/pricing`.
- Schema: `professionGraphJsonLd`.

**4. `/for/content-creators` (NEW — Topmate's core audience; strong `/lp/topmate` tie-in)**
- Intent: commercial — "Topmate alternative for creators / paid 1:1s".
- Angle: monetise 1:1s, priority DMs, digital products with 0% commission on paid plans.
- Sections: creator use-cases; vs Topmate; payments; FAQ.
- Links: `/lp/topmate-vs-bookasloth`, `/features/digital-products`, `/pricing`.
- Schema: `professionGraphJsonLd`.

**5. `/tools/no-show-cost-calculator` (NEW linkable tool)**
- Intent: informational/linkable — "cost of no-shows calculator".
- Angle: input bookings/price/no-show% → rupees lost/month; CTA to reminders.
- Sections: calculator; what drives no-shows; how reminders cut them; FAQ.
- Links: `/features/notifications`, `/earnings-calculator`, relevant blog posts.
- Schema: `SoftwareApplication`/`WebApplication` + `FAQPage`.

**6. `/tools/gst-on-services-calculator` (NEW linkable tool — India-specific)**
- Intent: informational/linkable — "GST on professional services India calculator".
- Angle: compute GST on a service fee; answer "do I charge GST on consulting?".
- Sections: calculator; GST basics for solo pros; how BAS invoices GST; FAQ.
- Links: `/host-fees`, `/pricing`, GST blog posts.
- Schema: `WebApplication` + `FAQPage`.

**7. `/glossary` + `/glossary/:term` (NEW definitional tier)**
- Intent: definitional — "what is a booking page / booking link / double booking / buffer time".
- Angle: 30–50 crisp, answer-first term definitions (AEO/GEO fuel).
- Sections: A–Z index; per-term definition + example + related terms.
- Links: each term → the relevant `/features/*` page + hub.
- Schema: `DefinedTermSet` / `DefinedTerm` + `BreadcrumbList`.

**8. `/collect-payment-before-appointment` (NEW answer page)**
- Intent: commercial/informational — "how to take payment before an appointment (India)".
- Angle: advance payment / deposits over UPI, why it kills no-shows.
- Sections: answer-first summary; step-by-step; deposit vs full; FAQ.
- Links: `/features/payments`, no-show calculator (#5), `/pricing`.
- Schema: `HowTo` + `FAQPage`.

**9. `/press` (NEW)**
- Intent: PR/navigational — press kit.
- Angle: boilerplate, logo pack, founder bios, real entity (Timewheel Internet Pvt Ltd), contact.
- Sections: about; facts; assets; media contact.
- Links: `/about`, `/stats`, `/changelog`.
- Schema: `Organization` (with the new address/legalName) + `ContactPage`.

**10. `/stats` (NEW — groundwork for data PR)**
- Intent: linkable/transparency — live platform stats.
- Angle: hosts, categories, "built in India" — honest numbers, embeddable.
- Sections: headline counters; category breakdown chart (embeddable); methodology.
- Links: `/press`, `/explore`, `/wall-of-love`.
- Schema: `Dataset` (once numbers are PR-ready) + `WebPage`.

---

_End of audit. Code-only P0/P1 items shipped on this branch are listed in the PR summary; everything tagged **[VERIFY LIVE]** or "NEEDS YOU" requires access this environment doesn't have (see §7)._
