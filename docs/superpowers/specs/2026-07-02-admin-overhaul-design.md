# Admin Overhaul — Design Spec

**Date:** 2026-07-02
**Branch:** `fix/admin-dashboard-ui`
**Status:** Approved by founder

## Problem

The admin panel (~45 pages under `client/src/pages/admin/`, shell in
`client/src/components/common/AdminLayout.jsx`) has drifted:

- **Visual inconsistency** — two icon libraries (custom `Ic` registry vs lucide-react on
  5 pages), page-title sizes drift (`text-2xl` on AdminUsers/AdminSettings vs `text-xl`
  elsewhere), every page rolls its own table markup, AdminExplore uses a bespoke
  brutalist style (hard drop shadows, 6px radius) against the soft rounded-2xl norm.
- **Nav defects** — `/admin/staff` listed twice in the sidebar (PEOPLE "Staff & Roles" +
  SECURITY "Roles & Permissions"), which also duplicates it in the ⌘K palette; two
  breadcrumb segments render blank (`professions`, `explore` missing from
  `PATH_LABELS`; `notifications` was flagged by audit but already exists at line 70).
- **Shell complaints** — sidebar grouping confusing (Users/Hosts/Bookings appear both in
  DASHBOARD and PEOPLE/OPERATIONS), everything cramped (13px nav text, 15px icons),
  sidebar too long (7 ROADMAP teaser rows), mobile drawer unreliable, overall look dated.
- **Dark mode half-done** — toggle themes only sidebar/header via CSS override hack in
  `index.css` (`.admin-shell.dark …`); all page interiors hardcode light colors, zero
  `dark:` variants. Toggling dark renders white cards on a near-black canvas.

Route audit result: **no 404s, no orphan pages** — 78/82 nav targets resolve cleanly.
The routes themselves are healthy; the defects are the duplicate entry and labels above.

## Constraints

- **DO NOT TOUCH anything service-categories related**: `AdminServiceCategories.jsx`,
  `AdminCategories.jsx` (professions taxonomy), the `/admin/services/categories` and
  `/admin/professions` nav entries' targets, `service_categories` DB objects. These two
  pages keep their lucide icons for now; converting them is a follow-up after the
  category freeze lifts.
- No API/route renames, no DB changes, no new auth flows (per project rules).
- Existing design tokens only; `#FE5100` accent, Poppins body, Plus Jakarta Sans
  headings stay.
- Stability first: additive primitives, page-by-page migration, tests green between
  commits.
- Performance ("slow/laggy") is explicitly **out of scope** — it is backend latency
  (cold starts, query cost), not admin UI; separate branch later. Admin routes are
  already lazy-loaded.

## Design

### 1. Shell — `AdminLayout.jsx` + `adminNav.js`

**Regroup 9 sidebar sections → 7 and kill duplication:**

| Section | Contents (after) |
|---|---|
| DASHBOARD | Operations Center, Revenue, Marketing Insights, Pending Actions |
| OPERATIONS | Bookings (group), Services (group — categories child untouched), Addons, Badges, Subscription Plans, Professions, Explore Page |
| PEOPLE | Hosts (group), Users, KYC (group), Staff & Roles |
| FINANCE | Dashboard, Journal, Ledger, Transactions, Payouts, Refunds, Coupons (soon) |
| CONTENT | Pages, Blogs, Newsletter, FAQ, Testimonials, Media Library (soon) |
| SUPPORT | Tickets, Disputes, Reviews Moderation, Host Feedback |
| PLATFORM | Appearance, Menu Builder, Footer Builder, Communication, Campaigns, Notification Settings, Payment Settings, General Settings |
| SYSTEM | Audit Logs, Reserved Slugs, Blocked IPs, Feature Status, API Keys (soon) |
| ROADMAP | ONE collapsed "Coming Soon" group containing the 7 former teaser items as children |

Notes:
- DASHBOARD loses its Users/Hosts/Bookings links (duplicated full pages); those views
  stay reachable as tabs inside SuperDashboard itself.
- SECURITY renamed SYSTEM; duplicate "Roles & Permissions" (`/admin/staff`) removed —
  canonical entry lives in PEOPLE. PLATFORM CONTROL section (single Feature Status item)
  merges into SYSTEM.
- ROADMAP compresses from 7 rows to 1 collapsed group → sidebar ~10 rows shorter.
- `flattenDestinations` unchanged in behavior; palette automatically loses the dup.

**Size/density bump (the "cramped" fix):**
- Nav item text 13 → 14px; nav icons 15 → 16px; section labels 10.5 → 11px.
- Item padding `py-2` → `py-2.5`; sidebar width 258 → 268px (collapsed 70px stays).
- Header height 54 → 60px; breadcrumb text 12 → 13px.
- Page titles standardize via `PageHeader` primitive: `text-[22px]` bold + 13px subtitle.

**Premium polish:** active nav item becomes a soft filled pill with accent text (replaces
left-border style), smoother hovers, visible focus rings, subtle sidebar section
separators. Palette unchanged: dark `#17171A` sidebar, `#FE5100` accent.

**Fixes:** add `professions: 'Professions'` and `explore: 'Explore Page'` to
`PATH_LABELS`. Mobile drawer behavior verified in preview and fixed if broken (scroll
lock, close on navigate, safe-area padding).

### 2. Tokens + primitives (real dark mode)

**CSS variables** on `.admin-shell` in `client/src/index.css`:

```
--adm-bg, --adm-card, --adm-card-hover, --adm-border, --adm-text-1, --adm-text-2,
--adm-text-3, --adm-accent (#FE5100), --adm-danger, --adm-ok, --adm-warn
```

Light values on `.admin-shell`, dark values on `.admin-shell.dark`. The existing
shell-only dark override block is replaced by these tokens.

**New primitives** in `client/src/components/admin/ui/` (all var-driven, so any page
using them is dark-ready automatically):

| Component | Purpose |
|---|---|
| `PageHeader` | title + subtitle + right-side actions slot; kills title-size drift |
| `Card` | `bg card / border / rounded-2xl / p-5` panel |
| `StatCard` | label/value/delta tile (extracted from SuperDashboard) |
| `Btn` | variants: primary, outline, ghost, danger |
| `Badge` | status chip (green/red/amber/blue semantic) |
| `Table` | columns-config table: header row, dividers, cell padding, empty slot |
| `Skeleton` | loading placeholder (standardizes spinner vs pulse split) |

**Icons:** single source — `IC` registry stays in `adminNav.js`, `Ic` component
unchanged. SuperDashboard's local mini-Ic + IC copy deleted in favor of imports. Add
missing glyphs needed to drop lucide — exact list taken from the lucide imports of
AdminBlockedIps, AdminReservedSlugs, and AdminExplore at implementation time (expected:
trash, plus, pencil/edit, check/checkCircle, alertTriangle→existing `alert`,
shieldCheck→existing `shieldOk`, chevrons→existing). Nothing added speculatively.

### 3. Page migration (phased, mechanical)

- **Wave 1 (high-traffic):** SuperDashboard, AdminUsers, AdminBookings, AdminProviders,
  AdminTransactions, AdminFinanceDashboard, AdminSettings → move onto PageHeader / Card /
  StatCard / Btn / Badge / Table / Skeleton + token colors (adds dark support).
- **Wave 2 (rest, ~30 pages):** PageHeader swap everywhere (fixes `text-2xl` drift),
  lucide→Ic on AdminBlockedIps / AdminReservedSlugs / AdminExplore, AdminExplore
  restyled to house norm (rounded-2xl, soft shadows), tables onto shared `Table`,
  token colors throughout.
- Explicitly skipped: AdminServiceCategories, AdminCategories (constraint above).
- One commit per coherent step; primitives are additive so the app builds and tests
  green between every commit.

### 4. Error handling / behavior preservation

- Zero route changes; zero API changes; permission gating (`sessionCan`) untouched.
- Nav data stays pure/unit-testable (no JSX in `adminNav.js`).
- `AdminEmptyState` kept as-is (already consistent, 22+ pages).

### 5. Testing & verification

- New unit tests (Vitest): no duplicate `to:` across NAV+ROADMAP; every nav path segment
  has a `PATH_LABELS` entry; primitives render smoke tests.
- Existing admin tests must stay green (AdminCampaigns, AdminFeatureStatus,
  AdminFinance, AdminInsights + any AdminLayout tests).
- `cd client && npm run build` clean; `cd server && npm test` untouched/green.
- Preview verification: light mode, dark mode, mobile drawer — screenshots shared
  before completion.

## Out of scope (follow-ups)

- Backend/perf work for "slow/laggy" admin (separate branch).
- Lucide→Ic conversion for the two category pages (after freeze lifts).
- SeoDrawer/BackgroundCurator wider adoption.
