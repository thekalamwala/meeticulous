# Enterprise Landing Page (`/enterprise`) — Design Spec

**Date:** 2026-07-13
**Branch:** `feat/enterprise-landing`
**Status:** Approved design → ready for implementation plan

## 1. Goal

A premium `/enterprise` landing page targeting medium/large organizations (hospitals, clinic
chains, salon/gym chains, universities, coaching institutes, multi-location businesses,
franchises, agencies, government/NGO). It positions Meeticulous as **booking infrastructure
built around an organization's workflow** — not a pricing page, not a feature dump.

Tone: professional, calm, spacious, confident. No startup hype, no emoji, no gradient soup,
no exaggerated words (amazing/revolutionary/magic/easy/best/ultimate). Use: reliable, secure,
configurable, flexible, scalable, dedicated, managed, enterprise-ready, built around your workflow.

## 2. Approach

Clone the existing **`ProfessionLanding.jsx` marketing pattern** (self-contained page file +
inline Tailwind + scoped CSS-var theme + shared `Reveal` + a data module). Do **not** use the
dashboard `components/dashboard/ui/*` kit (grayscale, app-internal).

`/enterprise` matches none of the `hideNavbar` prefixes in `App.jsx`, so it inherits the global
Navbar + Footer automatically — same as `About.jsx`. No new layout wrapper.

### Palette — neutral base + orange CTA only (approved)

The Booking.com single-accent discipline. Calm neutral base, orange reserved strictly for CTAs.
Scoped CSS vars on the page `<main>` (mirrors ProfessionLanding's `--lp-*`):

| Var | Value | Use |
|---|---|---|
| `--ent-ink` | `#1a1a1a` (token `ink`) | Headlines, dark bands |
| `--ent-bg` | `#ffffff` (`surface`) | Section base |
| `--ent-tint` | `#faf9f6` (`canvas`) / `#f4f1ea` (`sand`) | Alternating calm bands |
| `--ent-line` | `black/5` | Card borders (1px) |
| `--ent-cta` | `#c23d00` (`primary-cta`, WCAG-AA) | CTA buttons only |
| `--ent-muted` | `#6b7280` (`muted`) | Body/secondary text |

Fonts already global: Plus Jakarta Sans headings, Poppins body. Radius: `rounded-[6px]`
(project `rounded-xl` = 6px). Card recipe copied from ProfessionLanding:
`rounded-[6px] border border-black/5 bg-white p-6/p-7 shadow-[0_8px_30px_rgba(26,26,26,0.04)]
hover:-translate-y-1 hover:shadow-[0_22px_45px_-18px_rgba(26,26,26,0.16)]`.

## 3. Files

### New — client
- `client/src/pages/Enterprise.jsx` — page shell: `<Seo>`, all once-used sections inline, `Reveal` wrappers, scoped `--ent-*` theme.
- `client/src/pages/enterprise/enterpriseData.js` — all copy/data: trust cards, feature categories, industries, services, integrations, deployment options, customizations, FAQ (×20), workflow steps, implementation steps, why-cards. Mirrors `professionLandingData.js`.
- `client/src/pages/enterprise/EnterpriseLeadForm.jsx` — form: controlled state, per-field validation, honeypot, submit → `submitEnterpriseLead`, inline success state, analytics fire.
- `client/src/pages/enterprise/EnterpriseFaq.jsx` — 20-item framer-motion `AnimatePresence` accordion (recipe from ProfessionLanding `FaqAccordion`), fires `enterprise_faq_opened`.

### New — server
- `server/controllers/enterpriseLeadController.js` — clone of `contactController.submitContact`: validate + `esc()` every field, insert `enterprise_leads` row, `sendEmail` to `SUPPORT_EMAIL` (`bolt@meeticulous.in`). Table insert wrapped so an email still sends if the insert fails (fail-soft), and vice-versa.
- `server/routes/enterpriseLeadRoutes.js` — `router.post('/', newsletterEmailLimiter, newsletterIpLimiter, submitEnterpriseLead)`; mounted `POST /api/enterprise-lead` in `server.js` next to the contact mount (~L158).
- `server/migrations/v3.75_enterprise_leads.sql` — new table (see §6). Apply on **both** DBs (Tokyo staging `STAGING_PROJECT_REF` + Mumbai prod `PROD_PROJECT_REF`). Keep a code-side schema fallback until confirmed applied on both.

### Edited — wiring
- `client/src/App.jsx` — `const Enterprise = lazy(() => import('./pages/Enterprise'));` + `<Route path="/enterprise" element={<Enterprise />} />` before the `/:profileSlug` catch-all.
- `client/src/config/reservedSegments.js` — add `'enterprise'` to `RESERVED_FIRST_SEGMENTS` (CI gate `routeManifestSync.test.jsx`). Server `reservedNamespaces.js` **already** reserves `'enterprise'` — no server edit needed for the canonical path.
- `client/src/services/api.js` — `export const submitEnterpriseLead = (data) => API.post('/enterprise-lead', data);`
- `client/src/services/analytics/events.js` — add `ENTERPRISE_HERO_CTA`, `ENTERPRISE_DEMO_CTA`, `ENTERPRISE_SALES_CTA`, `ENTERPRISE_LEAD_SUBMITTED`, `ENTERPRISE_FAQ_OPENED`, `ENTERPRISE_SCROLL_DEPTH` (snake_case values).
- `server/services/sitemapService.js` — add `{ path: '/enterprise', changefreq: 'monthly', priority: '0.7' }` to `STATIC_ROUTES`.
- `client/scripts/prerender.mjs` — add `'/enterprise'` to `PRERENDER_ROUTES`.
- `client/src/components/common/Footer.jsx` — add `{ t: 'Enterprise', href: '/enterprise' }` to the Product/Company `COLUMNS` entry.

## 4. Section order (13 + form + final CTA)

1. **Hero** — H1 "Built around your business, not the other way around." + subheading, primary "Talk to Enterprise Sales" + secondary "Book a Demo" (both scroll to lead form). Right: CSS/SVG mockup of multiple branches / staff / calendars / dashboard (no stock photos, no heavy image).
2. **Trust cards** — 8 cards: Unlimited Staff, Multiple Locations, Custom Integrations, Priority Support, Dedicated Infrastructure, Custom Workflows, Role-based Access, Implementation Support.
3. **Problem** — "Enterprise scheduling isn't just booking appointments." Challenge list → transition line "Meeticulous Enterprise adapts to your workflow."
4. **Enterprise Features** — 6 categories, each title+description+icon+cards: Scheduling, Teams, Customer Experience, Payments, Integrations, Security (card contents per brief).
5. **Workflow builder** — vertical timeline: Customer → Location → Department → Staff → Service → Approval → Payment → Confirmation → WhatsApp → Reminder → Reports.
6. **Industries** — 8 cards (Healthcare, Education, Fitness, Corporate, Government, Consulting, Hospitality, Beauty), each with typical challenge + how Enterprise solves it.
7. **Enterprise Services** — onboarding, migration, implementation, training, priority support, dedicated account manager, technical/API consulting, custom development, SLA.
8. **Integrations grid** — Google Calendar/Meet, Zoom, Microsoft, WhatsApp Business API, Razorpay, Stripe, Cashfree, Webhook, REST API + "future-ready architecture".
9. **Deployment options** — Cloud, Dedicated Instance, Private Cloud, On-premise (Coming Soon).
10. **Frequently requested customizations** — accordion (per-branch calendars, custom approval, own gateway, own WhatsApp API, custom templates, dedicated SMTP, role restrictions, API/ERP/CRM integration, staff hierarchy, custom reports, migration).
11. **Why Meeticulous** — comparison cards: adapts to workflow, direct engineering support, fast implementation, transparent communication, Indian business workflows, modern APIs, scalable architecture, no unnecessary complexity.
12. **Implementation timeline** — Discovery → Requirement Mapping → Proposal → Implementation → Migration → Testing → Training → Launch.
13. **FAQ** — ≥20 enterprise questions (own domain, own WhatsApp API, own Razorpay, permissions, per-location calendars, migration, onboarding, custom integrations, SLA, self-host, API docs, ERP, + more).
14. **Enterprise Lead Form** — fields: Organization Name, Website, Industry, Team Size, Locations, Estimated Monthly Bookings, Current Scheduling Software, Required Integrations, Phone, Business Email, Additional Requirements. CTA "Request Enterprise Consultation". Validation + honeypot + success state.
15. **Final CTA** — "Let's build your booking infrastructure." + primary "Talk to Enterprise Sales" / secondary "Schedule a Demo".

## 5. Lead flow (DB + email — approved)

Client `EnterpriseLeadForm` → `submitEnterpriseLead(payload)` → `POST /api/enterprise-lead`.
Controller: reject if honeypot filled; validate required (org name, business email, phone),
email regex, length caps, `esc()` all; **insert** into `enterprise_leads`; **email** bolt@ with
formatted HTML. Rate limit: `newsletterEmailLimiter` (5/hr/email) + `newsletterIpLimiter`
(20/hr/IP). On success client shows inline confirmation + fires `ENTERPRISE_LEAD_SUBMITTED`.

CTAs: "Talk to Enterprise Sales" and "Book/Schedule a Demo" both smooth-scroll to the form
(single conversion target, Booking.com style — the form is the one destination, repeated).

## 6. Migration `v3.75_enterprise_leads.sql`

```sql
create table if not exists enterprise_leads (
  id uuid primary key default gen_random_uuid(),
  org_name        text not null,
  website         text,
  industry        text,
  team_size       text,
  locations       text,
  monthly_bookings text,
  current_software text,
  integrations    text,
  phone           text,
  email           text not null,
  requirements    text,
  source          text default 'enterprise_page',
  status          text default 'new',
  created_at      timestamptz default now()
);
-- no anon grants (write-side is service_role only via server); RLS enabled, no public policy.
alter table enterprise_leads enable row level security;
```
Apply to both DBs; controller destructures defensively so a missing table degrades to
email-only (fail-soft) until confirmed applied.

## 7. SEO + AEO + GEO

### Target keywords
- **Primary:** Meeticulous Enterprise, **Appointment Booking App**, Enterprise Appointment Booking App.
- **Secondary:** Appointment Booking Software, Enterprise Booking Software, Enterprise Scheduling
  Software, Business Scheduling Platform, Multi-location Booking Software, Franchise Scheduling
  Software, Booking Infrastructure, Custom Booking Platform.
- Woven naturally into H1/subheading, section H2s, meta, first FAQ answer, and JSON-LD `name`/
  `description`/`keywords`. No stuffing — one primary phrase per section max.

### Classic SEO
`<Seo>` props: `title` (contains "Appointment Booking App" + "Enterprise"), `description`,
`canonical=${SITE_URL}/enterprise`, `keywords`, `ogTitle/ogDescription/image`, `robots="index,follow"`,
`jsonLd`. Semantic HTML, one H1, logical H2/H3. Registered in sitemap + prerendered (baked HTML so
non-JS crawlers read tags). Internal links to `/pricing`, `/features`, `/security` or `/about`, `/contact`.

### AEO — Answer Engine Optimization (surfaced in Google AI Overviews, Bing Copilot, voice/answer boxes)
- **Self-contained FAQ answers.** Each of the 20 answers leads with a direct one-sentence answer
  ("Yes — Meeticulous Enterprise supports your own WhatsApp Business API…"), then detail. Extractable
  as a standalone answer without page context.
- **A definitional block** near the top (or as FAQ #1) — "What is an enterprise appointment booking
  app?" — one clean paragraph binding the entity **Meeticulous Enterprise** to the concept. Gives
  answer engines a citable definition.
- **`FAQPage` JSON-LD** carries all 20 Q&A verbatim (question `name` + `acceptedAnswer.text`), so the
  structured answers match the visible copy exactly (required for rich-result eligibility).
- **Comparison + spec content** ("Why Meeticulous", deployment table, integrations grid) as clean
  lists/tables — the format answer engines lift into summaries.

### GEO — Generative Engine Optimization (cited by ChatGPT / Perplexity / Gemini)
- **Concrete, citable claims** over vague marketing: specific capabilities, named integrations
  (Razorpay/Stripe/Cashfree/WhatsApp Business API/Zoom/Outlook), deployment tiers, timeline steps.
  Generative engines prefer specific, attributable statements.
- **Entity clarity:** consistent product name "Meeticulous Enterprise", `Organization` +
  `SoftwareApplication` schema with `sameAs` (from `utils/seo.js` `ORG_SAME_AS`) so the entity is
  disambiguated across the web.
- **Structured JSON-LD `@graph`** (one `<script>`): `SoftwareApplication` (name, applicationCategory
  "BusinessApplication", operatingSystem "Web", offers/aggregate where truthful — omit fake ratings) +
  `FAQPage` + `BreadcrumbList` + `Organization`. Built via `client/src/utils/seo.js`
  (`organizationJsonLd`, `faqJsonLd`, `breadcrumbJsonLd`) — extend if a `softwareApplicationJsonLd`
  builder is missing; do not invent fake `aggregateRating`/`review` (schema-spam risk).
- Headings phrased as natural questions where it reads well (LLMs match query intent to headings).

**Truthfulness gate:** no invented metrics, ratings, customer counts, or logos. Claims map to real
product capability only. AEO/GEO reward accuracy; fabricated schema risks manual action.

## 8. Analytics

Direct import `import { analytics, EVENTS } from '../services/analytics'`. Track: hero CTA,
demo CTA, sales CTA, lead submitted, FAQ opened, scroll depth (25/50/75/100 via IntersectionObserver
or scroll listener throttled). No direct `posthog.capture`.

## 9. UX / a11y / perf

- No horizontal scroll at any breakpoint; mobile/tablet/desktop tested.
- One H1; logical H2/H3 hierarchy. ARIA on accordion (`aria-expanded`, `aria-controls`), form
  labels, keyboard nav. Focus-visible rings.
- `Reveal` respects `prefers-reduced-motion` (already built in). Subtle movement only.
- Lazy-loaded route (`lazyWithRetry`). No layout shift — mockup is CSS/SVG, fixed aspect boxes.
- No new dependency. Icons from `lucide-react` (verify each icon import exists — lucide 1.24;
  a missing named icon breaks the whole bundle → always `npm run build`).

## 10. Deliberate cuts (YAGNI)

1. **Alias routes** (`/enterprise-booking-software`, `/enterprise-scheduling-software`) — not
   built now. Structured so adding one later = one `<Route>` + one reserved segment (client) +
   one server `reservedNamespaces` entry + sitemap/prerender line. Deferred until SEO URL chosen.
2. **On-premise deployment** — presented as "Coming Soon" card only; no real infra.
3. **No captcha** — honeypot + rate limiters only (repo has never used a captcha lib).

## 11. Verification

- `cd client && npm run build` (lucide import guard) + `npm test` (route manifest sync).
- `cd server && npm test` (contact/lead controller pattern).
- Browser preview: render `/enterprise`, check no console errors, form submit happy-path +
  validation errors, responsive at mobile/tablet/desktop, reduced-motion.
- Confirm only pre-existing failures are mentioned.
