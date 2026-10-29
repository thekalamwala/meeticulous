# Host Dashboard UX Refactor — Design Spec

Date: 2026-06-25 · Branch: `vendor-ui-fixes`

## Hard constraints (do not violate)
- NO change to: business logic, API request/response shapes, DB schema, routes/URLs, permissions/guards, feature flags, data fetching.
- Routes stay byte-identical (`/dashboard`, `/dashboard/earnings`, `/dashboard/payments/payouts`, etc.).
- `requireHost`/`ProtectedRoute`/`HostRoute`/`FeatureGate` untouched.
- Tests must stay green; update a test ONLY when it asserts on a purely-presentational string/structure we intentionally changed.
- Do NOT mutate global brutalist classes (`.fb-card`, `.fb-btn`, `.fb-badge`) — they're used by marketing/profile pages. Introduce NEW dashboard-scoped primitives instead.

## Phase 2 — Information Architecture
Group 12 pages by host mental model + visit frequency.

| Mental model | Pages | Frequency |
|---|---|---|
| Run my day | Overview, Bookings, Availability | daily |
| Sell (Catalog) | Services, Products | weekly |
| Get paid (Money) | Earnings, Payouts, Transactions | weekly |
| Account | Profile, Plan, Feedback | occasional |

Decisions / why:
- **Unify Money.** Earnings + Payouts + Transactions are one concept split across two top-level entries today. Group them; cross-links between them.
- **Catalog group.** Services + Products are "the things I sell."
- **Promote Plan into nav.** Today only reachable via footer button — hidden. Put under Account.
- **Availability stays top-level on desktop** (touched often enough); demoted into mobile "More".
- **Kill 4 dead nav items** (Calendar/Chats/Reviews/Tickets) — remove from nav (no routes exist; pure nav-entry deletion).

## Phase 3 — Navigation (3 layouts)
Routes unchanged; only grouping/labels/entry-points change.

Desktop sidebar (lg+, grouped, all visible — minimal clicks):
```
[user + plan badge]
  Overview            /dashboard
  Bookings            /dashboard/bookings
  Availability        /dashboard/availability
CATALOG
  Services            /dashboard/services
  Products            /dashboard/products      (lock < creator — keep)
MONEY
  Earnings            /dashboard/earnings
  Payouts             /dashboard/payments/payouts
  Transactions        /dashboard/payments/transactions
ACCOUNT
  Profile             /dashboard/profile
  Plan                /dashboard/upgrade
  Feedback            /dashboard/feedback      (FeatureGate vendor_feedback)
[view public page · super admin · logout]
```
Tablet (md): same sidebar collapsed to a 64px icon-rail; labels in tooltip on hover.
Mobile (<md): bottom tab bar = **Home · Bookings · Catalog · Money · More**.
- Catalog tab → /dashboard/services; Money tab → /dashboard/earnings; active-state matches their group prefixes.
- "More" opens a full sheet: Availability, Products, Payouts, Transactions, Profile, Plan, Feedback, View public page, Logout.
- **Remove** today's floating "More" FAB and the floating Feedback FAB — one nav system, no stray FABs.

## Phase 4 — Design system (new dashboard-scoped primitives)
Location: `client/src/components/dashboard/ui/` (presentational only). Built on existing tokens.

Tokens (reuse; add dashboard-scoped vars under `.dash` if needed):
- Radius: 4px controls, 6px cards (existing scale; stop writing `rounded-2xl` expecting 16px).
- Spacing: 8/16/24/32/48 (existing).
- Elevation: `--elev-1` hairline+`0 1px 2px`, `--elev-2` card `0 1px 3px + 0 1px 2px`, `--elev-3` overlay `0 10px 30px`. Soft, not brutalist (dashboard ≠ marketing).
- Color: canvas `#f7f5ef`; white surfaces; primary `#FE5100` for primary action/active only; ONE semantic palette (success/warn/danger/info/neutral) for all status badges; muted text = gray-500 (AA), retire gray-400 body text.
- Type scale: `page-title` (text-2xl sm:text-3xl font-bold), `section-title` (text-base font-semibold), `label` (text-sm font-medium), `body` (text-sm), `caption` (text-xs text-gray-500).

Components (single source of truth, replace per-page reinventions):
- `DashPage` — page wrapper: canonical max-width + padding.
- `PageHeader` — title, subtitle, actions slot.
- `Section` / `SectionHeader`.
- `Card` / `Surface` — radius/elevation/padding.
- `StatCard` — label, value, delta, icon (unifies Dashboard tiles + Payouts balances + Earnings KPI).
- `Button` — variants primary/secondary/outline/ghost/danger; sizes sm/md/lg (wraps existing `--btn-*` tokens).
- `Badge` / `StatusBadge` — one map for booking status, payment status, payout status, feedback status, plan tier.
- `FormField` (label+control+hint+error) + `Input`/`Select`/`Textarea` consistent.
- `DataTable` — header + responsive body that collapses to cards on mobile WITHOUT hiding data; `EmptyRow`.
- `Tabs` — ProfileSetup + section sub-nav.
- `EmptyState` — icon, title, body, action.
- `Skeleton` — list/table/card loading.
- `FilterBar` / `SearchInput`.
- `Sheet` (mobile drawer) + `Modal` (consistent overlay/elevation/animation).
- Money: shared `fmtMoney` util (one format app-wide — display only).

## Phase 5 — Refactor order (one page at a time, verify after each)
0. Build Phase-4 primitives.
1. Shell: `DashboardLayout` (new grouped sidebar + icon-rail + mobile bottom bar/sheet, drop FABs).
2. Feedback (simplest; adds labels = a11y win).
3. Transactions → 4. Payouts → 5. Earnings (Money trio; shared StatCard/DataTable).
6. Products → 7. ServicesList (Catalog).
8. Bookings (table + modals).
9. Availability (mobile-first rebuild of slot editor).
10. ProfileSetup (Tabs) → 11. ServiceForm (FormField).
12. UpgradePlan → 13. Dashboard/Overview (landing; StatCards + lists).

Verify per page: `npm test` (vitest, affected) + `npm run build` + preview screenshot (desktop + 375px). Keep tests green.

## Phase 6 — Final consistency audit
Sweep all 12 pages + shell: one header, one card, one button system, one badge map, one table pattern, one empty/loading/error treatment. Full client test + build. Confirm no route/guard/flag drift.

## Status — COMPLETE (2026-06-25)
All phases done on branch `vendor-ui-fixes`.
- **Shell** + **13 pages** refactored: DashboardLayout, Dashboard, Bookings, Availability, ServicesList, ServiceForm, Products, Earnings, Payouts, Transactions, ProfileSetup, UpgradePlan, Feedback.
- **16 new primitives** under `client/src/components/dashboard/ui/` (PageHeader, Card, StatCard, Button, Badge/StatusBadge, FormField+Input/Select/Textarea, DataTable, Tabs, EmptyState, Skeleton, Modal/Sheet, FilterBar/SearchInput, Toolbar, `fmtMoney`, `cn`, scoped `tokens.css`).
- Verified: **client build green**, **306/306 vitest green** (re-run after every page).
- Diff: 14 files changed, **net −991 lines**; new `ui/` dir + this spec are the only additions.
- Zero changes to routes (App.jsx), guards (HostRoute/ProtectedRoute), FeatureGate flags, business logic, or API calls.
- Currency unified to `₹` across Money pages (was mixed `Rs.`/`₹`); 1 Payouts.test assertion updated for the symbol (amounts unchanged).
- Dashboard is auth-walled → visual verification is via the rendering vitest suites + production build (headless browser can't log in); confirm visually in a logged-in host session.

