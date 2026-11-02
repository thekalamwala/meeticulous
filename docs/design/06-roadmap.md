# Technical Implementation Plan & Roadmap — Meeticulous

_Deliverables 7 + 8. How the design system is implemented in the existing stack, and the phased, risk-managed rollout with acceptance criteria. Follows the current React 18 + Vite + Tailwind + CSS-vars architecture — no new runtime dependencies._

---

## Part 1 — Technical approach

**Constraints (non-negotiable).** Preserve all business logic, APIs, routes, auth, data contracts, and the build/deploy pipeline. No new deps. No duplicate/competing component systems. Incremental over big-bang. Per CLAUDE.md: work on a branch, open a PR, do **not** merge (founder controls prod timing).

**Source of truth.** Tokens live in `design-tokens.css` `:root`. Target end-state: `tailwind.config.js` *references* the vars so a color changes in one place.
- **Gotcha (why this is phased, not immediate):** Tailwind's `/opacity` modifier (`bg-primary/10`, `ring-primary/40`) needs the channel-split `<alpha-value>` form, not a raw-hex `var()`. Flipping existing tokens to `var(--primary)` naively would break the many `/opacity` usages. So **Phase A keeps existing Tailwind tokens as literal hex** (adds only new ones) and fixes the CSS-var side to match; the var-reference refactor (with proper `rgb(<channels> / <alpha-value>)` setup) is **Phase B**, behind a build check.

**Component convergence.** Three good libraries (`dashboard/ui/*`, `admin/ui/*`, marketing CSS-var templates) converge onto one `components/ui/` core over Phases C+ — migrate, don't rewrite. Keep context-specific shells (`ConsoleSidebar`, `StackSidebar`, `Navbar`).

**The `fb-*` cascade fix is load-bearing.** Before removing any `fb-*` markup, wrap its `@import`s in `@layer legacy { … }` (or migrate the element) so Tailwind utilities can win. Otherwise in-place restyles are dead on arrival.

**Migration discipline.** Hex→token is opportunistic (touch a file for another reason → tokenize it) except where batched below. Every phase ends green on `npm run build` + `npm test` + a visual spot-check.

---

## Part 2 — Phased roadmap

### Phase A — Foundation _(THIS PR — low risk, high value)_
**Goal:** one coherent token foundation + remove the live dead-orange from shared code. No intended rendered change except: orange→blue (brand-correct) and two restored-by-bugfix styles.
- **Changes:**
  1. `design-tokens.css` — re-head (drop "Friendly Brutalism"); **define the 2 undefined vars** (`--radius-control: 4px`, `--shadow-soft: 0 8px 30px rgba(23,32,51,.05)` → fixes input radius + `.page-card` shadow); add the soft elevation scale (`--shadow-sm/1/2/3`), `--action`/`--action-dark`, semantic `*-fg`/`*-bg` (success/warning/error/info), neutral/text ramp + `--border`/`--border-strong`, `--focus-ring`, `--z-*` scale, `--motion-slow`/`--ease-out`; correct `--color-primary-dark` (#005E99) + unify `--color-muted`. Keep legacy vars (`--shadow-hard-*`, `--border` ink, `--secondary`, `--accent`) defined for now (still consumed by `fb-*`) but mark deprecated.
  2. `index.css` — **de-orange globals**: the 4 `rgba(254,81,0,…)` focus-visible/input-focus/`::selection`/`.btn-primary`-shadow → `--focus-ring` blue.
  3. `tailwind.config.js` — **add** new tokens only (`action`, `action-dark`, `success/warning/error/info` + `-bg`) as literal hex. Don't touch existing tokens (protects `/opacity`).
  4. Shared-component orange: `admin/ui/Btn.jsx` + `admin/AdminEmptyState.jsx` hover `#e54900`→`primary-cta`; `dashboard/ui/Form.jsx` Select chevron `%23FE5100`→blue.
  5. Conversion-path orange (safe hover/gradient swaps): `Explore.jsx`, `guest/ServiceCard.jsx` (`#a83400`), `ServiceForm.jsx` (`#e04800`), `ManageBooking.jsx`/`CustomerBookings.jsx` (`#e64800`/`#e04800`), `CustomerBookings`/`Loyalty` gradient leg + `Navbar.jsx` gradient (`#ff7a3c`/`#ff8244`), `BotWidget` peach tints.
  6. `docs/design-system.md` — fix stale facts (orange→blue, brutalist→soft, radius 12/24→4/6) + point to `docs/design/`.
- **Files:** ~12–15. **Risk:** low (additive tokens + hover-color swaps + 2 bugfixes). **Deps:** none.
- **Acceptance:** `npm run build` + `npm test` green; grep shows 0 dead-orange hover literals in shared `Btn`/`Form`/`AdminEmptyState` + the listed funnel files; inputs show 4px radius + `.page-card` shows a soft shadow (bugs fixed); focus ring is blue everywhere; no visual regression on a browser spot-check of Home/booking/dashboard/admin.

### Phase B — Core experience _(next PR)_
**Goal:** one source of truth + de-orange the rest + fix the cascade + unblock `fb-*` removal.
- Flip Tailwind color tokens to reference CSS vars using the `rgb(<channels> / <alpha-value>)` pattern (preserves `/opacity`); resolve `secondary`/`muted` conflicts.
- Wrap `fb-*` `@import`s in `@layer legacy {}` (removes the cascade trap).
- Tokenize global chrome hex→token, lowest-risk first: Footer (done) → RouteErrorBoundary → ErrorLayout → Navbar → BotWidget.
- Replace stale warm-cream canvas (`#f7f5ef`/`#fdfcf9`) with `canvas` across guest/dashboard/help.
- Rebuild `Contact` form on `dashboard/ui/Form`; migrate onboarding off `fb-*` to `dashboard/ui` + one stepper.
- **Risk:** med (token-reference refactor + chrome). **Deps:** A. **Acceptance:** build/test green; `/opacity` utilities still render; 0 `rgba(254,81,0)`/orange hex app-wide; onboarding/Contact use shared primitives.

### Phase C — Advanced components
**Goal:** converge components + finish states.
- Unify `dashboard/ui` + `admin/ui` into `components/ui/` core (Button/Input/Card/Table/Badge/Modal/Drawer/EmptyState/StatCard).
- `Bookings`→`DataTable`; extract `AdminModal`/`Drawer`; one `EmptyState`; one status component; shared admin status/chart palette module.
- Bespoke marketing: extract opt-in `SectionHeader`/`FaqAccordion`/`FinalCta`/`Testimonials`; normalize radii; replace brutalist CTA shadows.
- Begin `fb-*` markup removal (admin/sales first; `fb-input` last).
- **Risk:** med (broad, incremental). **Deps:** B. **Acceptance:** build/test green; `fb-*` count trending to 0; no duplicate status/empty components.

### Phase D — Responsive & accessibility
**Goal:** verified AA + keyboard across the app.
- `getContrastColor` → real 4.5:1 clamp (host-theme a11y fix).
- Keyboard: admin `Table` row handler; booking fee tooltip focusable; calendar-day `aria-label`s; `window.confirm/prompt`→Modal.
- Add missing states (`Availability` skeleton/error); audit focus rings on bespoke marketing pages.
- Mobile: verify sidebar drawers, table→card collapse, booking 2-col, 44px targets.
- **Risk:** low–med. **Deps:** C. **Acceptance:** axe/contrast pass on key journeys; full keyboard traversal of booking + dashboard + one admin page; mobile spot-check.

### Phase E — Validation _(continuous + final)_
- `npm test` (client vitest + server jest), `npm run build`.
- Visual regression spot-check (browser preview) of: Home, Pricing, HostProfile, ServiceBooking (all steps), Dashboard, one admin page — before/after per phase.
- Verify business journeys intact: book+pay (test mode), host login, admin login.
- Console-error + network check; responsive (mobile/tablet/desktop).
- Produce `07-validation-report.md` per phase (tests run, results, unresolved, limitations).

---

## Non-design items escalated to the founder (not auto-fixed)
1. **Fabricated social proof** on ServiceDetail payment page (trust/legal) — remove or wire to real data?
2. **Dead-brand cleanup** (old-brand handles, old-brand "Pro" copy, old-brand wordmarks) — this initiative or a separate rebrand ticket?
3. **Bespoke marketing strategy** — keep per-page designs + add primitives (recommended) or consolidate harder?

## Risk register
| Risk | Mitigation |
|---|---|
| `/opacity` breakage on var-reference | Phase B uses channel-split pattern + build check; Phase A keeps literal hex |
| `fb-*` cascade defeats restyle | Fix `@layer legacy` before any removal (Phase B) |
| Deleting a legacy var breaks `fb-*` | Keep `--shadow-hard-*`/`--border`/`--accent`/`--secondary` until `fb-*` markup is gone |
| Broad hex sweep → visual regression | Opportunistic + per-file; spot-check each phase |
| Prod timing | Stop at PR; founder merges |
