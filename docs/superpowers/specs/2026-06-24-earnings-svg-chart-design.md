# Earnings Trend Chart — Google-Ads-style SVG rework

**Date:** 2026-06-24
**Branch:** `feat/earnings-svg-chart`
**Scope:** Host-facing Earnings page only (`client/src/pages/Earnings.jsx`)

## Overview

Replace the hand-built CSS bar chart on the host Earnings page ("Net Earnings — Last 6
Months", `Earnings.jsx:141-167`) with an interactive, Google-Ads-style line/area chart.
The chart's clickable metric cards also replace the page's existing top stat row, so a
host clicks a KPI and the chart replots that metric.

Built with **hand-written SVG — zero new dependencies**. No charting library, no lockfile
regeneration, no Dependabot churn.

## Goals

- Smooth line + filled area trend, on-brand (orange `#FE5100`).
- Clickable metric cards: Net earnings / Gross revenue / Paid bookings / Avg booking value.
  Clicking one replots the chart and is the page's primary KPI row (merged — decision A).
- Hover/touch tooltip with crosshair showing exact month + value(s).
- Dotted previous-period comparison line + per-card % delta vs previous period.
- Range toggle: 3 / 6 / 12 months (client-side only).

## Non-Goals (out of scope)

- Admin dashboard chart (host page only).
- Any backend / API change (`getHostBookings()` already returns the full list).
- Weekly granularity, CSV export, date pickers.
- Dark mode handling (host dashboard is light-only; SVG follows page tokens regardless).
- Entry animation is optional polish, not required.

## Locked Decisions

| Decision | Choice |
|---|---|
| Rendering | Hand-built SVG, zero deps |
| Features | All 4: metric cards, hover tooltip + crosshair, prev-period comparison, 3/6/12 toggle |
| Scope | Host Earnings page only |
| KPI row | **Merge (A)** — interactive cards replace the existing top stat row |
| Accent | Brand orange `#FE5100` (line + area); gray dashed comparison |
| Date ranges | Client-side slicing of existing `paid` bookings; no backend |

## Architecture

Four files. Pure logic is isolated from React for unit testing.

| File | Status | Role |
|---|---|---|
| `client/src/utils/earningsSeries.js` | new, pure | `buildSeries(paid, rangeMonths, now)` → month buckets, per-metric current/previous series, totals + deltas. |
| `client/src/utils/chartGeometry.js` | new, pure | `niceTicks`, `linePath` (monotone cubic), `areaPath`, scale helpers. |
| `client/src/components/EarningsTrendChart.jsx` | new | Cards + range toggle + SVG + tooltip. Owns metric/range/hover state + responsive width. |
| `client/src/pages/Earnings.jsx` | edit | Remove bar block (141-167), dead `monthlyData`/`maxRev` (79-101), and the top stat row (113-139, replaced by chart cards). Render `<EarningsTrendChart paid={paid} />` in their place. The "Revenue by Service" section (170-199) stays untouched below it. |

## Data Contract — `buildSeries(paid, rangeMonths, now = new Date())`

**Input:** `paid` = bookings already filtered to `payment_status === 'paid'`. Each booking uses
`scheduled_at`, `vendor_amount`, `services.price`, `services.title`.

Per-booking metric rules (mirror existing page logic):
- **net** = `vendor_amount != null ? vendor_amount : services.price || 0`
- **gross** = `services.price || 0`
- **bookings** = count (1 each)

**Windows:** `cur` = the `rangeMonths` calendar months ending at `now`'s month (inclusive),
oldest→newest. `prev` = the `rangeMonths` months immediately before `cur`. Month math must
roll across year boundaries correctly (e.g. `now = Jan 2026`, range 6 → cur = Aug'25…Jan'26).

**Output:**
```
{
  months: [{ key: '2026-01', label: 'Jan', labelLong: "Jan '26" }, ...],  // length rangeMonths
  series: {
    net:      { cur: number[], prev: number[] },   // per-month sums, length rangeMonths
    gross:    { cur: number[], prev: number[] },
    bookings: { cur: number[], prev: number[] },
    avg:      { cur: number[], prev: number[] },    // per-month net/count, 0 if no bookings
  },
  totals: {
    net:      { cur, prev, delta },   // delta = prev > 0 ? (cur - prev) / prev : null
    gross:    { cur, prev, delta },
    bookings: { cur, prev, delta },
    avg:      { cur, prev, delta },    // overall avg = totalNet / totalBookings (NOT mean of monthly avgs)
  },
  hasData: boolean,                    // any paid booking in cur window
}
```

## Geometry Contract — `chartGeometry.js`

- `niceTicks(max, count = 4)` → ascending tick array starting at 0 using 1-2-5 rounding;
  last element is the "nice" domain max (≥ `max`). `max = 0` → `[0, 1]` (avoid divide-by-zero).
- `linePath(points)` → SVG `d` string, monotone cubic interpolation, clamped so the curve
  never dips below the baseline (no visual negative earnings). `points = [{x, y}]`.
- `areaPath(points, baselineY)` → closed `d` string (line then down to baseline and back).
- Scales (domain→pixel) computed in the component from measured width, fixed height, padding,
  and `niceTicks` max.

## Component Behavior — `EarningsTrendChart`

**Props:** `{ paid }`.
**State:** `metric` (`'net'` default), `range` (`6` default), `hoverIdx` (`null`), `width`
(via `ResizeObserver`, default `640` so jsdom/tests render without it).
**Derived:** `series = useMemo(() => buildSeries(paid, range), [paid, range])`.

**Metric cards (KPI row, 4):** label + big value (`fmtMoney` for net/gross/avg, integer for
bookings) + delta pill. Delta pill: `▲ x%` green / `▼ x%` red / `—` when `delta === null`.
Active card has an orange bottom underline. Rendered as `<button>` (keyboard + click), grid
wraps to 2 columns on narrow screens.

**Range toggle:** segmented control `3M / 6M / 12M`, `aria-pressed` on active.

**Chart SVG:** `role="img"` + `aria-label` summarizing the active metric trend. Padding for
axis labels. Horizontal gridlines + ₹ y-labels from `niceTicks`. Short month x-labels.
Current series = orange line + gradient-fade area (`stopColor="currentColor"` via a
`text-primary` group, so it stays on-brand). Previous series = gray dashed line, no fill.

**Hover/touch:** transparent `<rect>` overlay catches `pointermove` (unifies mouse + touch) →
nearest month index → vertical crosshair `<line>` + highlighted dot(s) + an absolutely-
positioned tooltip div (inside a `position:relative` wrapper) showing month, current value,
and previous value + delta. `pointerleave` clears `hoverIdx`.

**Empty state:** `!series.hasData` → render a friendly message in place of the chart
("No paid earnings yet — your first paid booking will show up here."). Cards show ₹0 / `—`.

## Visual / Theme

- Accent: brand orange `#FE5100` via Tailwind `text-primary` + `stroke="currentColor"`;
  area gradient via SVG `<linearGradient>` with `stopColor="currentColor"` and opacity stops.
- Comparison line: `text-gray-400`, `stroke-dasharray`.
- Card surfaces reuse existing `fb-card` styling for visual consistency.
- Currency formatting reuses the page's pattern: `₹${Math.round(n).toLocaleString("en-IN")}`.
- Axis/label text ≥ 11px.

## Testing

- `earningsSeries.test.js`: per-metric bucketing; `vendor_amount` fallback to price; window
  boundaries incl. year rollover; range 3/6/12 lengths; empty input; `delta === null` when
  `prev === 0`; overall avg = totalNet/totalBookings; `hasData` flag.
- `chartGeometry.test.js`: `niceTicks` (1-2-5, `max=0` guard); `linePath`/`areaPath` produce
  valid strings; monotone clamp keeps points ≥ baseline.
- `EarningsTrendChart.test.jsx`: renders 4 cards; default active = net; click Gross → active
  switches + chart aria-label updates; range toggle changes month count; empty state when no
  paid bookings; delta pill renders. (SVG is plain DOM — no canvas, no chart-lib mock.)

## Edge Cases

- `ResizeObserver` undefined (jsdom) → guard `typeof ResizeObserver`; fall back to default width.
- Range larger than available data → months still render with 0 values.
- `niceTicks` divide-by-zero when all values 0 → `[0, 1]` fallback + empty-state copy.
- Previous period has no bookings → comparison line absent/flat, deltas show `—`.

## Verification

- `cd client && npm test` green (new + existing suites).
- `cd client && npm run build` passes.
- Preview: load Earnings page, confirm cards switch metric, hover tooltip + crosshair track,
  range toggle re-buckets, prev-period dashed line renders, empty state for a host with no
  paid bookings.
