# Meeticulous Creator Intelligence — design

**Date:** 2026-11-16 · **Status:** awaiting founder approval · **Branch:** `feat/creator-intelligence`
**Research:** [`2026-11-16-creator-intelligence-research.md`](2026-11-16-creator-intelligence-research.md)
**Absorbs:** `docs/future/pro-insights-suite.md` (that file is retired by this one)
**Sits under:** [`2026-11-14-free-to-pro-conversion-design.md`](2026-11-14-free-to-pro-conversion-design.md) — this is the biggest lever in that system, after commission itself.

Covers brief deliverables 4–10 and 12–14. Deliverable 11 (clickable prototype) is
built after this document is approved.

**Revision 2 (same day):** a builder review ran this document against the codebase.
Its findings are folded in; the calls I made are marked in §17, and the three
decisions that are genuinely the founder's are listed there. The biggest change: the
Supabase org is on the **free tier** (500 MB, 65 MB used), which rewrote retention,
the event row, the rate-limit mount and the upgrade trigger — and `PLAN_MATRIX`
already promises free hosts their earnings and commission tracker, which moved the
gate off Money entirely.

---

## 1. Intent & why

Meeticulous earns ₹0 on Pro GMV. The business is free→Pro upgrades. Topmate — our
nearest competitor — gates its analytics tab behind Premium and charges **+3%
commission** for it `[1P]`. Our Pro is **₹1,179/yr flat and takes commission 5%→0%**,
so for any host above roughly ₹39k GMV/year our analytics upgrade is *cheaper than
staying free*. That is an arithmetic claim, not a marketing one, and it is the spine
of this product.

So Creator Intelligence is not a reporting feature. Its job is to make a free host
see, in rupees, what staying free costs them this month — and then hand them the
one action that recovers it. Sixteen competitors answer "what happened". None
answers "what is this costing you" or "what do comparable hosts do differently".

## 2. Goals

- **One Pro destination, four pages.** A named surface the upgrade page can point at.
- **Every number joins to money.** No metric ships unless it changes a decision
  about price, availability, a guest, or a channel.
- **Three differentiators first:** commission-leak forecast, win-back list, peer
  benchmark. They exist nowhere else in the category and all three run on data we
  already hold.
- **First-party data.** Our own event store, queried by our own API. No third party
  at query time for a feature a host paid for.
- **Every recommendation carries its evidence** — what happened, why it matters, the
  numbers behind it, the action, the expected effect, how to tell if it worked.
- **Honest gating.** Free hosts see the real headline number and a blur, never a
  fabricated one, never a benefit the server doesn't enforce.

## 3. Non-goals

- No change to the existing analytics bus, PostHog, GA4, Meta CAPI or Clarity.
  PostHog stays our internal tool, untouched. One adapter is **added**.
- Not replacing Money, Clients, Grow, Catalog or Schedule. Intelligence links into
  them; they keep their own pages. Nothing in `pageMap.js` moves.
- No second datastore. No ClickHouse, Druid, Plausible CE, Matomo, Metabase embed.
- No wallet, no card vault, no money movement (`no-wallet-no-card-vault`).
- No guest-facing analytics. No admin-facing changes (`insightsAdminController` untouched).
- No geography or map page in v1 — see 6.5 for why, honestly.

## 4. Anti-goals

Failure states even if it technically works:

- **A number a host cannot reconcile against their payout.** Money comes from
  `bookings`, never from tracking events. If our "revenue" disagrees with their bank,
  the whole product is dead.
- **A chart with no data behind it.** Shipping ten pages of empty states to a host
  with 5 bookings is worse than shipping four pages that are full.
- **Vanity.** "Who viewed you" with no action attached. The retired
  `pro-insights-suite.md` already called this out and it stands.
- **Teasing a gate the server doesn't enforce** (honesty rule, `data/plans.js`).
- **Beacons' two mistakes:** counting the host's own views, and silent staleness. We
  exclude self-views by default and print "as of" on every page.
- **Shopify's mistake:** a denominator that drifts between versions. The dictionary
  in §8 is the contract; changing a formula is a versioned, announced change.

## 5. Constraints

- **Data (measured 2026-11-16, `spquowzrefozmrzoszkf`):** 8 profiles · 11 services ·
  5 bookings (4 paid, first 2026-11-12) · 72 lifetime profile views · 0 reviews ·
  2 Pro plans. Everything here must look right at n=0, n=5 and n=5,000.
- **`profile_views` is a counter with no timestamp.** The 72 existing views cannot
  become a time series. Day one of the event store is day one of all trend data, and
  the UI must say so rather than draw a line from nothing.
- **Supabase is on the FREE tier — a 500 MB hard cap, 65 MB used today (49 MB of
  public tables), on the same database that serves booking writes.** Measured
  2026-11-16 (org `ruoczznftdubvktmdoug`, `plan: free`). This is the tightest
  constraint in the design and it rewrites retention, the event row and the upgrade
  trigger. At ~500 bytes per event row all-in (row + three indexes), 435 MB of
  headroom is ~870k events *absolute*; the analytics budget is **200 MB ≈ 400k raw
  events**. Filling this database is a payments outage, not an analytics outage.
- **Infra:** Render free (no Shell, no one-off jobs), Supabase Postgres, Vercel client.
  Crons are the `SCHEDULED_JOBS` array in `server/server.js` driven by `runIfDue`
  (`utils/jobRunner`, persisted in `job_runs`, leader-elected). A new job is one line there.
- **Brand:** Loop & Slot only — tokens from `design-system/`, radius scale, Bricolage/
  Poppins/Instrument Serif. No hard-coded colours.
- **Licensing:** no AGPL/GPL code in our tree (Plausible CE, Matomo, Metabase are
  study-only). MIT/Apache-2.0 only.
- **Shared checkout:** other sessions commit to this repo concurrently
  (`shared-checkout-git-hazard`). All work in this worktree; additive files; one PR.
- **`bookings.source` is already taken** — it means `'platform'` vs manual CRM entry
  (`v3.76_crm.sql`). Marketing attribution gets its own table. Do not repurpose it.

## 6. Approaches

### 6.1 Information architecture (decided: C)

- **A — Own sidebar tree, the brief's A–L.** One upgrade destination, gates wholesale.
  Rejected: 10+ pages duplicating Money/Clients/Grow, which already own revenue,
  customers and reputation; ten empty states for a host with 5 bookings. Cal.com and
  Calendly each ship *one* insights surface; Kajabi's 40 reports serve course
  companies with staff.
- **B — Distributed, no front door.** Smallest build, each number beside its action.
  Rejected: nothing to sell or point `?src=` at, and Topmate's own packaging says the
  *tab* is what converts.
- **C — Hybrid: one `Intelligence` section, four pages, deep links out. ✅ Chosen by
  founder.** One marketable destination and one gate; pages only where data exists
  today; grows page-by-page as ingest lands instead of launching shells.

### 6.2 Data architecture (decided: C)

Full comparison in the research doc §3.2. Summary of why **first-party on Postgres**:

- **Volume.** At 500 hosts × 2,000 events/month ≈ 1M rows/month ≈ 12M rows/year.
  Postgres serves that from an index with daily rollups. ClickHouse earns its keep
  two orders of magnitude later, and we have no ops owner for it on Render free.
- **Licensing.** Nothing copyleft enters the tree.
- **Joins are the product.** Commission leak, win-back, revenue-per-source and peer
  benchmarks all join events to `bookings`, `services`, `contacts` and pricing
  snapshots. Those live in Postgres.
- **Not GA4.** A dimension above 500 unique values/day is folded into an `(other)`
  row in standard reports *and* the Data API, and Data API quota is per-property and
  shared by every consumer `[1P]`. `host_id` across hundreds of hosts is exactly that
  case.
- **Not PostHog-at-query-time.** Its self-host is documented as "made for
  hobbyists"; its Cloud query API is not a multi-tenant application backend; and the
  free tier carries no SLA for a feature a host paid ₹1,179 for.
- **Reversible.** A frozen event schema is precisely what you replay into ClickHouse later.

**Written upgrade trigger** (so this is a measurement, not a vibe). The free-tier
cap makes this a **size** trigger, not a row-count one — "20M rows/month" would have
been a fantasy on 500 MB:

| Signal | Threshold | First response |
|---|---|---|
| `pg_total_relation_size('analytics_events')` | >150 MB sustained | Shorten raw retention (30d → 14d); prune runs hourly |
| Total `pg_database_size` | >350 MB (70% of cap) | **Ingest stops accepting** (see the size guard, §11.5) and the founder is alerted |
| p95 on a rollup-backed endpoint | >800 ms | Coarser rollups, then narrower ranges |
| Rollup job duration | >10 min | Batch by host, then incremental-only |
| Analytics I/O degrading booking writes | any measurable effect | Ingest off by flag, immediately |

Only once Supabase is on a paid tier (8 GB) does the question "ClickHouse or not"
become real. Until then the ceiling is the plan, not the engine.

### 6.3 Where non-page metrics live

Reputation and Goals do **not** get pages (0 reviews exist; a goals page with one
target is a settings form):

- **Reputation** → rating trend + per-service rating render on **Grow › Social
  proof**, which already owns testimonials. Intelligence › Overview shows one rating
  tile that deep-links there.
- **Goals** → a single target strip on Intelligence › Overview (monthly revenue
  target, progress, bookings still needed). Set inline, stored on the host profile.

### 6.4 Gating

**`PLAN_MATRIX` already promises free hosts "Earnings & transaction history ✓" and
"Commission tracker — see what you've paid ✓"** (`client/src/data/plans.js:169-170`),
and `/dashboard/earnings` is ungated today. So Money **cannot** be Pro-gated: that
would paywall data the host already has for free one click away, break a published
promise, and trip the parent design's "real gates only" constraint. It would also be
a weak gate — the conversion value of fencing off something reachable elsewhere is
near zero.

The gate therefore lands on the **intelligence**, not the ledger:

| Free | Pro |
|---|---|
| Money page in full (gross, net, fees, refunds, payouts, transactions, CSV) — a better rendering of what they already get | Revenue **forecast** |
| Commission paid + "Pro would have kept ₹X" (the hook, already honest and already shipped in `CommissionMeter`) | **Win-back list** |
| Headline counts: profile views, paid bookings | **Peer benchmarks** |
| | **Audience & Conversion** page (sources, funnel, devices) |
| | **Retention cohorts, LTV, segments** |
| | **Weekly 3 moves** |

None of those six is promised to free hosts anywhere, so gating them breaks no
promise — and they are the things no competitor has, which makes this the sharper
magnet as well as the honest one.

**Mechanism:** a new `limits.insights` key on `subscription_plans` (CLAUDE.md:
limits always come from `subscription_plans.limits`, never hardcoded), read through
`planService.getLimit` — **not** a bare `isFreeSlug` check. A free host's response
never contains the gated numbers; it carries the teaser headline plus `locked: true`.

**Teaser component:** `ProTeaser.jsx`, which is documented as the *canonical
replacement* for the hand-rolled blur in `ConversionFunnel`/`ClientsList`/`Products`
and carries `?src` on every CTA. Links go to `/dashboard/upgrade?src=intel-<page>`.

> **Pre-existing honesty bug, flagged not fixed here:** `ConversionFunnel.jsx:29`
> renders *fabricated* numbers to free hosts behind the blur (`{views: 248,
> bookings: 37, rate: 15}`). That contradicts the parent design's honesty rule.
> Out of scope for this PR; raised separately.

### 6.5 Geography: deliberately deferred

Our API runs on Render, not behind an edge that injects a geo header, and we store
no IP (§9.4). Country would therefore need an offline IP→country source we don't
have. Rather than ship a grey map, geography is out of v1 and listed in the roadmap
with its dependency named. The brief's B3 is the one section this design openly declines.

---

## 7. Sitemap

```
/dashboard/intelligence                     Intelligence › Overview
  ?range=30d&compare=prev                   (range + comparison are URL state everywhere)
/dashboard/intelligence/money               Intelligence › Money
/dashboard/intelligence/audience            Intelligence › Audience & Conversion
/dashboard/intelligence/demand              Intelligence › Demand & Customers
```

Four routes. Tabs within a page are URL state (`?tab=`) via the existing
`useUrlTab` helper, not new routes. Deep links out to `/dashboard/earnings`,
`/dashboard/clients`, `/dashboard/services`, `/dashboard/availability`,
`/dashboard/testimonials` — those pages are unchanged.

Nav entry: one `Intelligence` item. In the Host Lab IA it sits above Money; in the
current live dashboard it sits above Earnings. `pageMap.js` gains a row; nothing is removed.

---

## 8. Page-by-page specification

Shared furniture on every page: date-range control (presets: 7d, 30d, 90d, MTD, YTD,
**Next 7 days** where forward-looking data exists, Custom), a comparison toggle
(previous period / same period last year / off), an **"as of <timestamp>"** stamp, a
per-tile info tooltip carrying the dictionary definition (Calendly's best idea), and
CSV export of the current view (Cal.com's and Gumroad's). Empty states are written
per page, not generic.

### 8.1 Overview — "what is this costing me, and what do I do today?"

The only page whose job is conversion. Order is deliberate: loss, then action, then context.

| Block | Contents | Source |
|---|---|---|
| **Commission leak + forecast** | Commission paid this FY · run-rate projection for the full year · "Pro costs ₹1,179 — you've paid ₹X" · payback date | `bookings.commission_applied`, live |
| **Win-back list** ⭐ | Guests with no booking in 60+ days, ranked by lifetime spend, with the ₹ at stake and a one-click rebook nudge through the existing notify rail | `bookings` grouped by guest, `contacts` |
| **Peer benchmark** ⭐ | Your price vs the median for your `profession`; your view→book vs cohort median. Anonymised, k-anonymity ≥5 hosts, aggregates only | cross-host aggregate, server-computed |
| **This week's 3 moves** | Up to three evidence-carrying recommendations (§10) | rules over the metrics below |
| **Headline tiles** | Net revenue · paid bookings · profile views · view→book % — each with period comparison | mixed; money live, views rollup |
| **Trend** | Revenue and bookings over the range, dual axis | `bookings` by day |
| **Biggest bottleneck** | The funnel step with the largest drop, named, with its conversion % and the step above it | rollups (Phase 3) |
| **Goal strip** | Monthly revenue target, progress, bookings still needed at current AOV | target on profile + `bookings` |

Empty state at n=0: no charts. A single card — "Your first booking will start this
page" — plus the activation checklist that already exists. A host with zero bookings
is not a freeloader (locked decision D1/anti-goals, carried over).

### 8.2 Money — "where did it actually go, and what is coming?"

Tabs: Overview · Breakdown · Forecast · Transactions.

- **Overview:** gross revenue · platform fee · platform-fee GST · commission ·
  Razorpay fee (actual) · refunds · **net to you** · pending payout · paid out ·
  AOV. Waterfall from gross to net — the one chart that earns its place here,
  because it is the reconciliation a host actually needs. Gross-vs-net trend.
- **Breakdown:** revenue by service, by service category, by booking status, by
  month, by customer. Revenue concentration (share of revenue from top 3 guests) —
  a genuine risk signal for a solo host.
- **Forecast:** confirmed-but-unpaid upcoming revenue (firm), plus a projection from
  trailing booking rate (**labelled an estimate, with its basis and a confidence
  band**). Revenue gap to target.
- **Transactions:** filterable table — date, guest, service, gross, fees, net,
  payment status, settlement status, refund. CSV export. This is a reporting view
  over `bookings`, not a new ledger.

Every figure here comes from `bookings` columns (`customer_total`,
`platform_fee_amount`, `platform_fee_gst`, `commission_applied`, `commission_gst`,
`razorpay_fee_actual`, `refunded_amount`, `vendor_amount`, `settlement_status`,
`settled_at`, `paid_at`) and `product_purchases` for products. **Never from events.**

### 8.3 Audience & Conversion — "who arrives, and where do they fall out?"

Requires the event store; ships in Phase 3. Tabs: Traffic · Funnel · Services · Devices.

- **Traffic:** visitors · unique visitors · new vs returning · a **sortable source
  table — visitors, service views, bookings, conversion %, revenue, revenue per
  visitor** (Gumroad's best artefact, extended with booking stages). Top referrer
  hosts. Campaign/UTM rows.
- **Funnel:** profile view → service view → booking started → slot selected →
  checkout started → paid, as **stored stage counters** (Shopify's model, not a
  derived chart), with step-wise drop-off, the named bottleneck, and the same funnel
  split by source and by device. Payment-failure rate sits here, from
  `payment_status` and the server `payment_failed` event — never from the browser alone.
- **Services:** per service — views, unique visitors, booking starts, paid bookings,
  conversion %, revenue, AOV, cancellation rate, repeat rate. Sortable comparison.
- **Devices:** mobile/desktop/tablet split and **conversion by device**. India is
  mobile-first; a desktop-only conversion collapse is a real, fixable bug.

Pre-ingest empty state: the page exists but says plainly that visitor data starts
accumulating from the day tracking goes live, and shows the first-party date it began.

### 8.4 Demand & Customers — "when am I wanted, and who keeps coming back?"

Tabs: Demand · Customers · Retention.

- **Demand:** published hours vs booked hours · utilisation % · day-of-week ×
  hour-of-day heatmap of demand · lead-time distribution · last-minute share ·
  cancellation rate · reschedule rate · no-show rate (`status='no_show'` exists).
  One recommendation: the window with the highest demand-to-availability ratio.
- **Customers:** total · new vs returning · repeat-booking rate · average spend ·
  lifetime value · top guests by LTV · acquisition source per guest (once attribution
  lands). Drill-down to a guest row that **shows only what the host already sees on
  `/dashboard/clients`** — no new exposure of guest data.
- **Retention:** monthly cohort table (first-booking month × months since), repeat
  purchase curve, time-between-bookings distribution, inactive list (feeds the
  Overview win-back block — same query, one definition).

Availability comes from `availability.weekly_schedule` / `blocked_dates` (JSONB), so
utilisation requires expanding that JSON per host per day. That is real work, and the
roadmap prices it honestly rather than implying it's a `COUNT(*)`.

---

## 9. Metric dictionary

The contract. A formula change is a versioned, announced change. Freshness classes:
**live** (computed per request from source tables) · **rolled** (from daily rollups,
≤1 h stale) · **estimate** (projection, labelled as such in the UI).

### 9.1 Money — all **live**, all from `bookings` (+ `product_purchases`)

| Metric | Meaning | Formula | Window / comparison | Edge cases |
|---|---|---|---|---|
| **Gross revenue** | What guests paid | `Σ customer_total` where `payment_status='paid'` | by `paid_at`; prev period | `customer_total` null on pre-v2.2 rows → fall back to `vendor_amount + commission_applied` (mirrors `insightsAdminController.bookingGrossValue`, so the two never diverge) |
| **Platform fee** | Our fee | `Σ platform_fee_amount` | same | — |
| **Platform fee GST** | GST on our fee | `Σ platform_fee_gst` | same | — |
| **Commission paid** | The 5% cut | `Σ commission_applied` | FY and all-time | Pro rows are 0 — correct, not missing |
| **Commission GST** | GST on commission | `Σ commission_gst` | same | — |
| **Gateway fee** | Razorpay's actual cut | `Σ razorpay_fee_actual` | same | Null until settlement reported → excluded and the tile says "settled only" |
| **Refunds** | Money returned | `Σ refunded_amount` | by `refunded_at` | A partial refund keeps `payment_status='paid'`; do not treat as unpaid |
| **Net revenue** | What the host keeps | `gross − platform_fee − platform_fee_gst − commission − commission_gst − gateway_fee − refunds` | same | Clamp ≥0. **This is the number that must match their bank** |
| **AOV** | Average booking value | `gross ÷ count(paid bookings)` | same | 0 bookings → null, render "—", never 0 |
| **Pending payout** | Earned, not yet landed | `Σ vendor_amount` where `settlement_status` not settled | as-of | — |
| **Paid out** | Landed | `Σ vendor_amount` where settled | by `settled_at` | — |
| **Revenue forecast** | Next 30 days | confirmed-unpaid upcoming + (trailing 90d daily booking rate × 30 × AOV) | forward | **estimate** — must render with its basis and band, never as a fact |
| **Pro payback date** | When Pro pays for itself | `₹1,179 ÷ (trailing 90d commission ÷ 90)` days from today | forward | Zero commission → no claim shown at all |

### 9.2 Conversion — **rolled** (event store), bookings leg **live**

| Metric | Formula | Required events | Edge cases |
|---|---|---|---|
| **Profile views** | `count(host_profile_viewed)` | `host_profile_viewed` | Excludes the host's own sessions. **Two counts must not coexist on two host surfaces** — that is the §4 anti-goal in miniature. The v3.205 `profiles.profile_views` counter (rendered today on `/dashboard` and feeding `ConversionFunnel`) stays as the server-side write path, but in Phase 4 the Dashboard tile and funnel are **repointed at this rollup** so there is one number. Until then the Intelligence tile is labelled "tracked views (from <date>)" and the Dashboard tile keeps its lifetime label |
| **Unique visitors** | `count(distinct visitor_id)` over the range | any event | **Not additive across days.** Recomputed from raw for the selected range; a sum of daily uniques is wrong and the dictionary says so |
| **Returning visitor** | visitor with ≥1 event in an earlier period | any | 400-day identifier lifetime; a cleared browser is a new visitor — a known, stated floor |
| **Service view rate** | `service_viewed uniques ÷ profile_viewed uniques` | both | Direct-to-service arrivals have no profile view → counted in the service leg only, denominator noted |
| **Profile→booking conversion** | `unique visitors with a paid booking ÷ unique profile visitors × 100` | profile view + `bookings` | Attribution window 30 days, stated. A booking from an untracked visitor counts in the numerator only if attribution resolved; otherwise it appears in Money, not here — and the gap is shown, not hidden |
| **Funnel step conversion** | `stage_n uniques ÷ stage_{n−1} uniques` | stage events | **Denominator is always the immediately preceding stage.** Frozen (this is Shopify's lesson) |
| **Booking abandonment** | `1 − (paid ÷ booking_started)` | `booking_started` + `bookings` | — |
| **Checkout abandonment** | `1 − (paid ÷ checkout_started)` | `checkout_started` + `bookings` | — |
| **Payment failure rate** | `payment_failed ÷ (payment_failed + paid)` | server `payment_failed` | Server-side only — a blocked browser must not be able to flatter this number |
| **Revenue per source** | `Σ net revenue of bookings attributed to source` | attribution row | Unattributed bookings go to an explicit `unknown` row, never silently dropped |
| **Revenue per visitor** | `revenue per source ÷ visitors from source` | both | <20 visitors → suppressed as noise |

### 9.3 Customers — **live**

| Metric | Formula | Edge cases |
|---|---|---|
| **Customer** | distinct guest identity with ≥1 paid booking | Identity = `guest_id` when present, else normalised `guest_email`, else normalised `guest_phone`. **Resolution order is fixed** so one guest is never counted twice |
| **New / returning** | first paid booking inside the range / earlier | — |
| **Repeat booking rate** | `paid bookings from returning customers ÷ all paid bookings × 100` | — |
| **LTV** | `Σ net revenue` per customer, all time | Not a prediction. It is realised value, and the UI must not call it "predicted" |
| **Time between bookings** | median gap between consecutive paid bookings | <2 bookings → excluded |
| **Inactive / at-risk** | ≥1 paid booking, none in 60 days | 60 days is the default and is configurable; the same query feeds Overview's win-back list |
| **Retention (cohort)** | `customers from cohort month M with a booking in month M+n ÷ cohort size × 100` | Cohorts <5 → shown with the count, not suppressed (it's the host's own data) |

### 9.4 Demand — **live**

| Metric | Formula | Edge cases |
|---|---|---|
| **Published hours** | Σ weekly schedule hours expanded over the range, minus `blocked_dates` | From `availability.weekly_schedule` JSONB; a host with no availability row → null, not 0 |
| **Booked hours** | `Σ (end_at − scheduled_at)` where status ∈ confirmed/completed | `end_at` null → fall back to `services.duration` |
| **Utilisation** | `booked ÷ published × 100` | Published 0 → null. **Never render >100%**; if it computes above 100 (manual bookings outside published hours) clamp and footnote |
| **Peak demand** | bookings bucketed by IST weekday × hour of `scheduled_at` | Always IST, stated on the chart |
| **Lead time** | median `scheduled_at − created_at` | — |
| **Last-minute share** | `bookings with lead time <24h ÷ all × 100` | — |
| **Cancellation rate** | `status='cancelled' ÷ all bookings in range` | By `created_at`, not `cancelled_at` — otherwise a cancellation lands in a different period from its booking and the rates don't tie |
| **Reschedule rate** | `bookings with reschedule_count>0 ÷ all` | — |
| **No-show rate** | `status='no_show' ÷ (completed + no_show)` | Denominator excludes cancelled — a cancellation is not a no-show |

### 9.5 Benchmarks — **rolled**, nightly, cross-host

| Metric | Formula | Edge cases |
|---|---|---|
| **Cohort** | hosts sharing a normalised `cohort_key`, with ≥1 paid booking in 90 days | **`profiles.profession` is free text** (`TEXT DEFAULT ''`, no CHECK), so raw values fragment — "Yoga teacher" vs "yoga instructor" would be two cohorts and k≥5 would stay unreachable even at 10× supply, killing the feature silently. So the job normalises: lowercase + trim → match against the existing profession-slug taxonomy in `client/src/config/professionIcons.js` (mirrored server-side as the single source) → unmatched falls back to `primary_category` → still unmatched is **excluded from benchmarks entirely** rather than pooled into a meaningless "other" cohort |
| **Price percentile** | host median service price vs cohort distribution | **k-anonymity: suppressed below 5 hosts.** At 8 profiles today, every cohort is suppressed — the UI must ship a real "not enough hosts yet" state, not a placeholder |
| **Conversion percentile** | host view→book vs cohort | same |
| **What leaves the server** | aggregates only — medians, percentiles, counts | Never another host's row, name, price or identifier. Matches the v3.186 anon-read lockdown posture |

---

## 10. Insight engine (AI Growth Intelligence)

Rules first, language second. Every recommendation is a row with six mandatory
fields, and **nothing renders if the evidence field is empty** — that is the
mechanism that stops generic advice:

| Field | Example |
|---|---|
| What happened | "3 guests worth ₹14,200 haven't booked in 60+ days" |
| Why it matters | "Returning guests are 40% of your paid bookings" |
| Evidence | the actual rows + the metric + its window |
| Do this | "Send a rebook nudge" → the existing notify rail |
| Likely impact | "At your repeat rate, ~1 rebooking ≈ ₹4,700" — labelled estimate |
| Measure it | "Rebookings from this list in 30 days" |

Delivery: in-app on Overview, and weekly by email through the **existing**
`weeklyHostRecap` service (`SCHEDULED_JOBS` → `weekly-recap`) — a new section in a
mail that already ships, not a new mail. An LLM may rephrase a rule's output; it may
never invent a number, and the numbers are computed before any text is generated.

v1 rules (each one a metric already in §9): commission above Pro price · at-risk
guests with LTV · a funnel step below cohort median · a demand window with no
published availability · a service with views but no bookings · rating trend down ·
no-show rate above cohort median. Anomaly detection and demand prediction need
history we don't have — roadmap Phase 7, explicitly.

---

## 11. Event tracking specification

### 11.1 What we do **not** add

Booking confirmation, cancellation, rescheduling, completion, no-show, review
submitted and repeat bookings are **state in Postgres already** (`bookings.status`,
`cancelled_at`, `reschedule_count`, `completed_at`, `reviews`). The brief lists them
as events; adding events for them would create a second, lossier copy of facts we
hold authoritatively. They are derived, not tracked.

### 11.2 Events reused as-is (already in `events.js`)

`host_profile_viewed` · `service_viewed` · `booking_started` ·
`booking_slot_picked` · `checkout_started` · `booking_created` · `booking_paid` ·
`payment_failed`. No renames — the catalog's whole purpose is that names never drift.

### 11.3 Events added (two)

| Event | Why it can't be derived |
|---|---|
| `profile_link_clicked` | Outbound clicks on a host's social/website/CTA links leave no server trace. Carries `link_type` (instagram/linkedin/youtube/website/whatsapp/cta) |
| `service_shared` | Share intent has no row anywhere. Carries `channel` |

**`booking_slot_picked` is declared in `events.js` and fired from nowhere** (verified:
the only match in `client/src` is the declaration itself). So the "slot selected"
stage would be permanently zero, and a zero stage breaks the frozen
each-step-over-the-previous-step denominator for every stage after it. **The stage is
dropped from the v1 funnel**: profile view → service view → booking started →
checkout started → paid. Wiring a call site in `ServiceBooking.jsx` is an
instrumentation change to the guest booking flow and does not belong in an analytics
PR; if it is wired later the stage can be added back, since the rollup is recomputed
from raw.

### 11.4 Event envelope

Every event carries: `event`, `host_id`, `visitor_id`, `session_id`, `service_id?`,
`occurred_at` (client clock, UTC), `source`, `medium`, `campaign`, `referrer_host`
(host only, never the full URL — paths carry PII), `device_type`, `route`,
`ingest_id` (UUID v4, per event, for dedupe).

**There is no `props jsonb` column.** On a 500 MB shared cap a free-form blob is the
fastest way to turn an analytics feature into a payments outage; the two new events'
only payloads (`link_type`, `channel`) go in narrow `varchar(32)` columns instead.
`route` is the matched **route pattern** (`/:username/:serviceSlug`), capped at 64
chars — not the full path, which is both larger and a PII risk.

- **`visitor_id`:** random UUID in `localStorage`, 400-day lifetime, first-party,
  per-origin. Not derived from IP, email, phone or any user attribute. Not shared
  across hosts' pages beyond our own origin.
- **`session_id`:** random UUID, 30-minute inactivity window.
- **Self-view exclusion:** if the logged-in user is the host being viewed, the client
  does not send, and the server drops it anyway. Both sides, because Beacons got this wrong.
- **Consent:** first-party, no third-party cookie, no cross-site identifier, no PII —
  so it sits with PostHog/Pixel in the always-on tier of the existing `consent.js`
  model. If a host or guest-facing consent decision later says otherwise, one flag
  turns the adapter off and the rollups simply have a gap, which the "as of" stamp shows.

### 11.5 Ingestion

- `POST /api/analytics/collect` — same origin as the app, so an ad-blocker's
  third-party list doesn't silently delete our financial funnel.
- **Batched**, up to 20 events per call, flushed on a 5 s timer and on `pagehide`
  via `navigator.sendBeacon`. Queue held in `localStorage` so a failed flush retries
  on the next page view.
- **Validation:** unknown `event` name → 202 and dropped (never 4xx — analytics must
  never surface an error to a guest mid-booking); unknown `host_id` → dropped;
  `occurred_at` more than 48 h from server time → clamped and flagged, because client
  clocks lie.
- **Dedupe:** unique index on `ingest_id`, `INSERT … ON CONFLICT DO NOTHING`.
- **Rate limit — its own bucket, mounted BEFORE `apiLimiter`.** The global
  `app.use('/api', apiLimiter)` is 100 req/min **per IP**, DB-backed. Guests behind
  carrier NAT share one bucket (the `adminLimiter` comment in `security.js` records
  this exact failure mode forcing a redesign), beacons flush every 5 s, and each
  limiter hit writes a `rate_limit_hits` row — i.e. the naive mount would both 429
  guests mid-booking and double the write load on the very table we're trying not to
  grow. So: `collect` mounts ahead of the global limiter with an **in-memory**
  per-`visitor_id` cap, writes no `rate_limit_hits` rows, and **over the cap it
  returns 202 and drops** rather than 429. Analytics never shows a guest an error.
- **Size guard (the free-tier safety property).** Before each insert batch the
  ingest checks a cached table-size reading (refreshed by the rollup job): over the
  configured byte budget it returns 202 and drops, and the founder is alerted once.
  Analytics degrades; bookings never do. There is also a kill flag —
  `feature_flags.analytics_ingest` — that stops ingest within the 60 s flag cache.
- **Environment isolation.** `analyticsEnabled()` restricts the whole bus to
  `meeticulous.com`/`www.meeticulous.com` for a documented reason (localhost and
  Vercel previews once polluted the single prod PostHog project). The `firstParty`
  adapter **inherits that gate**, and the server independently drops any event whose
  `Origin` is not the prod host. So dev and preview traffic can never appear in a
  real host's paid dashboard, and no `env` column is needed. The cost is that the
  ingest path is exercised off-prod only against a local server + local Postgres
  with `VITE_ANALYTICS_DEBUG=true` (§15), and that Phase 4's "≥14 days of events"
  clock starts at the prod deploy, not at merge. Both are stated in the roadmap.
- **The IP is used to rate-limit and then discarded.** It is never stored. (§6.5 is
  the cost of that choice and it's the right trade.)
- **Server-side money events keep going through `trackServer`** and additionally
  write their own row, so payment reporting survives any browser.

### 11.6 Client wiring

One new adapter, `client/src/services/analytics/adapters/firstParty.js`, added to
`ADAPTERS`. Zero call-site changes: every existing `analytics.track()` call starts
feeding our store the day the adapter lands. That is the entire reason the bus was
built this way, and it is why this design needs no instrumentation sweep.

---

## 12. Database and API architecture

### 12.1 Data flow

```
guest browser ──► analytics bus ──► firstParty adapter ──┐
                     │                                    ├─► POST /analytics/collect ─► analytics_events
                     └─► posthog / ga4 / pixel (unchanged) │
server (booking, payment) ──► trackServer (unchanged) ─────┘

analytics_events ──► rollup job (hourly, runIfDue) ──► analytics_daily, analytics_daily_dim
                                                   └─► benchmark_daily (cross-host, k≥5)

GET /host/intelligence/* ──► rollups (traffic/funnel) + bookings LIVE (money) ──► host dashboard
                             └─ isFreeSlug ? headline-only + locked:true : full payload
```

### 12.2 Schema (one migration, additive, nothing altered)

`v3.207_creator_intelligence.sql`:

- **`analytics_events`** — `id bigserial pk`, `host_id uuid not null references
  profiles`, `visitor_id text not null`, `session_id text`, `event text not null`,
  `service_id uuid`, `occurred_at timestamptz not null`, `received_at timestamptz
  default now()`, `source text`, `medium text`, `campaign text`, `referrer_host
  varchar(253)`, `device_type varchar(16)`, `route varchar(64)`, `link_type
  varchar(32)`, `channel varchar(32)`, `ingest_id text`. **No `props jsonb`** (§11.4).
  Indexes: `unique (ingest_id)`, `(host_id, occurred_at desc)`,
  `(host_id, event, occurred_at desc)` — three, not more; each costs ~50 bytes/row
  against a 500 MB cap. RLS on, no policies (service-role only), per the
  v3.186/v3.206 lockdown posture.
  *Not partitioned* — on a 500 MB cap, pruning is what matters, not partitioning.
- **`analytics_daily`** — `(host_id, day)` pk + funnel counters: `profile_views`,
  `unique_visitors`, `new_visitors`, `service_views`, `booking_starts`,
  `slot_picks`, `checkout_starts`, `link_clicks`. The per-host per-day funnel.
- **`analytics_daily_dim`** — `(host_id, day, dim_type, dim_value)` pk where
  `dim_type ∈ ('source','medium','campaign','device','service','referrer')`, plus
  `visitors`, `service_views`, `booking_starts`. **One table for every breakdown**
  instead of six near-identical ones.
- **`booking_attribution`** — `booking_id uuid pk references bookings`, `visitor_id`,
  `first_source/medium/campaign`, `last_source/medium/campaign`, `first_seen_at`,
  `resolved_at`, `confidence varchar(8)`. A separate table precisely because
  `bookings.source` already means something else (`'platform'` vs manual CRM entry).
  **Resolved asynchronously by the rollup job, not on the money path.** The server
  never receives a `visitor_id` today — the only precedent is the optional
  `req.body.ga_client_id` read in three places in `paymentController.js`, and
  changing a payment payload for an analytics feature is the wrong trade and would
  break the "zero call-site changes" property. Instead the job matches a paid booking
  to the nearest preceding `checkout_started` / `booking_started` event for the same
  `host_id` + `service_id` inside a 2-hour window: exactly one candidate →
  `confidence='high'`; several → `'low'`; none → **no row**, and the booking shows in
  the `unknown` attribution bucket. Looser than a payload hand-off, honest about it,
  and it touches nothing that takes money.
- **`benchmark_daily`** — `(cohort_key, day)` pk, `host_count`, `median_price`,
  `median_conversion`, `median_aov`, `median_no_show`. Written only when
  `host_count >= 5`. No host identifiers, ever.
- **`profiles`** gains `intel_revenue_target numeric` (the Goals strip). One column,
  not a table — there is one target.

Revenue is **not** stored in any rollup. It is always read live from `bookings`, so
it cannot drift from the host's payout.

### 12.3 API

All under `requireHost`, all plan-resolved server-side:

| Endpoint | Returns | Freshness |
|---|---|---|
| `POST /api/analytics/collect` | 202 always | — |
| `GET /host/intelligence/overview` | leak+forecast, win-back, benchmark, moves, tiles, trend, goal | money live, rest rolled |
| `GET /host/intelligence/money` | `?tab=overview\|breakdown\|forecast\|transactions` | live |
| `GET /host/intelligence/audience` | traffic, funnel, services, devices | rolled |
| `GET /host/intelligence/demand` | demand, customers, retention | live |
| `GET /host/intelligence/export` | CSV of the current view | live |

Every response carries `{ asOf, freshness, locked, range, compare }`. The `asOf`
drives the stamp; `freshness` drives per-tile "estimate" labels. Tenant isolation is
`host_id = req.user.id` in every query, with a test that fails if any Intelligence
query lacks it.

### 12.4 Jobs, cache, retention

- **`intel-rollup`** — one entry in `SCHEDULED_JOBS`, `min: 60`,
  `retryOnError: true` (idempotent: it recomputes whole days by upsert).
  Recomputes today + yesterday every run; older days only on backfill.
- **`intel-benchmarks`** — `min: 24*60`, writes `benchmark_daily` for cohorts ≥5,
  after normalising each host's `profession` to a `cohort_key` (§9.5).
- **`intel-prune`** — **Phase 2, not Phase 8.** Deletes raw events older than the
  retention window and refreshes the cached table-size reading the ingest size guard
  reads. On the free tier this job is a safety device, not housekeeping.
- **Cache:** none. There is **no in-process cache in this codebase** — `httpCache.js`
  only sets `Cache-Control` and is documented for public, anonymous payloads, which a
  per-host paid dashboard is not. The pages are rollup-backed, so they are already
  one indexed read; if a real p95 problem shows up, that is when a cache gets
  designed, with a measurement behind it.
- **Retention: raw events 30 days** (not 400 — see §5; 400 days of raw events does
  not fit in a 500 MB cap shared with the booking tables). **Rollups are the
  history** and are kept indefinitely: `analytics_daily` is one row per host per day
  and `analytics_daily_dim` a handful more, so a year of 500 hosts is single-digit MB.
  Raw events exist only to be rolled up and to allow a 30-day recompute. Stated in
  the privacy copy, which is a genuine privacy *improvement* over a 400-day window.
  Longer raw retention is available for the price of a Supabase paid tier, and that
  is a founder decision (§17), not a code change.
- **Schema fallback:** every read destructures defensively and degrades to "no data
  yet" if a table or column is missing, matching the `inAppNotify`/`escalationService`
  pattern — so code is safe to deploy before the migration is applied anywhere.

---

## 13. UX

Loop & Slot throughout: tokens only, `rounded-full` buttons/tags, `rounded-xl`/`2xl`
cards, `rounded-3xl` dialogs, Bricolage display / Poppins sans / one Instrument Serif
line per page. Reference feel: Linear's density, Stripe's honesty about fees.

**There is no charting library in `client/package.json`** — no recharts, chart.js,
d3, visx or victory, and that is a deliberate bundle decision this design does not
reopen. Every chart is hand-rolled SVG. The precedent is `chartGeometry.js` +
`EarningsTrendChart.jsx`, and the primitives (`Tile`, `Sparkline`, `RankedBars`,
`Funnel`, `BarChart`) exist in `client/src/pages/hostlab/labUi.jsx` — **which lives
only on the unmerged `feat/host-lab-prototype` branch** (§17.2). New shapes needed
beyond those: line chart, horizontal waterfall, heatmap, cohort table. Four SVG
components, no dependency added.

Chart types, one purpose each (brief rule 14):

| Need | Chart | Why not something else |
|---|---|---|
| Revenue / bookings over time | line | — |
| Gross → net | horizontal waterfall | the only shape that shows subtraction honestly |
| Service / source comparison | ranked horizontal bars | `RankedBars` exists |
| Funnel | stacked funnel with per-step % | `Funnel` exists |
| Demand | weekday × hour heatmap | the only readable 2-D shape here |
| Retention | cohort table, shaded | a chart would hide the counts |
| Transactions | table + filters | — |
| Goal | progress bar | — |
| Tile trend | sparkline | `Sparkline` exists |

Dropped from the brief as decoration: pie charts of revenue composition (the
waterfall is strictly better), the geographic map (§6.5), and "visitors vs bookings"
as a separate chart (it is the funnel).

States, written per page: **loading** (skeletons matching final layout, no spinners),
**error** (what failed, what still works, retry), **empty** (specific — "no bookings
yet" ≠ "no visitor data yet" ≠ "not enough hosts for a benchmark"), **locked**
(blur + real headline + `?src=`).

Accessibility: no colour-only encoding (shape or label alongside), WCAG AA contrast
on all tokens used, every chart has a table equivalent reachable via the CSV export,
tooltips keyboard-reachable.

Mobile: single column, tiles 2-up, tables become stacked cards, heatmap scrolls
horizontally with sticky day labels. The host console already has a mobile shell
(`mobile-app-shell`) — Intelligence uses it, it does not invent one.

---

## 14. Roadmap

Each phase is independently shippable and independently useful.

| Phase | Scope | Depends on | Acceptance |
|---|---|---|---|
| **1. Prototype** | Clickable 4-page prototype in `/host-lab`, realistic fictional data, working nav/range/compare/tabs/filters/drill-downs | this doc approved | Every page, tab, filter and locked state navigable; founder sign-off before any production code |
| **2. Foundation** | `v3.207` migration · `firstParty` adapter · collect endpoint · `intel-rollup` **and `intel-prune`** jobs · size guard + `analytics_ingest` kill flag · 2 new events · **local Postgres for tests** (§15) | 1 | Events land; dedupe proven by replay **against a real Postgres, not a mock**; rollups match a hand-written SQL count; prune deletes; size guard trips at a lowered test budget; zero change to existing adapters (test asserts it) |
| **3. Money (free) + Overview (gated)** | Money page live off `bookings`, **ungated** per §6.4; Overview with commission leak (free) + forecast/win-back/goal strip (Pro) | 2 (not for Money — it needs no events) | Net revenue ties to a hand-reconciled payout for a real host; a free host's API response provably contains none of the six gated figures; `limits.insights` read from `subscription_plans`, nothing hardcoded |
| **4. Audience & Conversion** | Traffic, funnel (4 stages — no slot step, §11.3), services, devices; async attribution resolver; repoint the Dashboard view tile at the rollup (§9.2) | 3 + **≥14 days of events counted from the prod deploy**, since the bus is prod-host-gated | Funnel denominators match the dictionary; `unknown` attribution bucket visible, never dropped; one profile-view number across both surfaces |
| **5. Demand & Customers** | Utilisation, heatmap, lead time, LTV, cohorts, retention | 3 | Utilisation never >100%; one guest never double-counted across identity fallbacks |
| **6. Benchmarks + insight engine** | `benchmark_daily`, `cohort_key` normaliser, k≥5 suppression, 7 v1 rules, in-app Overview delivery (+ weekly-recap section **only if §17.3 says so**) | 3–5 | No host's row ever leaves the server (test); a rule with empty evidence renders nothing (test); an unmatched profession is excluded, not pooled |
| **7. Forecast + anomaly** | Projections, demand prediction, anomaly detection | ≥90 days of history | Every estimate visibly labelled with its basis; no estimate rendered without one |
| **8. Hardening** | Partitioning if triggered, retention job, perf budget, export limits, privacy copy | all | p95 <800 ms on every endpoint at 10× current data; retention job proven to delete |

**Ship independently:** Money (Phase 3) needs no event store at all and is the single
most valuable page — a host can reconcile their earnings on day one. Benchmarks can
ship dark until supply clears k=5.

**Risks:**

- **Not enough hosts.** 8 profiles. Benchmarks are suppressed and win-back lists are
  thin until supply arrives. Mitigation: Money + commission leak carry Phase 3 alone;
  both work at n=1.
- **No trend history on day one.** The 72 existing profile views are unrecoverable.
  Mitigation: say so in the UI; don't draw a line from nothing.
- **Attribution gaps.** Blocked scripts and cleared storage mean some paid bookings
  have no source. Mitigation: an explicit `unknown` row, and money reporting that
  never depends on attribution.
- **Shared checkout churn.** Other sessions commit here concurrently. Mitigation:
  this worktree, additive files, one PR.
- **Scope.** This is 8 phases. Mitigation: phases 1–3 are the Pro magnet; 4–8 are
  upside, and each is a separate PR.

## 15. Testing

- **A real Postgres is a Phase 2 prerequisite.** Server tests mock Supabase wholesale
  (`jest.mock('../../config/supabase', …makeSbMock())`), there is no local database in
  the repo, the only reachable DB is **production**, and there is a standing rule
  against running a local server against it (local boot fires customer-facing crons —
  `no-local-server-against-live-db`). A mock cannot prove a unique index, an
  `ON CONFLICT DO NOTHING`, an upsert or a prune. So Phase 2 adds a throwaway
  `docker compose` Postgres used by the ingest/rollup/prune tests only — not a dev
  stack, not wired to the app, no Supabase branch (the org is on the free tier).
  Without it, the ingest path ships unexercised, which for a write path on a 500 MB
  shared database is not acceptable.
- **Migration ownership:** `v3.207` is applied by the founder, by hand, on merge, per
  the project's migration workflow. The schema fallback (§12.4) means code is safe to
  deploy before it lands.
- **Unit:** every dictionary formula gets a test with a fixture covering its stated
  edge case (null `customer_total`, 0 bookings, >100% utilisation, duplicate guest
  identity, cohort <5, non-additive uniques).
- **Isolation:** a test that fails if any Intelligence query is missing a `host_id`
  predicate; a test that a free-plan response contains no real figures.
- **Ingest:** replay the same batch twice → one row. Unknown event → 202, no row.
  Clock skew >48 h → clamped.
- **Benchmarks:** a cohort of 4 produces no row; output contains no host identifier.
- **Regression:** existing adapters and `trackServer` behaviour unchanged (the whole
  point of adding, not editing).
- **Pre-push:** `.githooks/pre-push` runs the CI suite locally (`pre-push-ci-gate`).

## 16. Left to the builder

Tile copy and microcopy · exact skeleton shapes · CSV column order ·
heatmap colour steps within the token set · rollup batch size · whether Transactions
paginates or infinite-scrolls. None of these change what gets built.

---

## 17. Open decisions — founder only

A builder review ran against this document and the codebase. Seven of its findings
are settled above as engineering calls (slot-stage drop, async attribution, no
`props` column, 30-day retention + prune + size guard, own rate-limit bucket, prod-gate
inheritance, `cohort_key` normaliser, one profile-view number, no cache, docker
Postgres for tests). Three need the founder, and one is a notice.

### 17.1 Money's gate — the published promise

`PLAN_MATRIX` tells the world free hosts get "Earnings & transaction history ✓" and
"Commission tracker ✓", and `/dashboard/earnings` is ungated today. §6.4 therefore
keeps **Money free** and gates only the six things promised to nobody (forecast,
win-back, benchmarks, Audience & Conversion, cohorts/LTV, weekly moves).
**Needed:** agreement, plus a `limits.insights` key added to the `subscription_plans`
rows — a live-DB plan-row edit, which is founder territory. The alternative (gate
Money too) means changing a published promise and is not recommended.

### 17.2 Does Intelligence live inside Host Lab?

Every primitive §13 builds on (`labUi.jsx`, `useUrlTab`, `nav.js`, `pageMap.js`,
`sections/`) exists **only on `feat/host-lab-prototype`** — unmerged, two commits
ahead of `origin/main`, and being actively committed to by another session.
Either: (a) Intelligence is Host Lab's fifth section, so this work depends on that
branch merging and the prototype is built on top of it; or (b) Intelligence is four
standalone pages on the current live dashboard, which means duplicating those
primitives into production. **(a) is cheaper if Host Lab is the agreed direction;
(b) is the only option if it isn't.** This decides the PR base, Phase 1's shape and
which nav Phase 3 ships into.

### 17.3 The weekly email

§10 planned to deliver insights through `weeklyHostRecap`. It is **off in production**
(`WEEKLY_RECAP_ENABLED !== 'true'` → `{skipped:'disabled'}`) and `worthSending()`
deliberately skips any host with no bookings and nothing upcoming — "silence beats a
₹0 email" — which is precisely the dormant free host the win-back and commission
rules target. So either flip the env var **and** change `worthSending()` (a behaviour
change to a live retention mail), or keep insights in-app only for now.
**Recommended:** in-app only in Phase 6; revisit the mail once there are hosts to
mail. Phase 6 is scoped that way above.

### 17.4 Notice — a pre-existing honesty bug

`ConversionFunnel.jsx:29` shows free hosts **fabricated** numbers behind the blur
(248 views / 37 bookings / 15%). That contradicts the honesty rule in the parent
free→Pro design. `ProTeaser.jsx` already exists as its documented canonical
replacement. Intelligence uses `ProTeaser`; fixing `ConversionFunnel` is a separate,
small PR and is **not** in this scope.

### 17.5 Optional — Supabase tier

Everything above fits the free tier (500 MB) with 30-day raw retention. A paid tier
(8 GB) would buy longer raw history and remove the size guard as a live concern. Not
required for any phase; purely a cost call, and the design works either way.
