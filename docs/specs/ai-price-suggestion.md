# Spec — Phase 2: Price Suggestion (benchmark, not LLM)

Status: building on branch `feat/price-benchmark` · follows the AI page builder (#1103) · 2026-09-19

## Goal
When a host sets a price (onboarding `/live` form + dashboard ServiceForm), show what
comparable hosts on Meeticulous actually charge, so they don't guess or under-price.
Advisory only — never auto-fills.

## Core decision: benchmark, not LLM
v1 suggests from **real platform data**, not a language model:

> "Similar hosts charge ₹800–₹1,500 (median ₹1,200) across 9 listings."

Why:
- **No fabrication.** The LLM copy generator deliberately blanks any `₹`/`Rs`/`%`
  (`FABRICATION` guard). An LLM that emits prices would fight that and invent numbers.
- **Defensible + compounding.** Grounded in actual bookable services; sharpens as the
  platform grows.
- **Free, no quota.** A DB aggregate, not a token spend.

LLM price estimation is explicitly out of scope (see "Rejected").

## User flow
1. Host on a price field (not fee-only mode).
2. A "See what others charge" chip sits beside the input.
3. Tap → range + median from comparable published, paid services, plus sample size.
4. Host taps a value to fill it, or ignores it. Never auto-applied.

## Endpoint
`GET /services/price-benchmark?category=<slug>&profession=<slug>&duration=<min>`
- Aggregates `services` where: active, `price >= 100` (excludes free/fee-only), same
  `primary_category` (fall back to profession when the category sample is thin), excludes
  the requesting host's own services.
- Returns `{ low, median, high, sample_size, basis }` where basis = 'category' | 'profession'.
- **Silence threshold:** when `sample_size < 5`, return `{ sample_size, low:null, median:null, high:null }`.
  The chip then hides. No "median of 2 listings".
- Percentiles computed in JS from the fetched price list (dataset is small — no RPC).

## Cold-start reality
Prod has ~62 services. Most categories have < 5 comparables today, so the chip is silent
for most hosts at first. Correct behaviour — it switches on per-category as listings
accumulate. Do not paper over thin data with an LLM estimate.

## Client
- `ExploreWithBolt.jsx` + `services/ServiceForm.jsx` — a "See what others charge" chip
  beside the price input. Calls the endpoint on demand (not on mount). Renders range chips;
  tap fills the input. Hidden when fee-only mode or `sample_size < 5`.

## Guardrails
- Advisory only; host confirms every price (product rule: price is human).
- Display clamps to `>= ₹100` (min-price rule; Supreme exempt).
- Benchmark excludes ₹0 / fee-only / inactive services and the host's own.
- Server stays price-authoritative at create (snapshot pricing, never trust client) —
  this only pre-fills an input.

## Migration
None. Optional index `(primary_category, is_active, price)` on `services` if the aggregate
is slow — measure first, add only if needed.

## Tests
- Server: percentile math; silence-below-5; excludes own/free/inactive; category→profession
  fallback.
- Client: chip hidden when fee-only or thin sample; tap fills the input; never auto-fills.

## Rejected
- **LLM price estimate** — hallucinated numbers, no ground truth, fights the fabrication
  guard, creates a "the app told me to charge ₹X" liability.
- **Auto-fill the median** — removes the human decision on a money field.

## Priority note
Lower-leverage than activation right now (GMV ₹322, 2 payouts). Value compounds as
listings grow, not today.
