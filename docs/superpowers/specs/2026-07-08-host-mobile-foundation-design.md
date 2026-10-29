# Host Mobile Foundation — Design Spec

**Date:** 2026-07-08
**Branch:** `feat/host-dashboard-ui`
**Status:** Approved (design shape)
**Source audit:** [`docs/host-dashboard-ui-audit.md`](../../host-dashboard-ui-audit.md) — Parts A–E

## Goal

Build the missing interaction primitives from the Host Mobile Design System (audit Part D) so every host screen can later be made "app-like" by composition, not invention. This is **Phase 1 — Foundation**: additive component library work with **zero visible change** to existing screens. Screen migration is Phase 2 (separate spec).

## Decisions (locked)

- **Foundation first** — build shared primitives before touching any screen.
- **Dark theme deferred** — not in scope. No token/theme work here; handled as its own later project.
- **Split delivery** — Phase 1a unblocks feed screens; Phase 1b covers gesture/confirmation primitives.
- **PageTransition included** — the one edit to an existing file, isolated as a route-outlet wrapper.

## Constraints

- Presentation-layer only. No backend, route, schema, or data-model changes.
- New primitives live in `client/src/components/dashboard/ui/`, exported via the existing barrel `index.js`.
- Match existing conventions: framer-motion v12, `createPortal`, `cn` util, `dash-elev-*` elevation classes, `tokens.css`, spring transitions (~stiffness 320–340 / damping 30–34), `env(safe-area-inset-*)`.
- Respect the jest-dom matcher gap (client vitest): only `toBeInTheDocument` / `toBeDisabled` / `toBeEnabled` / `toBeEmptyDOMElement`; otherwise assert via `getAttribute()`.
- **Do NOT touch** `client/src/pages/services/{ServiceForm,AddService,EditService}.jsx` — owned by in-flight `feat/write-with-bolt` (audit Part E).

## Components

### Phase 1a — feed foundation (unblocks Bookings / Transactions / Payouts / Products lists)

| File | Pattern | Props | Built on |
|---|---|---|---|
| `ErrorState.jsx` | Error State | `{ title, message, onRetry }` | mirrors existing `EmptyState` (no border, icon + text + one CTA) |
| `useInfiniteScroll.js` | — | `(loadMore, { hasMore, loading })` → `ref` | IntersectionObserver sentinel |
| `InfiniteFeed.jsx` | Infinite Feed | `{ items, renderItem, loadMore, hasMore, loading, error, onRetry, empty }` | `useInfiniteScroll` + existing `Skeleton` + `EmptyState` + `ErrorState` |

`InfiniteFeed` is the composition hub: renders `Skeleton` while `loading` and no items, `EmptyState` (from `empty` prop) when settled+empty, `ErrorState`+retry on `error`, and an IntersectionObserver sentinel that calls `loadMore` when `hasMore`.

### Phase 1b — gesture & confirmation primitives

| File | Pattern | Props | Built on |
|---|---|---|---|
| `useLongPress.js` | — | `(onLongPress, { delay=450 })` → handlers | pointer timers |
| `ContextMenu.jsx` | Context Menu | `{ items:[{label,icon,danger,onSelect}], trigger }` | `Overlay.Sheet` (mobile action list) + `useLongPress` |
| `SwipeActions.jsx` | Swipe Actions | `{ children, right:[{label,icon,color,onAction}], left }` | framer-motion `drag="x"` + snap points |
| `PullToRefresh.jsx` | Pull to Refresh | `{ onRefresh: () => Promise, children }` | touch drag + spring, threshold reveal |
| `SuccessState.jsx` | Success State | `{ title, message, action }` | framer-motion check-draw animation |

### Route wrapper (one existing-file edit)

- `PageTransition.jsx` — `AnimatePresence` keyed on `pathname`, slide-in on push nav. Wraps the `DashboardLayout` `<Outlet />`. Host routes only. Wrapper, not markup change.

## Interfaces & isolation

Each primitive is self-contained: known props in, no shared mutable state, composes existing primitives rather than duplicating them. `InfiniteFeed` is the only composite; the rest are leaf components. A consumer can use any one without reading its internals.

## Testing

One vitest render smoke test per non-trivial component (co-located `__tests__` per repo convention, `server/tests`-style not applicable to client). Key assertions:

- `InfiniteFeed`: loading→Skeleton; settled+empty→EmptyState; error→ErrorState+retry button; sentinel intersect→`loadMore` called.
- `SwipeActions`: renders children; action buttons present in DOM.
- `ContextMenu`: long-press/trigger opens sheet; item `onSelect` fires.
- `PullToRefresh`: `onRefresh` invoked past threshold.
- `SuccessState` / `ErrorState`: render title/message; CTA/retry wired.

Trivial one-liners skip tests (YAGNI).

## Verification

Additive components are invisible in the real app until Phase 2. Phase-1 proof:
1. Passing render tests.
2. A throwaway dev route `/dashboard/_ui-gallery` mounting all primitives to eyeball motion/gesture in the browser preview — **deleted before the final commit**.

## Out of scope (Phase 1)

- Dark theme / tokens (deferred).
- Any screen migration or adoption of existing primitives (Phase 2).
- Rebuilding existing patterns (Overlay, ConfirmSheet, Fab, StickyActionBar, SegmentedControl, Skeleton, EmptyState).
- Service-form files (Write with Bolt territory).

## Definition of done

- 6 new components + 2 hooks + PageTransition wrapper, all exported/wired.
- Render tests pass; `cd client && npm run build` clean.
- Gallery route removed; no existing screen visually changed.
