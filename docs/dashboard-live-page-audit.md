# The live host dashboard — page-by-page audit

**Date:** 2026-11-19
**Scope:** every page a host actually sees at `/dashboard/*`.
**Companion to:** `docs/dashboard-competitor-teardown.md` (Topmate patterns),
`docs/dashboard-facelift-audit.md` (colour/token drift).

---

## 0. Which tree is live — verified, not assumed

Three trees look like the dashboard. Only one ships.

| Tree | Route | Status |
|---|---|---|
| `client/src/pages/hostlab/` | `/host-lab` | **Prototype.** Renders `mockData.js`. Its own banner: "Sample data only — nothing here reads or writes your real account." |
| `client/src/pages/*V2.jsx` | `/dashboard/*` when `dashboard_v2` is on | **LIVE.** The Host Lab design graduated onto real data. |
| `client/src/pages/Dashboard.jsx` etc. | `/dashboard/*` when the flag is off | Fallback. Still reachable via the kill switch. |

`dashboard_v2` was read straight from the live `feature_flags` table:

```
dashboard_v2          enabled=true   updated_at 2026-11-18 06:19:15+00
dashboard_sections_v2 enabled=true   updated_at 2026-11-18 16:01:42+00
```

**The source comments say "ships OFF". That is the default, not production.** Trusting
them sends work to the fallback path. Check the flag table, not the comment.

## 1. The live page set, and how each is composed

Three composition patterns, not one:

**A. Native V2 pages** — written against the v2 shell directly.
`TodayV2`, `BookingsV2`, `ClientsV2`, `CatalogV2`, `EarningsV2`, `PayoutsV2`,
`InvoicesV2`, `AvailabilityV2`, `ChatPageV2`.

**B. Wrapper pages** — three lines that render the legacy page in `embedded` mode,
which swaps its hero for the v2 `PageHeading` + SubNav:

```jsx
const TransactionsV2 = () => <Transactions embedded />;
```

`TransactionsV2`, `TestimonialsV2`, `ReferEarnV2`, `UpgradePlanV2`, `ProfileSetupV2`.

**This is the trap in the whole area.** `Transactions.jsx` and `Testimonials.jsx` look
like legacy files and are not — they are live, through the wrapper. A page is only
dead if nothing renders it on the flag-ON path, and five legacy files fail that test.

**C. Sections** — `Intelligence` and `Community` consoles behind `dashboard_sections_v2`.

## 2. Header consistency — the finding

`PageHeading` (`components/dashboard/ui/v2.jsx:125`) is the live shared header.

| Page | Before | After |
|---|---|---|
| BookingsV2, CatalogV2, EarningsV2, PayoutsV2, InvoicesV2, AvailabilityV2, ChatPageV2 | `PageHeading` | unchanged |
| Transactions/Testimonials/ReferEarn/UpgradePlan/ProfileSetup (embedded) | `PageHeading` | unchanged |
| **TodayV2** | hand-rolled `<h1>` ×2 | `PageHeading` |
| **ClientsV2** | hand-rolled `<h1>` ×2 | `PageHeading` |

The two holdouts' markup was **byte-identical** to `PageHeading` —
`text-[17px] … sm:text-[18px]`, subtitle `mt-0.5 text-[12px] font-medium text-ink/55`.
Duplication, not divergence, exactly as in the Host Lab prototype they graduated from.
Both pages hand-rolled a second copy for their error and Pro-gated branches too.

No `<h1>` remains in any `*V2.jsx`.

**One real visual change:** ClientsV2's header row was `items-start`; `PageHeading` is
`items-end`, so its Export button now bottom-aligns to the two-line title block instead
of top-aligning. Deliberate, and worth a look.

## 3. What else diverges, measured

| Pattern | State on the live pages |
|---|---|
| `tabular-nums` on money | TodayV2 1 · ClientsV2 4 · CatalogV2 1 · PayoutsV2 1 · InvoicesV2 1 · **EarningsV2 0, despite 4 currency renders** |
| Empty states | Only TodayV2, BookingsV2 and ClientsV2 have one. Catalog, Earnings, Payouts, Invoices have none. |
| ⓘ / explained metrics | Uneven: TodayV2 9, EarningsV2 3, InvoicesV2 3, ClientsV2 3 — AvailabilityV2 and TestimonialsV2 0 |
| Cold `gray-*` | `Testimonials.jsx` had 2 (live via wrapper) — **fixed here.** The rest sit in shared `components/dashboard/ui/*`, which PR #396 fixes. |

Since those shared primitives render inside the live dashboard, **PR #396 is live-path
work**, not fallback cleanup.

## 4. Changed in this PR

- `TodayV2.jsx` — both headers → `PageHeading` (live subtitle passed as `sub`)
- `ClientsV2.jsx` — both headers → `PageHeading`, Export into the `action` slot
- `Testimonials.jsx` — 2 cold greys → warm ramp

## 5. Not done, and why

- **EarningsV2 `tabular-nums`** — real gap, but it needs a look at each currency render
  to see which are columns and which are prose. Its own change.
- **Empty states on Catalog/Earnings/Payouts/Invoices** — needs copy, not just code; see
  the teardown's benefit-voice note.
- **A tooltip convention on tiles** — wants the component change first.
- **The fallback pages** (`Bookings.jsx`, `Dashboard.jsx`, the non-embedded
  `Transactions.jsx` branch) — only reachable via the kill switch. Left alone.

## 6. Method note

This audit was done from source. Two browser attempts failed and are worth recording so
the next person does not repeat them: the built-in browser pane keeps its own cookie jar
and bounces to login even when Chrome is signed in; and a dev server on `5173` belonging
to a *different* worktree froze its renderer under concurrent HMR. Port 5173 was serving
`C:\Users\shubh\mt-wt-catv2`, not this branch — checking a port tells you nothing about
which checkout answers on it. `curl` the served source and grep it.
