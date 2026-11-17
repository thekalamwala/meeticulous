# Free → Pro, Slice 1: commission lever + ProTeaser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the commission-paid number into the sharpest free→Pro nudge (brand-correct, attributed, blunt-when-past-price) on both Home and the Earnings page, and extract the shared `ProTeaser` the later cap-page slices depend on.

**Architecture:** One new presentational component (`ProTeaser`) for the blur+overlay+attributed-CTA pattern. Rebrand and extend the existing `CommissionMeter` (new copy logic + `src` prop + session dismiss), then mount it on `Earnings.jsx` reading the same `getHostNudges().commissionPaid` Home already uses. No server, no data-model change.

**Tech Stack:** React 18 + Vite, Tailwind (brand tokens), Vitest + Testing Library, react-router-dom v6.

**Spec:** `docs/superpowers/specs/2026-11-14-free-to-pro-conversion-design.md`

## Global Constraints
- Brand tokens only — maroon/cream/blush/rose/marigold, rounded (`rounded-md`/`-xl`/`-full`), `font-display`/`font-sans`. No `primary`/gray literals, no new hex.
- Pro yearly price is `PREMIUM_PLAN.yearly` (1179) from `data/plans.js` — never hardcode 1179.
- Every upgrade CTA points to `/dashboard/upgrade?src=<surface>` (UpgradePlan reads `?src`).
- Meter shows ONLY to free-plan hosts (`isFreePlan(user.plan)`) with `commissionPaid > 0`.
- Session dismiss uses `sessionStorage`, wrapped in try/catch (never throws).

## Review Focus
- `commissionPaid` exactly equal to `PREMIUM_PLAN.yearly` → boundary: treat as NOT-yet-past-price (gentle), blunt only when strictly greater. (Task 2 test.)
- `sessionStorage` throws / unavailable (private mode) → dismiss still works, meter renders. (Task 2 test.)
- Non-free host or `commissionPaid <= 0` → meter renders nothing on Earnings too. (Task 3 test.)
- `ProTeaser` with no `src` → CTA must still be a valid upgrade link, not `/dashboard/upgrade?src=undefined`. (Task 1 test.)
- Blurred sample content is `aria-hidden` so screen readers don't read fake numbers as real. (Task 1 test.)

---

### Task 1: `ProTeaser` shared component

**Files:**
- Create: `client/src/components/dashboard/ProTeaser.jsx`
- Test: `client/src/components/dashboard/ProTeaser.test.jsx`

**Interfaces:**
- Produces: `ProTeaser({ children, title, sub, ctaLabel = 'Upgrade to Pro', src, dismissible = false })` — default export. Renders `children` blurred + `aria-hidden`, a translucent overlay card (`title`, `sub`, CTA `Link`), CTA href `` `/dashboard/upgrade${src ? `?src=${src}` : ''}` ``.

- [ ] **Step 1: Write the failing test**

```jsx
// renders blurred aria-hidden sample + an attributed upgrade CTA
it('overlays an attributed upgrade CTA on blurred aria-hidden sample', () => {
  render(<MemoryRouter><ProTeaser title="See what converts" sub="Upgrade" src="crm">
    <div>SAMPLE</div></ProTeaser></MemoryRouter>);
  const cta = screen.getByRole('link', { name: /Upgrade to Pro/i });
  expect(cta).toHaveAttribute('href', '/dashboard/upgrade?src=crm');
  // sample is present but hidden from AT and blurred
  const sample = screen.getByText('SAMPLE');
  expect(sample.closest('[aria-hidden="true"]')).not.toBeNull();
});

it('omits the query when no src is given', () => {
  render(<MemoryRouter><ProTeaser title="t" sub="s"><div>X</div></ProTeaser></MemoryRouter>);
  expect(screen.getByRole('link', { name: /Upgrade to Pro/i }))
    .toHaveAttribute('href', '/dashboard/upgrade');
});
```

- [ ] **Step 2: Run test, verify it fails** — `cd client && npx vitest run src/components/dashboard/ProTeaser.test.jsx` → FAIL (module not found).
- [ ] **Step 3: Implement `ProTeaser`** in `client/src/components/dashboard/ProTeaser.jsx`. Blur wrapper `pointer-events-none select-none blur-[3px]` + `aria-hidden="true"`; overlay `absolute inset-0 grid place-items-center bg-cream/55 backdrop-blur-[2px]`; card uses brand tokens (`font-display` title `text-maroon`, `text-ink/60` sub, CTA `rounded-full bg-maroon text-white`). Model it on `ConversionFunnel.jsx`'s overlay markup. Container `relative overflow-hidden rounded-2xl border-2 border-maroon/15 bg-white`.
- [ ] **Step 4: Run test, verify pass.**
- [ ] **Step 5: Commit** — `feat(convert): add shared ProTeaser blur+overlay upsell`.

---

### Task 2: Rebrand + extend `CommissionMeter`

**Files:**
- Modify: `client/src/components/dashboard/CommissionMeter.jsx`
- Test: `client/src/components/dashboard/CommissionMeter.test.jsx` (exists — extend)

**Interfaces:**
- Consumes: `PREMIUM_PLAN` from `../../data/plans`.
- Produces: `CommissionMeter({ commissionPaid, isFree, src = 'commission' })` — adds `src`; dismissible for the session.

- [ ] **Step 1: Write the failing tests** (add to the existing file)

```jsx
it('is blunt once paid exceeds the Pro yearly price', () => {
  render(<MemoryRouter><CommissionMeter commissionPaid={2340} isFree src="earnings" /></MemoryRouter>);
  expect(screen.getByText(/more than Pro costs/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /keep every rupee|go pro|see plans/i }))
    .toHaveAttribute('href', '/dashboard/upgrade?src=earnings');
});

it('stays gentle at or below the Pro yearly price (boundary = gentle)', () => {
  render(<MemoryRouter><CommissionMeter commissionPaid={1179} isFree /></MemoryRouter>);
  expect(screen.queryByText(/more than Pro costs/i)).toBeNull();
});

it('hides for the session when dismissed', () => {
  render(<MemoryRouter><CommissionMeter commissionPaid={5000} isFree /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
  expect(screen.queryByText(/commission/i)).toBeNull();
});
```

- [ ] **Step 2: Run test, verify new ones fail.**
- [ ] **Step 3: Implement.** Keep the early returns (`!isFree` / `paid <= 0` → null). Add session-dismiss state seeded from `sessionStorage.getItem('cm_dismissed')` (try/catch, default false); a `button aria-label="Dismiss"` sets it + writes the key. Copy: blunt when `paid > PREMIUM_PLAN.yearly` ("You've paid ₹X in commission — more than Pro costs (₹1,179/yr). Go Pro and keep every rupee."), else gentle ("You've paid ₹X in commission. Pro charges 0% — keep every rupee."). CTA `Link to={`/dashboard/upgrade?src=${src}`}`. Rebrand to tokens: container `rounded-md border-2 border-maroon/15 bg-blush`, icon `text-maroon`, title `text-ink`, CTA `rounded-full bg-maroon text-white`. Rupee helper unchanged.
- [ ] **Step 4: Run test, verify pass** (`npx vitest run src/components/dashboard/CommissionMeter.test.jsx`).
- [ ] **Step 5: Commit** — `feat(convert): blunt, attributed, brand-correct commission meter`.

---

### Task 3: Mount `CommissionMeter` on the Earnings page

**Files:**
- Modify: `client/src/pages/Earnings.jsx`
- Test: `client/src/pages/__tests__/Earnings.commissionMeter.test.jsx` (create)

**Interfaces:**
- Consumes: `CommissionMeter` (Task 2), `getHostNudges` from `../services/api`, `isFreePlan` from `../utils/themeUtils`, `useAuth`.

- [ ] **Step 1: Write the failing test** — mock `getHostNudges` → `{ data: { commissionPaid: 3000 } }`, `useAuth` → free host; assert an upgrade link with `href="/dashboard/upgrade?src=earnings"` appears. Mirror the mock setup in `tests/Dashboard.test.jsx`.
- [ ] **Step 2: Run test, verify it fails.**
- [ ] **Step 3: Implement.** In `Earnings.jsx` add a `commissionPaid` state loaded from `getHostNudges()` (non-blocking, `.catch(()=>{})`, same pattern as Dashboard.jsx:454) and render `<CommissionMeter commissionPaid={commissionPaid} isFree={isFreePlan(user?.plan)} src="earnings" />` near the top of the page body. Reuse `useAuth` for `user`.
- [ ] **Step 4: Run test, verify pass.**
- [ ] **Step 5: Commit** — `feat(convert): surface the commission meter on Earnings`.

---

### Task 4: Verify the slice

- [ ] **Step 1:** `cd client && npx vitest run src/components/dashboard/ProTeaser.test.jsx src/components/dashboard/CommissionMeter.test.jsx src/pages/__tests__/Earnings.commissionMeter.test.jsx src/tests/Dashboard.test.jsx` → all pass (Dashboard.test guards the Home meter still renders).
- [ ] **Step 2:** `npx vite build` → clean.
- [ ] **Step 3:** Push branch `feat/free-to-pro-slice1`, open PR against `release/2026-11`. Stop at PR.
