# GMV + Activation North-Star — Canonical Specification

_Date: 2026-07-01 · Q1 "Prove value" item #7 (GMV & activation instrumentation)_

> **Status: canonical metric definition.** This document is the single source of truth for
> how GMV and host activation are computed. Any change to a formula, window, exclusion, or
> denominator below is a change to what the numbers *mean* and must be made here first. Do
> not infer intent from the implementation — the implementation follows this document.

## Problem

The Q1 roadmap names "GMV & activation instrumentation" as **foundational — enables all
revenue decisions**. Today the platform has:

- `insightsAdminController.getKpis` + `AdminInsights.jsx` — surfaces platform **revenue**
  (`platform_fee_amount + commission_applied`, bookings only), booking counts, booking→paid
  conversion, host growth, guest count. Postgres-truth, gated by
  `requireAdmin('analytics.view')`.
- PostHog / GA4 / Pixel / Clarity wired but prod keys unset (separate founder action).

**Gap:** no **GMV** (gross value transacted to hosts) and no **activation** metric (host
reaching first paid booking). Revenue ≠ GMV — revenue is the platform's take; GMV is the
total marketplace volume the take is a fraction of.

## Decision summary (locked with founder 2026-07-01)

- **GMV = paid service bookings (gross service value) + paid digital-product sales.** Excludes
  platform subscription revenue (the platform's own SaaS income, not marketplace GMV).
- **Activation = host with ≥1 _money-moving_ paid booking.** Report count, rate, momentum,
  and time-to-first.
- **Placement = extend the existing `AdminInsights` surface.** No new page/route/nav item.

## Approach

Extend `insightsAdminController.getKpis` (server) and `AdminInsights.jsx` (client). Reuse the
existing single-scan + schema-fallback pattern. No new route, controller, permission, nav
item, or migration. Postgres-truth; independent of external analytics keys.

---

## Canonical definitions

All money is **Indian Rupees (INR)**, stored as `numeric` **major units (₹, not paise)**.
All timestamps are `timestamptz` compared in **UTC**. "Now" = server `Date.now()` (UTC epoch
ms). These are authoritative for every metric below.

### D1. "Paid transaction"

- A **booking** is paid ⟺ `payment_status = 'paid'`. The `payment_status` enum is
  `('unpaid','paid','refunded')`. A refund sets `payment_status = 'refunded'`, which is **not**
  `'paid'` and is therefore automatically excluded from GMV, revenue, and activation — GMV
  self-corrects on refund with no extra logic. (No automated refund system exists yet — P3
  ledger not built — but a manual status change is honoured.)
- A booking's `status` (`pending`/`confirmed`/`cancelled`/`completed`/`no_show`) is
  **independent** of `payment_status`. GMV and activation key **only** on `payment_status`.
  A paid booking that was later `cancelled` or marked `no_show` (v3.45) **still counts** while
  `payment_status = 'paid'`, because the money was captured and not refunded. This is
  intentional and matches the existing revenue tile.
- A **product purchase** is paid ⟺ `payment_status = 'paid'` (same enum semantics).

### D2. `grossValue(booking)` — the single reused per-booking value

Bookings have **no raw service-price column**; gross service price is reconstructed. This one
helper is used by **both** GMV and activation so they can never diverge:

```
grossValue(booking):
    if booking.customer_total IS NOT NULL:
        v = customer_total
          − COALESCE(platform_fee_amount, 0)
          − COALESCE(platform_fee_gst,    0)
    else:                                  # pre-v2.2 row: customer_total column NULL
        v = COALESCE(vendor_amount, 0) + COALESCE(commission_applied, 0)   # degraded estimate
    return MAX(0, round2(v))               # clamp negatives to 0
```

- Rationale for the primary branch: money model v2.2 defines
  `customer_total = service_price + platform_fee + platform_fee_gst`. Subtracting fee + its
  GST yields the gross service price = the value the host transacted. GST and platform fee are
  **excluded** from GMV (GST is a pass-through liability; the fee is the platform's cut).
- **Free bookings** (`service.price = 0`): `calculatePlatformFee` returns 0, so
  `customer_total = 0` and `grossValue = 0`. They contribute nothing to GMV (correct) and are
  **excluded from activation** by the `grossValue > 0` test in D5 (a free session moved no
  money — activation means *money recovered*).
- **NULL handling:** the `else` branch covers pre-v2.2 paid rows whose `customer_total` column
  is NULL even though the column now exists (v2.2 did not backfill it). This is a **per-row**
  fallback, distinct from the **per-column** schema fallback in D8. Both are required.

### D3. `grossValue(product)` — per-purchase value

```
grossValue(product_purchase) = MAX(0, round2(COALESCE(amount_paid, 0)))
```

- `amount_paid` is the product price paid to the host; `platform_fee` is stored separately and
  **excluded** from GMV (consistent with bookings). Free products (`amount_paid = 0`)
  contribute 0.

### D4. GMV

```
gmv.bookings = Σ grossValue(b) for b in bookings where payment_status = 'paid'
gmv.products = Σ grossValue(p) for p in product_purchases where payment_status = 'paid'
gmv.total    = round2(gmv.bookings + gmv.products)
```

Reported windows (see D7): `total`, `last30`, `prev30`. Each is computed on the same paid set,
filtered by the transaction's `created_at` window.

### D5. Activation (host first money-moving booking)

- **Activated host** = a distinct `host_id` that appears on **≥1 booking** with
  `payment_status = 'paid'` **and** `grossValue(booking) > 0`. Free-only hosts are **not**
  activated. Bookings with a NULL `host_id` are skipped (host_id is always present in practice;
  this is defensive).
- **Product purchases do NOT count toward activation.** Activation is defined on bookings only,
  per the founder decision ("host first paid *booking*"). Do not add product buyers here.
- Reported fields:
  - `activatedCount` — distinct activated hosts.
  - `totalHosts` — count of all `profiles` with `role = 'host'` (see D6 for denominator scope).
  - `activationRate` — `activatedCount / totalHosts × 100`, one decimal, `0` when
    `totalHosts = 0`.
  - `new30` — activated hosts whose **first** money-moving paid booking (earliest such
    `created_at`) falls in the last-30-day window (D7). Activation momentum.
  - `medianTimeToFirstBookingDays` — see D6.

### D6. Median time-to-first-booking & denominator scope

- For each activated host, `ttfb = firstPaidBooking.created_at − host.created_at`, in **days**
  (ms ÷ 86 400 000). `firstPaidBooking` = earliest-`created_at` booking that satisfies D5
  (`paid` ∧ `grossValue > 0`). **Clamp negatives to 0** (a booking timestamp preceding the host
  row is a data anomaly, e.g. imported/backfilled rows).
- `medianTimeToFirstBookingDays` = median of the `ttfb` list, rounded to one decimal:
  odd count → middle value; even count → mean of the two middle values; **`null`** when there
  are zero activated hosts.
- **Denominator scope (`totalHosts`):** intentionally **all** `role = 'host'` profiles, with
  **no** filter on onboarding completion, active status, or soft-deletion. This is the broadest
  base — activation rate answers "of everyone who signed up as a host, what fraction ever earned
  money." A future "activated / onboarded" variant is a deliberate follow-up, not this metric.

### D7. Time windows

- Windows are **rolling UTC intervals**, not IST calendar months:
  - `last30`  = transaction `created_at ≥ now − 30 days`.
  - `prev30`  = `now − 60 days ≤ created_at < now − 30 days` (half-open; the `< now − 30 days`
    upper bound prevents double-counting a row in both windows).
  - `total`   = all paid rows, unbounded.
- Windows key on **`created_at`** (booking/purchase creation), **not** `paid_at` (payment
  capture), for consistency with the existing revenue tile. Consequence: a booking created in
  the prior window but paid in the current one is attributed to the prior window. Payment-capture
  (`paid_at`)-based recognition is a documented future refinement, not built here.

### D8. Platform revenue & take-rate (GMV-consistent)

The existing `revenue` KPI (bookings-only `platform_fee_amount + commission_applied`) is
**left unchanged**. For a take-rate whose numerator and denominator share the same base, a
separate figure is computed:

```
gmv.platformRevenue = Σ (COALESCE(platform_fee_amount,0) + COALESCE(commission_applied,0))
                          for paid bookings
                    + Σ COALESCE(platform_fee, 0) for paid product_purchases
gmv.takeRate = (gmv.total > 0) ? round1(gmv.platformRevenue / gmv.total × 100) : 0   # %
```

- GST (platform-fee GST and commission GST) is **excluded** from `platformRevenue` — it is a
  pass-through liability, not platform income (matches `bookingRevenue` in the existing
  controller).
- **Documented relationship:** `gmv.platformRevenue ≥ revenue.total`, because it additionally
  includes product `platform_fee`. The two figures are intentionally different; the `revenue`
  tile stays bookings-only for backward compatibility, while take-rate uses the product-inclusive
  figure so it is not understated.

---

## Business rules & exclusions (authoritative list)

1. Only `payment_status = 'paid'` rows count (D1). `unpaid` and `refunded` are excluded.
2. Booking `status` (cancelled / no_show / completed / pending / confirmed) does **not** affect
   inclusion — only `payment_status` does (D1).
3. Free (₹0) bookings and free products count as GMV 0 and do **not** activate a host (D2, D5).
4. Subscription/plan revenue is **excluded** from GMV (it is platform SaaS income) (Decision).
5. Products are excluded from **activation**; included in **GMV** (D4, D5).
6. GST (platform-fee GST, commission GST) is excluded from GMV and from `platformRevenue`
   (D2, D8).
7. Razorpay gateway fees are neither added to nor subtracted from GMV (GMV is gross service/
   product price, pre-any-fee).
8. **No test/synthetic-transaction exclusion exists.** Bookings and `product_purchases` have no
   `is_test` flag, so admin-created, Supreme-plan (0-commission), and any manually-seeded paid
   rows are all included. Known limitation; revisit if a test flag is added.
9. Refunds reduce GMV only insofar as they set `payment_status = 'refunded'` (D1); there is no
   partial-refund or negative-adjustment concept in this metric.

## Edge cases & handling

| Case | Handling |
|---|---|
| `customer_total` NULL (pre-v2.2 paid row) | Per-row fallback to `vendor_amount + commission_applied` (D2 else-branch). |
| `platform_fee_amount` / `platform_fee_gst` NULL on a row | `COALESCE(…, 0)` inside `grossValue` (D2). |
| Reconstructed `grossValue` negative (bad data) | Clamped to 0 (D2, D3). |
| `customer_total` column entirely absent (pre-v2.2 DB) | Per-**column** schema fallback: select the reduced column set, every row takes the D2 else-branch. Distinct from the per-row NULL case. |
| `amount_paid` column absent on `product_purchases` | Product scan schema-fallback → product GMV contributes 0; bookings GMV unaffected. |
| `product_purchases` table/scan errors | Product GMV = 0; endpoint still returns booking GMV + activation (degrade, don't fail). |
| Empty DB (no hosts, no bookings) | `gmv.*` = 0; `activationRate` = 0; `medianTimeToFirstBookingDays` = `null`; `takeRate` = 0. No divide-by-zero. |
| `totalHosts` = 0 | `activationRate` = 0 (guarded). |
| Zero activated hosts | `medianTimeToFirstBookingDays` = `null`, `new30` = 0. |
| Booking `created_at` < host `created_at` | `ttfb` clamped to 0 (D6). |
| Booking with NULL `host_id` | Skipped from activation (D5). |
| Rounding | Money rounded to 2 decimals (`round2`); rates/percentages to 1 decimal (`round1`). |

## Assumptions & future refinements (explicit)

- **A1.** `customer_total = service_price + platform_fee + platform_fee_gst` (money model v2.2)
  holds for all rows with a non-NULL `customer_total`. If the money model changes, D2's primary
  branch must change with it.
- **A2.** `amount_paid` on `product_purchases` is the host-facing product price, exclusive of
  `platform_fee`. If product pricing gains its own GST/fee split, D3 must be revisited.
- **A3.** Windows are creation-date based (D7); switching to `paid_at` recognition is a future
  refinement.
- **A4.** In-memory aggregation is acceptable at current volume; a SQL view / materialized
  aggregate is the scale follow-up (not built here).
- **A5.** GMV has no currency dimension (INR-only platform). Multi-currency would require a
  normalization step here.

## Data flow

- Extend the existing bookings select in `getKpis` to add
  `host_id, created_at, customer_total, platform_fee_amount, platform_fee_gst, vendor_amount`
  (already selects `payment_status, platform_fee_amount, commission_applied, created_at`).
  Preserve the existing v1.7 `commission_applied` per-column fallback branch.
- Add one scan of `product_purchases`
  (`payment_status, amount_paid, platform_fee, created_at`), wrapped so a missing-column or
  query error degrades product GMV to 0 without failing the endpoint.
- All aggregation in-memory, matching current controller style (A4).

## Client

Two new tiles on `AdminInsights.jsx`, styled to match existing KPI tiles (reuse existing
currency/number formatters and delta-arrow rendering; no new design tokens):

- **GMV** — `total` (₹), 30-day delta arrow (`last30` vs `prev30`), take-rate sub-line
  ("Platform take: X%").
- **Host Activation** — `activationRate %` headline, `activated / total` hosts, median
  time-to-first-booking (or "—" when `null`), `+new30` this month.

## Testing

Extend `server/tests/unit/insightsAdminController.test.js`:

- **GMV math:** booking `grossValue` primary formula; product `grossValue`; combined total;
  paid-only filtering; refunded/unpaid excluded; 30/60-day window split (half-open boundary).
- **Free bookings:** `grossValue = 0`, excluded from GMV total contribution and from activation.
- **Null/fallback:** per-row NULL `customer_total` → else-branch; NULL fee/gst → coalesced;
  negative reconstruction → clamped 0; per-column schema fallback (bookings) and product
  `amount_paid`-absent path both degrade without throwing.
- **Activation:** distinct-host counting; `grossValue > 0` gate excludes free-only hosts; rate %
  with `totalHosts = 0` guard; `new30` first-booking-in-window; NULL `host_id` skipped.
- **Median TTFB:** odd count (middle), even count (mean of two middle), zero hosts (`null`),
  negative diff clamped to 0.
- **Take-rate:** `platformRevenue` includes product `platform_fee`; GMV = 0 → take-rate 0;
  relationship `platformRevenue ≥ revenue.total`.
- **Empty DB:** all zeros / null median, no throw, no divide-by-zero.

## Out of scope (YAGNI)

- Time-series charts / sparklines (totals + 30-day delta only).
- Partial-refund / negative-adjustment handling of GMV (only full status→`refunded`).
- Subscription revenue in GMV (excluded by decision).
- `paid_at`-based window recognition (A3).
- Server-side PostHog funnel query (stays a launchpad link, per existing controller note).
- SuperDashboard KPI mirror.
- SQL-view aggregation (A4).
- Test-transaction exclusion (no `is_test` flag exists — business rule 8).

## Files touched

- `server/controllers/insightsAdminController.js` — add GMV + activation to `getKpis`.
- `server/tests/unit/insightsAdminController.test.js` — new assertions.
- `client/src/pages/admin/AdminInsights.jsx` — two new tiles.

No migration. No new route / permission / nav item.
