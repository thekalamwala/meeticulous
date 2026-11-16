# Meeticulous Creator Intelligence — research report

**Date:** 2026-11-16 · **Status:** research only, nothing approved, nothing built
**Covers deliverables 1–3 of the brief:** competitor research, open-source
technology comparison, licensing + cost analysis. Architecture recommendation
included because the licensing findings decide it.

**Evidence rule used throughout:** every competitor claim is tagged
`[1P]` (the vendor's own documentation or product page), `[3P]` (third-party
review, comparison or competitor teardown — directional only, not quotable), or
`[conflict]` (sources disagree; do not build on it). Nothing here is invented. Where
a page could not be retrieved, it says so instead of filling the gap.

---

## 0. What Meeticulous already has (audited, not assumed)

Before any research matters, this is the real starting line.

| Capability | State today | File |
|---|---|---|
| Event bus | **Built.** The only analytics surface components may import. Consent-aware, prod-host gated, adapter-per-tool so tool churn costs one file. | `client/src/services/analytics/index.js` |
| Event catalog | **Built.** ~45 locked names, snake_case `object_action`, dev guard on unknown names. Already includes `host_profile_viewed`, `service_viewed`, `booking_started`, `booking_slot_picked`, `checkout_started`, `booking_created`, `booking_paid`, `payment_failed`. | `client/src/services/analytics/events.js` |
| Server-side money events | **Built.** `trackServer()` fans out to PostHog + GA4 Measurement Protocol + Meta CAPI with shared `event_id` de-dupe, fire-and-forget, never throws on a payment path. | `server/utils/trackServer.js` |
| Destination | PostHog Cloud (+ GA4, Meta Pixel, Clarity, GTM). | adapters/ |
| **First-party event store** | **Does not exist.** | — |
| Host-facing analytics | `profile_views` — a single integer column on `profiles`, bumped by `increment_profile_views` RPC. One endpoint: `GET /host/profile-views`. Plus `ConversionFunnel.jsx` = views → bookings → % (Pro-gated, blur teaser for free). | `server/controllers/hostController.js:1040` |
| Admin analytics | `insightsAdminController.js` — deliberately **Postgres-first**; its own header states traffic/source and visitor funnel "live in PostHog/GA4 and are reached via launchpad links (a server-side PostHog query API is deferred)". | `server/controllers/insightsAdminController.js` |
| Overlapping in-flight work | `docs/future/pro-insights-suite.md` (13 Pro-gated insight features, spec'd 2026-11-16) · `/host-lab` prototype, uncommitted, 4.6k lines, 8 sections incl. Money/Clients/Grow · `2026-11-14-free-to-pro-conversion-design.md` (approved, D1–D3 locked) | — |

**Live data volume (queried `spquowzrefozmrzoszkf`, 2026-11-16):**
8 profiles · 11 services · **5 bookings total, 4 paid**, first one 2026-11-12 ·
72 lifetime profile views across all hosts (max 29 on one) · 0 reviews ·
2,219 CRM contacts (leads, not customers) · 2 Pro plans.

That number is the most important input in this document and it changes the
answer to section 7. There is no analytics data-volume problem to solve. There is
a *product* problem: what makes a host hand over ₹1,179.

**Two consequences, stated plainly:**

1. **Three sections of the brief cannot be computed from our data at all today** —
   not "poorly", at all. Audience (B1–B5: unique visitors, returning visitors,
   traffic sources, geography, devices, landing/exit pages, navigation paths),
   Marketing (I: UTM, campaigns, referrals), and everything in the funnel above
   `booking_created` (Conversion D step-wise drop-off). That data exists only
   inside PostHog Cloud. The build is the **ingestion + store**, not the charts.
2. **`profile_views` is a counter, not a log.** It has no timestamp, no visitor
   identity, no referrer, no device. So "profile views over time", the single most
   requested chart in the brief, is impossible on existing columns — including for
   the 72 views already counted. Those 72 are unrecoverable as a time series.

---

## 1. Competitor research

### 1.1 The scheduling tools (our direct shape)

**Cal.com — Insights** `[1P]` ([bookings insights](https://cal.com/help/bookings/insights.md), [routing insights](https://cal.com/help/insights/routing-insights.md))

- KPI cards: Total events, completed, rescheduled, cancelled · average rating,
  host no-show rate, guest no-show rate, CSAT score. Every card carries a
  previous-period comparison.
- Charts: Event trends (daily bookings by status) · average event duration ·
  no-show hosts over time · CSAT over time. Insights 2.0 added *Bookings by Hour*
  and *Recent No-Show Guests* `[1P blog]`.
- Tables: popular events · most/least booked members · most/least completed
  members · cancellation + no-show tables · **top 10 cancellation reasons** and
  **top 10 reschedule reasons** with counts · ratings and recent feedback.
- Date range: Today, Last 7/30/90 days, MTD, YTD, **Next 7 days**, Custom. A
  **date-target toggle: "Booking time" (default) vs "Created at"**. Tooltip shows
  exact range + timezone.
- Filters: team, member, booking link, member attributes (org-level, e.g. Department).
- Routing funnel: three stages — **total submissions → successful routings →
  accepted bookings** — plotted over time, plus **"Failed bookings by field"**,
  which groups non-booking responses by the question and answer that preceded the drop.
- CSV download of the current view. Insights is paid-subscriber-only `[1P blog]`.

**Calendly — Analytics** `[1P]` ([help](https://calendly.com/help/calendly-analytics))

- Metrics: events created, completed (with trend), rescheduled, cancelled,
  distribution by event length, most-booked events, most popular booking times.
- **Customizable widget dashboard** — pick which widgets appear; each widget has an
  info icon explaining what it shows and a three-dot menu for more options.
- Filters: date, user, team, group, event type. Up to **one year** of data.
- Export: CSV of either Event Data or Employee Data.
- Routing Form analytics (submissions → booked meetings, incl. from Marketo,
  Pardot, HubSpot) on Teams and above.
- Access: Owners and Admins only; a regular user sees only their own events.
  `[conflict]` on which plans — the help page lists Professional/Standard/Standard
  Plus/Teams/Teams Plus/Enterprise, the blog says Professional/Teams/Enterprise, the
  features page says Standard/Teams/Enterprise. Do not quote a plan name.

**Topmate** `[1P]` ([Premium help article](https://topmate72420835211887570.freshdesk.com/support/solutions/articles/1070000111287-topmate-premium))

The closest competitor, and the most useful finding in this report is about
*packaging*, not features:

- Premium includes "Powerful Analytics". Verbatim: *"Our analytics tab helps you
  get insights that assists you in making informed decisions and measuring your
  success on topmate."* That is the entire public documentation of it.
- Basic (free) gets unlimited services, pay-what-you-want, smart automations,
  support-my-work, session recordings. **Analytics is Premium-only.**
- **Premium costs 3% higher commission** than Basic.

`[3P]` A competing product's public teardown describes Topmate's dashboard as
having an earnings view with available/pending/paid buckets, a trailing six-month
analytics tab, and per-offering views/bookings/earnings/conversion-rate. Directionally
useful; unverifiable; not a basis for any spec line.

**SavvyCal / TidyCal** `[3P]` — TidyCal shipped a dashboard update (Sept 2025) covering
"metrics, upcoming schedule and top booking types" and pushes six events into GA4
including `view_booking_page` and `booking_complete`. No first-party SavvyCal
analytics documentation found; its reporting reaches users mainly through
third-party connectors. Treat both as non-threats on analytics.

### 1.2 The creator-commerce tools

**Gumroad** `[1P article exists but body not retrievable]` — the help article
*The sales analytics dashboard* is real (`gumroad.com/help/article/74`) but the
fetch returned only its title, so the following is from search extract, not the
page: daily hover showing views, sales and value for that date; a **referrers table
with views, purchases, conversion % and sales value per source, sortable by any
column**; locations; CSV export; UTM link tracking; defaults to the past month and
to all products. Its definition of conversion is viewing a product and deciding to
buy. **Re-fetch before quoting.**

**Stan Store** `[3P, competitor-authored guides]` — Analytics tab with store visits,
product views, orders, conversion rate, revenue, date-filtered; revenue by product.
Creator Pro ($99/mo vs $29/mo) is said to unlock pixel integrations, affiliate
analytics, email-flow metrics and course-retention data. Reviewers call the
analytics "functional but basic". One noted gap worth stealing: organic clicks from
posts, DMs and Stories are **not labelled by platform** inside the dashboard.
Source quality is poor (a competitor's content marketing); use only as evidence
that *analytics-behind-the-upgrade is the category norm*.

**Beacons** `[1P help + 3P]` — page views, link clicks, traffic sources, audience
activity, sales; a separate **Income dashboard** aggregating all revenue streams,
including accounts connected or a CSV upload. Two first-party trust failures worth
learning from: **your own test clicks count toward analytics**, and data **can take
up to 30 minutes to refresh**.

**Kajabi** `[1P]` ([analytics overview](https://help.kajabi.com/articles/analytics/analytics-overview.md), [subscription metrics](https://help.kajabi.com/articles/analytics/report-subscription-metrics.md))

The most mature IA in the set: a **customizable Analytics Overview** as the entry
point, then 40+ individual reports behind `Analytics > Reports`. Subscription
metrics: MRR, ARPU, churn — *churn defined as the percentage of subscriptions
cancelled relative to the starting base in the selected period*. Revenue reports:
**Gross Revenue (explicitly does not account for refunds)**, Refunds, Gross Revenue
by Payment Method, Gross Revenue by Pricing Type. Plus a Product Progress report
tracking customers through each product.

### 1.3 The reference-class dashboards

**Shopify** `[1P]` ([ShopifyQL sessions schema](https://shopify.dev/docs/api/shopifyql/latest/schemas/sessions_and_behavior/sessions))

- The funnel is modelled as session counters, not a derived chart:
  `sessions_with_cart_additions`, `sessions_that_reached_checkout`,
  `sessions_that_completed_checkout`. The Online store conversions report shows
  session count at each stage: landing → cart → checkout → completed.
- **The lesson is a warning.** `latest` defines store conversion rate as
  *sessions that completed checkout / sessions*; the `2025-10` schema defines
  checkout conversion rate as *sessions that completed checkout / sessions that
  reached checkout*. Same product, different denominator, different API version.
  A metric whose denominator can drift is a metric hosts will stop trusting.
  This is the reason section 5 of the brief (metric dictionary) must freeze
  denominators in writing before any chart is drawn.
- `[3P, unconfirmed]` cohort analysis and profit reports are gated to higher tiers.

**Stripe** `[1P]` ([revenue reporting](https://docs.stripe.com/revenue-reporting), [billing analytics](https://docs.stripe.com/billing/subscriptions/analytics.md))

- Gross vs **net volume** (gross minus fees, refunds and disputes) — the
  distinction the brief's section E demands and which most creator tools skip.
- MRR, Churn and Active Subscribers are **configurable**: the merchant chooses how
  Stripe calculates them. MRR growth is defined as new + reactivation + expansion
  − contraction − churn.
- Prebuilt report downloads from the Billing overview (live mode).
- `[3P, vendor-biased]` Baremetrics/Putler-class sources claim Stripe lacks MRR
  movement breakdowns, churn by plan/segment and LTV. Stripe's own glossary defines
  the movement components, so `[conflict]` — do not cite either way.

**Product analytics (Plausible, PostHog, Mixpanel, Amplitude, GA4)** — covered in
section 2, since for us they are technology choices, not competitors. One finding
belongs here because it eliminates an architecture: **GA4 cannot serve per-host
dashboards.** A dimension with more than 500 unique values in a day is high
cardinality and its smaller values are folded into an `(other)` row, in standard
reports *and* the Data API `[1P]`
([GA4 cardinality](https://support.google.com/analytics/answer/9309767)); and the
Data API's quota is per *property*, shared by every consumer reading it
`[1P quota docs + 3P figures: ~200k core tokens/day, 40k/hour]`
([quotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas)).
A `host_id` dimension across hundreds of hosts is exactly the high-cardinality
case, and every host loading their dashboard would draw from one shared bucket.
GA4 stays an ads/marketing destination. It is not a product backend.

### 1.4 Comparison matrix

Columns per the brief. "Build better" is scored against *our* assets: Postgres as
source of truth for money, cross-host data, and a 0%-commission Pro tier.

| Product | What they offer | Do particularly well | Missing | Learn | We could build better |
|---|---|---|---|---|---|
| **Cal.com** `[1P]` | Events by status, no-show + CSAT, routing funnel, reason tables, CSV | **Forward-looking "Next 7 days"**; booking-time vs created-at toggle; drop-off attributed to the *field* that caused it | No money, no traffic source, no customer LTV | Reason tables; the two-clock toggle; funnel stage → cause | Tie the funnel to ₹ lost, not event counts |
| **Calendly** `[1P]` | Event counts, popular times, length mix, widget dashboard, CSV | Customizable widgets; per-widget "what is this" info icon | No revenue, no visitor data, admin-only | Per-widget explanation as a first-class element | Host-owned (not admin-owned) analytics; money included |
| **Topmate** `[1P` packaging`]` | "Powerful Analytics" tab, Premium-only | Correct instinct: analytics is the upgrade trigger | Charges **+3% commission** for it; no public definitions | **The packaging** | Our Pro is ₹1,179 flat **and takes commission to 0%** — strictly cheaper than their upgrade for any host over ~₹39k GMV/yr |
| **SavvyCal / TidyCal** `[3P]` | Thin dashboards, GA4 passthrough | Cheap | Effectively no analytics product | Nothing | Everything |
| **Stan Store** `[3P]` | Visits, product views, orders, conv %, revenue; Pro tier adds pixels/affiliate/email/course data | Simple and legible | Social traffic not labelled by platform; "basic" | Don't over-build: five numbers already satisfy most creators | Label Indian social traffic properly (WhatsApp, Instagram) |
| **Gumroad** `[1P, re-verify]` | Views/sales/value by day, sortable referrer table with conv % and ₹, locations, UTM, CSV | **Referrer table with revenue per source** — the single best artefact in the category | No customers/retention/forecast | Sortable source table with ₹ per source | Add booking-specific stages between view and sale |
| **Beacons** `[1P]` | Page views, clicks, sources, sales; income dashboard | Aggregating every income stream in one place | **Own test clicks counted; up to 30 min stale** | What *not* to do: exclude the host's own views; state freshness | Exclude self-views by default; print "as of" on every page |
| **Kajabi** `[1P]` | Overview + 40 reports, MRR/ARPU/churn, gross-vs-refunds, product progress | Overview-then-reports IA; stating that Gross excludes refunds | Heavy; course-business shaped | The IA; explicit metric caveats inline | Fewer, sharper reports — a solo host is not a course company |
| **Shopify** `[1P]` | Session-stage counters, conversion reports, report library | Funnel as stored counters, not a derived chart | Denominator drifted between API versions | **Freeze denominators** | One published dictionary, versioned, never silently changed |
| **Stripe** `[1P]` | Gross vs net volume, configurable MRR/churn, report downloads | Net volume honesty; configurable definitions | LTV/segment churn contested | Gross vs net as a first-class split | Indian reality: GST, platform fee, Razorpay fee, payout timing in one statement |
| **GA4** `[1P]` | Free web analytics | Scale, free | **`(other)` row above 500/day cardinality; per-property shared API quota** | Why not to resell someone else's warehouse | Per-host isolation by construction |
| **Plausible / Umami** `[1P]` | Privacy-first pageviews, sources, geo, devices | Lean schema, fast | No money, no per-tenant product surface | Their **schema**, not their dashboards | Join traffic to bookings and ₹ |
| **PostHog** `[1P]` | Funnels, retention, cohorts, paths, replay | Depth; MIT core; generous free tier | Self-host "for hobbyists"; not a per-tenant product backend | Funnel + retention semantics | Serve our own hosts from our own store |
| **Mixpanel / Amplitude** `[1P/3P]` | Best-in-class funnel/cohort/retention UX | Interaction design of funnel + cohort views | Priced per event; internal-team shaped | **Their UX patterns** | Same clarity, creator vocabulary, no event budget |

### 1.5 The gap nobody fills

Across all sixteen: **not one ties analytics to the money the creator is losing,
and not one benchmarks a creator against peers.** Topmate charges +3% commission
for analytics; Stan hides affiliate data behind $99/mo; Beacons aggregates income
but compares you to nothing. Every dashboard answers "what happened". None answers
"what is this costing you" or "what do comparable hosts do differently".

Both of those are available to us: commission paid is already a column
(`bookings.commission_applied`), and cross-host aggregation is a query. That — plus
`docs/future/pro-insights-suite.md`'s win-back list — is the differentiated core.
Charts are table stakes; these three are the product.

---

## 2. Open-source technology comparison

| Project | License | Store | What it would give us | Verdict |
|---|---|---|---|---|
| **Plausible CE** | **AGPLv3** (tracker MIT) `[1P]` | ClickHouse | Pageviews, sources, geo, devices, goals | **No code reuse** — see 3.1. Study the schema; the MIT tracker is separately reusable |
| **PostHog** | MIT core, enterprise dir separately licensed `[1P]` | ClickHouse + Postgres + Kafka | Already our destination. Funnels, retention, paths, replay | **Keep as-is for internal use.** Self-host is documented as "made for hobbyists… most companies should use PostHog Cloud" `[1P]` |
| **Umami** | **MIT** `[1P]` | Postgres **or** MySQL | Minimal pageview/session/event schema that runs on *Postgres* | **The one we may actually borrow code or schema from.** Closest fit to our infra |
| **Matomo** | GPLv3 `[1P; one source says AGPL — conflict]` | MySQL | Full web analytics | **No.** Copyleft + heatmaps/A-B/replay are paid plugins even self-hosted `[3P]` |
| **Apache Superset** | Apache 2.0 | any SQL | Internal BI console | Internal only. Brief rule 8 forbids an embedded dashboard as the product |
| **Metabase** | **AGPLv3** `[1P]` | any SQL | Internal BI, embedding | Internal only, and AGPL makes embedding a legal question. Cal.com itself uses Metabase for *internal* self-service analytics `[3P case study]` — the same split we should adopt |
| **ClickHouse** | Apache 2.0 `[1P/3P consistent]` | — | Columnar OLAP at any scale | Right answer eventually. Wrong answer at 5 bookings. Needs an ops owner we don't have |
| **Apache Druid** | Apache 2.0 `[3P: DB-Engines]` | — | Real-time OLAP | No. Strictly heavier than ClickHouse for us |
| **OpenTelemetry** | Apache 2.0 | — | Traces/metrics for *infrastructure* | Out of scope. Product analytics is not telemetry |

**Free-tier reality check** (why "eliminate subscriptions" is already true):
PostHog Cloud free = **1M product-analytics events/month**, reset monthly, no
rollover; overage starts at $0.00005/event `[1P]`
([pricing](https://posthog.com/docs/product-analytics/pricing.md)). Mixpanel free
≈1M events/mo `[conflict: some sources say 20M, which belongs to the paid Growth
tier]`, event-based pricing since Feb 2026. Amplitude free ≈2M events/mo `[3P]`.

At our volume we would not exceed a free tier for years.

---

## 3. Licensing and cost analysis

### 3.1 The AGPL finding (decides the architecture)

Plausible CE is AGPLv3 and **network use counts as distribution** `[1P docs]`
([self-hosting](https://plausible.io/docs/self-hosting)). Meeticulous is a hosted
SaaS. If we vendored, modified or linked Plausible CE code into our server and
served it over the network, the AGPL's source-disclosure obligation would attach to
the combined work. The same reasoning applies to Metabase (AGPLv3) for embedding,
and GPLv3 Matomo for linking.

So the brief's instruction to "reuse compatible open-source components" has a
narrow answer:

- **Reusable:** Umami (MIT), PostHog core (MIT), Plausible's **tracker** (MIT,
  separate from the server), ClickHouse/Druid/Superset/OTel (Apache 2.0).
- **Learn-from-only, never vendored into our server:** Plausible CE server,
  Matomo, Metabase.
- This is a reading of public licence terms by an engineer, not legal advice. If we
  ever ship modified AGPL code, that needs a lawyer, not a design doc.

### 3.2 Costs

| Architecture | Recurring software | Infrastructure | Engineering + ops | Where it bites |
|---|---|---|---|---|
| **A. Fully self-hosted OSS** (Plausible CE or PostHog self-host + ClickHouse) | ₹0 | A ClickHouse-capable box. PostHog's own hobby guidance cites ~4 vCPU / 16GB / 30GB+ and a script comment saying "You REALLY need 8GB or more" `[3P relaying 1P repo]` — roughly ₹2.5–6k/mo at Indian cloud rates, before backups | **Highest.** A second datastore to run, upgrade, back up and debug | We are on **Render free** with no Shell and no one on call. Memory: `render-free-plan-no-shell`. This is the costliest option disguised as the free one |
| **B. Hybrid** (PostHog Cloud as store, query its API per host) | ₹0 under 1M events/mo | None | Medium | Query-time dependency on a third party for a **paid** host feature; host dashboards multiply API calls; no SLA on the free tier; brief rules 7+8 argue against it |
| **C. First-party on Postgres** (own event table + nightly rollups in Supabase; PostHog stays for our own analysis) | ₹0 | Supabase rows we already pay for | **Lowest.** One datastore, one language, existing RLS/service-role posture, existing migration workflow | Breaks down at tens of millions of rows/month — far past where we are |

**Correcting the brief's premise.** Objective 3 says the long-term goal is to
eliminate recurring third-party analytics subscription costs. We pay ₹0 today and
would keep paying ₹0 on PostHog's free tier at any volume we can project. So cost
is not the reason to build this. The real reasons are:

1. **We cannot sell what we don't hold.** Pro is a paid promise. Serving it from a
   third party's free tier, at query time, with no SLA, is not a product.
2. **Per-host isolation.** GA4 folds small tenants into `(other)`; PostHog Cloud's
   query API is not a multi-tenant application backend.
3. **Joins.** Every insight worth ₹1,179 — commission leak, win-back, revenue per
   source, peer benchmark — joins traffic to `bookings`, `services`, `contacts` and
   pricing snapshots. Those live in Postgres. Analytics that cannot join to money
   is the vanity dashboard the brief rules out.

State it that way in the roadmap. "Saves subscription fees" would be a false claim.

### 3.3 Recommendation: **Architecture C**

A first-party event table in Supabase Postgres, nightly (or hourly) rollup tables,
read through our existing Express API with plan gating via `planService.isFreeSlug`.
PostHog stays exactly as it is for our own product analysis — unchanged, no
migration, no removal. Nothing in the existing bus or `trackServer` is replaced;
one adapter is **added** so events fan out to our own ingest endpoint alongside the
existing destinations. That is the whole data-layer change.

Reasons, in order:

1. **Volume.** 5 bookings, 72 lifetime profile views. At a generous 500 hosts ×
   2,000 events/month, that is 1M rows/month — about 12M rows/year, which Postgres
   serves from an index with monthly rollups. ClickHouse earns its keep two orders
   of magnitude later.
2. **Licensing.** Nothing copyleft touches our source tree.
3. **Ops.** Render free tier, no Shell, no on-call. A second datastore is the
   fastest way to make this feature unreliable, and an unreliable paid feature is
   worse than no feature.
4. **Joins are the product** (3.2 above).
5. **It is reversible.** An event table with a frozen schema is exactly what you
   replay into ClickHouse later. Choosing C now does not foreclose A; choosing A now
   buys an ops burden for data we do not have.

**When C breaks — the written upgrade trigger** (so this is a decision, not an
assumption): move the event store off Postgres when *any* holds for two consecutive
months — raw events > 20M rows/month; p95 on a rollup-backed analytics endpoint
> 800ms; rollup job > 10 min; or analytics I/O measurably degrading booking writes.
First response is partitioning + coarser rollups, not a new database.

---

## 4. What this means for the brief's scope

The brief specifies a 12-section analytics suite (A–L). Three honest observations
before the design doc:

1. **Build order must follow data availability, not the brief's A–L order.**
   Sections E (revenue), G (customers), H (scheduling) and J (reputation) are
   computable from Postgres **today**. Sections B (audience), C (profile), D
   (conversion funnel) and I (marketing) need the ingest pipeline first. The brief
   puts the unavailable ones first.
2. **A 12-section sidebar is the wrong IA for a host with 5 bookings.** Kajabi's
   40 reports serve course businesses with staff. Cal.com and Calendly ship
   *one* Insights page each. The IA question — one Intelligence tree vs
   distributing metrics into the existing `/host-lab` sections (Money, Clients,
   Grow, Schedule) — is the next decision and it is the founder's, not mine.
3. **`pro-insights-suite.md` is not a competing spec, it is this spec's best half.**
   Win-back list, commission projection and peer benchmarks are the three things no
   competitor has. They should be the first screen of Creator Intelligence, not a
   later phase. Creator Intelligence should absorb that document.

---

## 5. Open questions (founder's calls)

1. **IA:** one `Intelligence` section with its own sub-tree, or distributed into
   the existing Host Lab sections with a single "Intelligence" home? (Next message
   lays out both concretely.)
2. **Free-host experience:** `pro-insights-suite.md` says blurred with the real
   headline teased, matching `ConversionFunnel.jsx`. Confirmed as the pattern for
   every Intelligence surface?
3. **Peer benchmarks:** these need cross-host aggregation with k-anonymity. At
   8 profiles no cohort clears a minimum of 5. Ship the surface with an honest
   "not enough hosts yet" state, or hold the feature until supply exists?

---

## Sources

First-party: [Cal.com bookings insights](https://cal.com/help/bookings/insights.md) ·
[Cal.com routing insights](https://cal.com/help/insights/routing-insights.md) ·
[Cal.com Insights 2.0](https://cal.com/blog/insight-2-0-calcom-scheduling) ·
[Calendly Analytics](https://calendly.com/help/calendly-analytics) ·
[Topmate Premium](https://topmate72420835211887570.freshdesk.com/support/solutions/articles/1070000111287-topmate-premium) ·
[Gumroad analytics dashboard](https://gumroad.com/help/article/74-the-analytics-dashboard) (title only; re-verify) ·
[Kajabi analytics overview](https://help.kajabi.com/articles/analytics/analytics-overview.md) ·
[Kajabi subscription metrics](https://help.kajabi.com/articles/analytics/report-subscription-metrics.md) ·
[ShopifyQL sessions schema](https://shopify.dev/docs/api/shopifyql/latest/schemas/sessions_and_behavior/sessions) ·
[Shopify marketing performance](https://help.shopify.com/manual/orders/marketing-activity) ·
[Stripe revenue reporting](https://docs.stripe.com/revenue-reporting) ·
[Stripe billing analytics](https://docs.stripe.com/billing/subscriptions/analytics.md) ·
[Stripe view metrics](https://docs.stripe.com/billing/subscriptions/view-metrics) ·
[GA4 cardinality / (other) row](https://support.google.com/analytics/answer/9309767) ·
[GA4 Data API quotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas) ·
[Plausible self-hosting](https://plausible.io/docs/self-hosting) ·
[Plausible Community Edition](https://plausible.io/blog/community-edition) ·
[PostHog self-host](https://posthog.com/docs/self-host) ·
[PostHog open-source disclaimer](https://posthog.com/docs/self-host/open-source/disclaimer.md) ·
[PostHog product-analytics pricing](https://posthog.com/docs/product-analytics/pricing.md) ·
[Beacons traffic insights](https://help.beacons.ai/en/articles/4698753)

Third-party (directional only): [Cal.com × Metabase case study](https://www.metabase.com/integrations/calendly) ·
[Umami: self-hosted analytics comparison](https://umami.is/blog/best-self-hosted-web-analytics-tools) ·
[PostHog: open-source analytics tools](https://posthog.com/compare/best-open-source-analytics-tools) ·
[OpenPanel: OSS analytics by licence](https://openpanel.dev/articles/open-source-web-analytics) ·
[Altinity: ClickHouse is Apache 2.0](https://altinity.com/blog/clickhouse-is-apache-2-0) ·
[DB-Engines: Druid vs ClickHouse](https://db-engines.com/en/system/Apache+Druid%3BClickHouse) ·
[Funnel.io: GA4 (other) row](https://help.funnel.io/en/articles/16746932-troubleshoot-missing-values-caused-by-the-other-row-in-ga4) ·
[TidyCal dashboard update](https://sendfox.com/appsumooriginals/c/89ox4r/tidycal-updates-new-dashboard-ai-features-google-analytics-integration-and-more) ·
[Sozee: Stan Store analytics guide](https://sozee.ai/resources/stan-store-analytics-guide) ·
[Topmate consultant-dashboard teardown](https://github.com/Practitionist/familiarise_web/issues/1827)
