# Pro Insights Suite — host intelligence that sells Pro

_Spec'd 2026-11-16. A set of Pro-gated, host-facing analytics + action tools. The point is
NOT vanity stats ("who viewed") — it's insight that touches **money** and tells the host
what to **do**. Free hosts see each insight blurred with the headline number teased;
Pro unlocks it. Engine: Free = 5% commission, Pro = ₹999/yr + 0% commission, so every
insight is anchored against the commission the host is already paying._

## Why this (context)
- Shipped already: commission meter, free→Pro nudges, views→book funnel, plan comparison,
  profile views. Those are the hooks. This suite is the **magnet** — rich enough that a
  free host upgrades to get it.
- Everything below is buildable on data we ALREADY have: `bookings` (+ pricing snapshot:
  `commission_applied`, `customer_total`, `vendor_amount`, `scheduled_at`, `status`,
  `settlement_status`), `reviews`, `profiles`, `services`, `contacts`/leads, `host_testimonials`,
  `profile_views` (v3.205), analytics events (PostHog), coupons.
- No-wallet rule still applies: no guest card-on-file, no deposits, no recurring guest billing.

## Gating model (how it sells)
- **Free:** the suite renders **blurred** behind the existing lock-overlay pattern
  (`ConversionFunnel.jsx` / `Products.jsx` / `ClientsList.jsx`), with the real headline number
  teased ("You could win back **₹——**") → `/dashboard/upgrade?src=insights`.
- **Pro:** unlocks the numbers + the actions. Server-enforce with `planService.isFreeSlug`.
- Lives as a new flat host page `client/src/pages/Insights.jsx` + a Catalog/Earnings nav entry.

---

## The features (grouped, most-convert first)

### 💰 Money intelligence — strongest sellers
1. **Revenue dashboard** — earnings over time, by service, average booking value (AOV),
   this-month vs last. _Data: `bookings` + pricing snapshot, grouped by `service_id` / month._
2. **Commission leak + projection** (extends the meter) — "You've paid ₹X in 5%. At your
   pace that's ₹Y this year. Pro = ₹0." A **running forecast**, not a static number.
   _The single highest-converting line._ _Data: sum `commission_applied` + run-rate._
3. **Earnings forecast** — projected next-30-days income from confirmed bookings + typical
   booking rate. Turns Pro into "pays for itself." _Data: upcoming confirmed + trailing avg._
4. **Payout timeline** — what's clearing and when it lands. _Data: `settlement_status` / payout rows._

### 👥 Client intelligence — actionable = upgrade
5. **Lifetime value + top clients** — who's spent most, repeat vs new split.
   _Data: `bookings` grouped by guest/`contact_id`._
6. **At-risk / win-back list** ⭐ — "5 guests worth ₹X haven't booked in 60 days," one click →
   rebook nudge. **Killer feature**: it makes the host money, so ₹999 is obvious.
   _Data: last booking per guest + LTV; reuse the rebook/notify rail._
7. **Repeat-rate %** — "40% of your bookings are repeat guests," benchmarked.

### 📈 Conversion & demand
8. **Funnel by source** (extends shipped funnel) — views→bookings split by share link /
   referrer / UTM ("Instagram converts 3×; email doesn't"). _Data: analytics events + bookings._
9. **Demand heatmap** — busiest days/times + empty slots → feeds a suggestion ("open more
   6–8pm slots, they fill fastest"). _Data: `scheduled_at` histogram vs availability._
10. **Lead-time + no-show insight** — how far ahead guests book, no-show rate + which guests.
    _Data: `scheduled_at` vs created_at, `status='no_show'`._

### 🏆 Benchmarks — pure FOMO, very high convert
11. **Peer benchmarks (anonymized)** ⭐ — "You're priced 20% below similar coaches," "Your
    view→book is below the median." Nothing drives "am I leaving money behind?" harder.
    _Data: aggregate across hosts in the same profession, served anonymized + k-anonymity
    (min N hosts per cohort). Server-computed, never expose another host's raw data._
12. **Reputation trend** — rating over time, review response rate, which services earn 5★.
    _Data: `reviews` (guest_to_host) over time._

### 🤖 Growth recommendations — the glue
13. **Weekly "3 moves to earn more"** ⭐ — AI turns the above into actions: "Add a ₹1,999
    service," "Win back these 3 guests," "Your Fri evenings are empty." In-app + email.
    Makes the suite feel like a coach, not a report — the reason they keep paying.
    _Data: rules over the metrics above; optional LLM phrasing._

---

## Build order (highest convert, all on existing data)
Ship these three FIRST — they create the "I'm losing money by staying free" moment better
than ten charts:
1. **#6 Win-back list** (at-risk guests + one-click rebook) — actionable, makes money.
2. **#2 Commission leak + projection** (running forecast off the existing meter).
3. **#11 Peer benchmark** (anonymized, k-anonymity guarded).

Then #1 revenue dashboard, #8 funnel-by-source, #13 weekly growth moves; the rest as polish.

## Build notes / guardrails
- **Pro-gate server-side** (`isFreeSlug`), not just the client blur — never ship a free host
  the real numbers in the API payload.
- **Benchmarks:** k-anonymity (suppress a cohort with < ~5 hosts); only aggregates leave the
  server; matches the v3.186 anon-read lockdown posture.
- **Performance:** these are read-heavy aggregates — cache per host (short TTL) or precompute
  nightly; don't run heavy group-bys on every dashboard load.
- **No new money movement** — this is read-only analytics + the existing rebook/notify rail.
  No wallet, no card-on-file (see `no-wallet-no-card-vault` memory).
- A migration is likely only for precomputed aggregates/caching, not for the data itself.

## Roadmap placement
Replaces the weak "who-viewed" fortnight. Spans ~2–3 fortnights (money + clients first, then
demand/benchmarks, then the weekly growth engine). See `docs/research/roadmap-year-2f2i.md`
and the fortnightly plan for sequencing.
