# Component Standards — Meeticulous

_Deliverable 5. Visual + behavioural standards for shared components: variants, sizes, states, a11y, responsive behaviour, and the **canonical implementation** to standardize on. Consumes `03-design-tokens.md`._

> **Unification principle.** The app already has three good, token-driven component sets — `dashboard/ui/*` (scoped `.dash`), `admin/ui/*` (scoped `adm-*`), and the marketing CSS-var templates. The goal is **one `components/ui/` core** these converge on, not a rewrite. Where a canonical source exists, migrate others to it; don't invent new ones. All components: tokens only, no hard shadows, 4–6px radii, visible focus ring, reduced-motion safe.

---

## Button
- **Canonical:** merge `dashboard/ui/Button.jsx` + `admin/ui/Btn.jsx` → `components/ui/Button`.
- **Variants:** `action` (emerald `#059669` fill, white — the ONE primary conversion CTA) · `primary` (ink or `primary-cta` fill, white) · `secondary` (surface + 1px `border`, ink) · `ghost` (transparent, `primary-cta` text) · `danger` (`error-fg` fill) · `link`.
- **Sizes:** sm (h-9, text-sm) · md (h-11, text-sm, default) · lg (h-12, text-base). Min touch 44px on mobile.
- **States:** hover (darken via `*-dark` token — **never orange**), active (translate-y-px), focus-visible (`--focus-ring`), disabled (opacity-50, no pointer), loading (spinner + aria-busy, label retained).
- **Rules:** radius 4px, no shadow, font-sans 600, one `action` button per view.
- **A11y:** real `<button>`/`<a>`; icon-only needs `aria-label`.

## Input · Textarea · Select · Field
- **Canonical:** `dashboard/ui/Form.jsx` (`Input/Textarea/Select/Label/FormField` — already has `htmlFor`, error, hint).
- **Spec:** surface bg, 1px `border`, radius 4px (fix the undefined `--radius-control`), padding `px-3 py-2.5`. Focus = `primary` border + `--focus-ring` (fix the green-leftover ring). **Select chevron = blue** (fix the `%23FE5100` orange SVG). Error = `error-fg` border + `error-bg`/`error-fg` hint text. Disabled = `sand` bg.
- **States:** rest / hover (`border-strong`) / focus / error / disabled / read-only.
- **A11y:** every field a `<label htmlFor>` (not a heading); error via `aria-describedby`+`aria-invalid`; required marked. (Onboarding currently violates this — migrate.)
- **Sizes:** md default; sm for dense tables/filters.

## Card
- **Canonical:** `dashboard/ui/Card` + marketing `ProfessionLanding` card.
- **Spec:** `surface` bg, 1px `border` (`#E2E8F0`/`border-black/5`), `--shadow-1` rest, radius 6px (10px allowed exception). Hover (interactive only): `--shadow-2` + `-translate-y-0.5` + 150ms.
- **Variants:** base · interactive (hover lift) · compact (p-4) · stat (see StatCard).
- **No** 3px ink borders, no hard shadows.

## Table / DataTable
- **Canonical:** `dashboard/ui/DataTable.jsx` (desktop `<table>` → label:value cards < md, built-in skeleton + empty slot). Refactor hand-rolled tables (`Bookings.jsx`) onto it.
- **Spec:** `surface` body, `sand` header (uppercase overline labels), 1px `border` row dividers, row hover `sand`/60. Numeric columns right-aligned, tabular figures.
- **States:** loading (skeleton rows) · empty (EmptyState) · error (ErrorState) · row hover/selected.
- **A11y:** `<th scope>`; when rows are clickable add `role="button"` + `tabIndex=0` + Enter/Space (admin `Table.jsx` gap).
- **Responsive:** table → stacked cards < md; or horizontal scroll with sticky first col for wide financial tables.

## Badge / Status
- **Canonical:** ONE status component (consolidate `common/StatusChip` + `dashboard/ui/StatusBadge` + `admin/ui/Badge`).
- **Spec:** `rounded-full`, semantic `*-bg` + `*-fg`, text-xs 600, px-2.5 py-0.5, optional dot. Category badges use `c-*` tint. Status vocab shared: paid/confirmed/active→success; pending/grace→warning; failed/cancelled→error; info→info; draft/disabled→neutral.

## Navigation
- **Marketing `Navbar`:** surface bg, ink text, `primary` active, soft shadow on scroll, mega-menu `--shadow-3`. Keep strong a11y (aria-expanded/haspopup, ESC, scroll-lock). Retokenize hex; kill the `#ff8244` gradient leg.
- **Dashboard `ConsoleSidebar`** (rail 56px + panel 220px → drawer < lg) and **admin `StackSidebar`** (config-driven push/pop) — keep both (different contexts), share tokens, retokenize ACCENT hex to `c-*`.
- **Active/current:** `aria-current`; focus trap + restore in mobile drawers (already present — keep).

## Tabs / SegmentedControl
- **Canonical:** `dashboard/ui/SegmentedControl`. Underline tabs for content (ServiceDetail), segmented pills for filters. `role="tablist"`/`tab`/`tabpanel`, arrow-key nav, `aria-selected`.

## Modal · Drawer · Sheet
- **Canonical:** `dashboard/ui/Modal`/`Sheet`/`ConfirmSheet`; extract a matching `admin/ui/Modal`+`Drawer` so the bespoke admin drawers (`LeadDrawer`/`ReasonModal`/`FaqModal`/`ReviewDrawer`/`SeoDrawer`) stop re-implementing overlay/focus-trap.
- **Spec:** overlay `rgba(16,24,40,.5)` at `--z-overlay`; panel `surface`, radius 6px, `--shadow-3`, at `--z-modal`. Focus trap + restore, Esc-to-close, click-outside, body-scroll-lock, `role="dialog"` + `aria-modal` + labelled title. Mobile = bottom sheet. Replace `window.confirm`/`prompt` (CustomerBookings) with `ConfirmSheet`.

## Tooltip / Popover
- **Canonical:** ServiceDetail's focusable click-toggle (the good one). **Never hover-only** (fix the booking fee tooltip). Trigger `<button>` + `aria-describedby`/`aria-expanded`, Esc + outside-click, `--shadow-3`, reduced-motion.

## Alert / Toast / Notification
- **Alerts:** semantic `*-bg` panel + `*-fg` icon/title + `--border` tint; `role="status"`/`alert`.
- **Toasts:** top-right stack at `--z-toast`, auto-dismiss + manual close, 180ms.
- **NotifBell** (`DashboardLayout`) is the popover template — skeleton/error-retry/empty all handled; reuse.

## Empty / Loading / Error states
- **Empty:** ONE `EmptyState` (icon + title + body + optional CTA). Consolidate `dashboard/ui/EmptyState` + `admin/AdminEmptyState` + `sales/EmptyState` → one primitive (fix the orange CTA in AdminEmptyState).
- **Loading:** `Skeleton`/`SkeletonCard`/`SkeletonText` for content; `PetalSpinner` for brand/route loaders; `aria-busy`. Every data view needs a skeleton (gap: `Availability`).
- **Error:** `ErrorState` with retry (`role="alert"`). Never swallow fetch errors silently (gap: `Availability`).

## Pagination
- **Canonical:** `guest/Pagination` (good a11y: `aria-current`, `rel=prev/next`, crawlable `<Link>`). Retokenize the founder-palette hex → `c-*`; neutralize the "Sloooth" wordmark.

## Search / Filter
- **Search:** `dashboard/ui/SearchInput` (debounced, clear button, `role=search`).
- **Filter:** `admin/ui/AdminFilters` (config-driven builder) — the standard; reuse instead of bespoke filter bars.

## StatCard (KPI tile)
- **Canonical:** unify `dashboard/ui/StatCard` + `admin/ui/StatCard`. Spec: `surface` card, overline label, `font-heading` number (tabular), optional delta ▲/▼ in success/error, optional sparkline, optional click → focus ring. Dashboard overview's local `Stat` tile migrates to it.

## Charts / Analytics
- **Canonical:** `EarningsTrendChart.jsx` pattern (hand-built responsive SVG, ResizeObserver, `role="img"` + aria-label, empty state, prev-period dashed compare). Standardize: series colors = `c-*` order (blue→emerald→violet→amber→pink→cyan), axes/grid `--border`, labels `text-muted`, value line `primary`. Extract shared chart primitives (axis, tooltip, legend) as more charts appear. Move the chart out of `fb-card` into `Card`.

---

## Component state matrix (every interactive component must define)

| State | Requirement |
|---|---|
| Default | tokenized rest style |
| Hover | darken via `*-dark` token (never orange), ≤150ms |
| Focus-visible | `--focus-ring` (3px blue, 2px offset) — mandatory |
| Active/pressed | subtle translate or darken |
| Disabled | opacity-50, no pointer, `aria-disabled` |
| Loading | spinner + `aria-busy`, label retained |
| Selected/current | `aria-current`/`aria-selected` + token highlight |
| Error (inputs) | `error-fg` border + `aria-invalid` + described hint |

→ Phase A establishes the tokens these consume + fixes the shared-component orange. Phases B/C migrate pages onto the canonical components.
