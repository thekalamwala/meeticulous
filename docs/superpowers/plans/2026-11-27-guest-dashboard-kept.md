# Guest dashboard Kept facelift — Implementation Plan

> **For agentic workers:** executed natively in the founder's session ("build it here, fastest").
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put `/user/*` on the host Kept shell and restyle every guest page to Kept.
**Architecture:** `DashboardLayoutV2` + `KeptTabBar` take an optional `config`; `GuestLayout`
becomes a thin wrapper passing the guest config. Pure booking/reward rules live in one model
file with unit tests; pages are rewritten on the `v2.jsx` kit.
**Tech Stack:** React 18, react-router v6, Tailwind (Kept tokens), framer-motion, vitest.
**Spec:** `docs/superpowers/specs/2026-11-27-guest-dashboard-kept-design.md` (PR #465).

## Global Constraints
- No route renamed; `/user/*` + flat redirects keep working. One new route `/user/my-bookings/:id`.
- No flag. Branch `feat/guest-kept` merges to the release train only when complete.
- Kept rules: borderless 24px cards, 12px text floor, no uppercase except band eyebrow, 12px
  control radius, hover tints only, one band + one mascot per screen, tokens only.
- Host shell output unchanged when `config` is omitted.
- No server change. No credits / stored balance wording.

## Review Focus
- Booking with no `services` / host embed (fallback select) → page renders "Service"/"Host", no crash. (Task 2 test: `bucketOf` + `bandState` on bare rows.)
- Free booking (`customer_total` 0) and refunded booking → not counted as spend. (Task 2 test.)
- Booking exactly at `now` / timezone edge → upcoming vs past by `scheduled_at >= now`. (Task 2 test.)
- Detail id not in list (stale link, other guest) → "Booking not found". (Task 4.)
- Dual-login host on `/user` → account menu shows the Hosting|Guesting switch. (Task 1, kept from old menu.)

---

### Task 1: Shell
**Files:** Modify `client/src/components/common/DashboardLayoutV2.jsx`, `KeptTabBar.jsx`;
Create `client/src/components/common/guestNav.js`, `GuestAccountMenu.jsx`; Rewrite `GuestLayout.jsx`;
Delete `GuestSidebar.jsx`, `GuestTabBar.jsx`, `pages/GuestConsolePreview.jsx` (+ its route);
Test `client/src/tests/guestNav.test.js`.

**Interfaces — Produces:**
- `GUEST_SECTIONS`: `[{ id, label, items:[{ to, label, exact?, matchPrefix? }] }]` for
  home `/user` (exact) · bookings `/user/my-bookings` · library `/user/courses`
  (`matchPrefix: ['/user/courses','/user/memberships']`, ONE item ⇒ leaf, no `isLeafSection` change)
  · invoices · reviews · rewards `/user/loyalty`.
- `GUEST_SHELL` config: `{ home:'/user', sections, groups:[{label:'Your space', ids:[…6]}], icons,
  helpTo:'/user/chat', showBell:false, AccountMenu, tabBar:{ order:['home','library','bookings','invoices'],
  centreId:'bookings', sheet:[reviews, rewards, {id:'profile',…}, {id:'help',…}], sub } }`.
- `DashboardLayoutV2({ children, config })`, `KeptTabBar({ config })`.

- [ ] Test: every `/user/*` page route (`/user`, my-bookings, courses, memberships, invoices,
  reviews, loyalty, profile, chat) is reachable from rail sections, tab sheet or account menu;
  `resolveActive('/user/memberships', GUEST_SECTIONS).sectionId === 'library'`.
- [ ] Implement config plumbing; host defaults untouched. Guest account menu = Kept look, contents
  per spec §5 (switch only when `isHost(user)`).
- [ ] Run `npx vitest run src/tests/guestNav.test.js src/tests/navParity.test.jsx --maxWorkers=2` → PASS. Commit.

### Task 2: Guest model
**Files:** Create `client/src/pages/guest/guestModel.js`, `client/src/pages/guest/GuestKit.jsx`;
Test `client/src/tests/guestModel.test.js`.
**Produces:** `hostOf(b)`, `isUpcoming(b, now)`, `isCancelled(b)`, `canConfirm(b, now)`,
`canReportCompleted(b, now)` (14-day window), `bucketOf(b, now) → 'upcoming'|'past'|'cancelled'`,
`homeBand(bookings, now) → { kind:'confirm'|'next'|'again'|'first', booking? }`,
`spendOf(bookings) → number` (paid only), `TIERS` (Bronze 0 / Silver 5000 / Gold 15000 / Platinum 40000),
`tierProgress(spent) → { tier, next, gap, pct }`, `amountPaid(b)`, `shortId(id)`, `fmtWhen(iso)`, `relWhen(iso)`.
GuestKit: `BandPrimary`, `BandGhost`, `serif`, `ring`, `useBookingActions(setBookings)`
(confirm/report/cancel handlers + `busyId`), `SessionPrompt({ b, actions })`, `GuestEmpty({ mascot, title, sub, action })`.
- [ ] Tests: past bucket includes canConfirm/pending/no_show; refunded/free/unpaid excluded from spend;
  tier at each threshold (4999→Bronze gap 1, 5000→Silver, 40000→Platinum next null); band order
  confirm > next > again > first; bare row (no services/profiles) doesn't throw.
- [ ] Implement. Run tests → PASS. Commit.

### Task 3: Home — rewrite `pages/GuestOverview.jsx` per spec §5 (band, 4 tiles, recent 5). Build passes. Commit.
### Task 4: Bookings + detail — rewrite `pages/CustomerBookings.jsx` (tabs, hairline rows, inline
row actions), create `pages/GuestBookingDetail.jsx`, route `/user/my-bookings/:id` in `App.jsx`. Commit.
### Task 5: Library — `MyCourses.jsx`, `MyMemberships.jsx` with shared `LibraryHead` (SubNav). Commit.
### Task 6: Invoices, Profile, Reviews restyle (`GuestInvoices.jsx`, `CustomerProfile.jsx`, `CustomerReviews.jsx`). Commit.
### Task 7: Rewards — rewrite `Loyalty.jsx` on `spendOf`/`tierProgress`. Commit.
### Task 8: Verify — `npx vitest run --maxWorkers=2` (client), `npm run build`, preview with
`VITE_DASH_PREVIEW`/fake guest user at 375px + desktop; push; PR `feat/guest-kept` → `release/2026-11`.
