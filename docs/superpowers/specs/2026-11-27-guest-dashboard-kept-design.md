# Guest dashboard facelift — Kept for `/user/*`

**Date:** 2026-11-27 · **Status:** design, pending founder approval of this doc
**Decisions by the founder (2026-11-27):** scope B (restyle + restructure) · approach A (one
shared shell) · live from day one, no flag · Rewards = real spend progress (option A) · ended
sessions keep their "did it happen?" buttons on the list row.

## 1. Why

The host dashboard moved to **Kept** (approved 2026-11-25, all pages merged to `release/2026-11`
on 2026-11-26). The guest console (`/user/*`) did not. It still wears the pre-Kept "Host Lab"
look that Kept explicitly reversed: 2px-bordered cards at 8px radius, 10.5–11.5px text,
uppercase labels, pill links, a cream rail with a text wordmark, and a hand-built shell
(`GuestLayout` / `GuestSidebar` / `GuestTabBar`) that shares nothing with the host shell.

A host can sign into their guest space too (dual login, PR #900). Today they cross from one
product into what looks like another. Goal: **the guest console looks and behaves like the
host console**, with guest-appropriate contents, so the two can never drift apart again.
Invoices, Profile, Reviews and Rewards are the features guests actually get — they are first-
class destinations, designed and live on day one.

## 2. Goals, non-goals, anti-goals

**Goals**
- Guest console uses the same shell as the host Kept dashboard (rail, topbar, phone tab bar,
  More sheet, page transitions, pull-to-refresh).
- Every guest page follows `design-system/BRAND_RULES.md` › *Product UI — Kept* (cream page +
  borderless white 24px cards, one InsightBand, 12px text floor, no uppercase labels except the
  band eyebrow, 12px control radius, hover only tints).
- A real booking-detail screen.
- Rewards shows the guest's **real** spend and tier progress.
- Everything ships to guests together, on day one.

**Non-goals**
- New guest features: a "My purchases" page for digital products, following hosts, discovery.
- Rewards perks actually applying (checkout discounts, scratch cards, promo codes). That
  touches pricing + checkout and is its own project.
- Guest in-app notifications (no guest feed exists; `useHostNotifications` is host-only). No
  bell on the guest topbar.
- Any server change. Emails keep linking to `/user/my-bookings` (see §9).

**Anti-goals (a failure even if it works)**
- Any visible change to the host dashboard.
- A second copy of the shell that can drift (how we got here).
- Renaming or removing a `/user/*` route, or breaking the old flat paths (`/my-bookings`, …)
  and in-flight email links.
- A half-finished guest console reaching prod.
- Any "credits" / stored-value balance for guests — breaks the no-wallet rule. Rewards copy
  must not promise one.

## 3. Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A ✅** | **One shared shell.** `DashboardLayoutV2` and `KeptTabBar` take an optional config; host keeps its defaults, guest passes its own. | Can't drift; dual-login sees one product; host polish reaches guests free. Costs: touches host shell files (guarded by `navParity` tests; pre-push runs the full suite). |
| B | Extract shared building blocks (Rail, Topbar, TabBar, MoreSheet) used by two thin shells. | Cleanest code, but a bigger refactor of a host shell that just shipped, for no visible gain over A. |
| C | Restyle `GuestLayout` by hand, reuse only `v2.jsx` primitives. | Zero host risk, fastest. Two shells again — the exact failure we are fixing. |

**Picked: A** (founder delegated the pick). Only A makes "the consoles agree" structural.

**Rollout considered:** a `guest_v2` flag (host precedent) vs. **one feature branch merged
whole**. Founder wants it public from day one, so no flag: no duplicate V2 page files, no flag
row, the old guest shell is deleted in the same change.

## 4. Information architecture

```
Desktop rail (232px, Kept)          Account menu (avatar, top-right)
  Home      /user                     Profile   /user/profile
  Bookings  /user/my-bookings         Help      /user/chat   (support chat)
  Library   /user/courses             Hosting|Guesting switch (dual accounts only)
            /user/memberships         Log out
  Invoices  /user/invoices
  Reviews   /user/reviews
  Rewards   /user/loyalty

Phone tab bar: Home · Library · ( Bookings ) · Invoices · More
More sheet:    Reviews · Rewards · Profile · Help
Topbar:        logo (phone) · greeting on Home · Help lifebuoy · avatar   — no bell
```

- **Library** = one rail row with in-page tabs (`SubNav`): *Courses* `/user/courses` ·
  *Memberships* `/user/memberships`. Both routes stay; the row is active on either.
- **"Chat" is renamed "Help"** everywhere. It is support chat with Meeticulous, not chat with a
  host. Route `/user/chat` unchanged.
- **New route:** `/user/my-bookings/:id` — booking detail. The only route added.
- All existing routes and the flat redirects in `App.jsx` stay.

## 5. Pages

### Home `/user` (mirrors host Today's order)
1. Topbar greeting: "Good evening, {first name}" (same `greetingFor` as host).
2. **InsightBand** (blue axolotl on the ee), first matching state wins:
   - **Ended session awaiting the guest** (`canConfirm`): "Did your session with {host} happen?"
     → [Yes, it did] [Report a problem]. Most urgent: it's the guest's dispute window before the
     ~24h auto-release.
   - **Next upcoming booking:** eyebrow "Your next session · in 3 days", title = service, sub =
     "with {host} · {date, time}", actions: **Join** (if `meeting_link`) + **Reschedule** (same
     rule `CustomerBookings` uses). Band links to the booking detail.
   - **None upcoming, has a past booking** with `host.username` + `svc.slug`: "Book again with
     {host}" → `/{username}/booking/{slug}` (the existing Rebook target).
   - **Never booked:** "Find your first session" → `/explore`.
3. **4 metric tiles** (`Tile`; 2×2 phone, 4 across desktop): Upcoming, Completed, Memberships
   (active), Courses (purchased). **No tile mascots** — Today's multi-mascot exception is host-only.
4. **Recent bookings** — up to 5 rows in one white card, hairlines between, row → detail.
5. No quick-links block (the rail holds them).

Data: `getGuestBookings`, `getMySubscriptions`, `getPurchasedCourses` — all existing. Skeletons
until each call returns; a failed call says "Couldn't load" in its slot, never `0`.

### Bookings `/user/my-bookings`
- Heading "Bookings". Dropdown → tabs: **Upcoming** (default) · **Past** · **Cancelled**.
  - Upcoming = `isUpcoming` as today. Cancelled = cancelled/canceled.
  - **Past** = everything else whose time has passed: completed, but also confirmed+paid awaiting
    the guest (`canConfirm`), pending and no_show. (The old `status === 'completed'` filter would
    hide the confirm/dispute cases.)
- One white card, hairline rows: date block, service, host, status, amount. Row → detail.
- **Inline row actions, only when they apply** (founder, 2026-11-27):
  - Ended session awaiting the guest: *"Did your session with {host} happen?"*
    [Yes, it did] (`guestCompleteBooking`) · [Report a problem] (`guestReportProblem`).
  - Completed, still within the report window (`canReportCompleted`): [Didn't happen? Report].
  - Upcoming with a meeting link: [Join].
  - Any other row: no buttons, just the link to detail.
  Behaviour and endpoints unchanged; only the wording of "Confirm completed" changes.
- No hero card (Home owns it). No band. Empty states use the axolotl, keep the `/explore` CTA.

### Booking detail `/user/my-bookings/:id` (new)
Replaces `DetailsModal` **and** carries every row action (the modal never had confirm/report):
phone = pushed screen with back; desktop = page in the shell.
- Summary: service, host (link to their page), date & time, duration, booking ID, amount
  (`amountPaid`), status.
- Actions, same rules as today: Join, Reschedule (`RescheduleModal`), Cancel, the "did it
  happen?" pair, Didn't happen? Report, Review (`ReviewModal`), Download invoice
  (`downloadInvoice`), Rebook.
- Data: find the id in `getGuestBookings()` (no new endpoint). Unknown / not-yours id →
  "Booking not found" + link back to Bookings.

### Library `/user/courses` · `/user/memberships`
- Heading "Library" + `SubNav` tabs. Courses: thumbnail cards, borderless 24px, 2-up desktop /
  1-up phone. Memberships: hairline rows in one card; Cancel keeps `ConfirmSheet` + its copy.
  Empty state: green sprout.

### Invoices `/user/invoices`
One white card, hairline rows: date, what it was for, invoice no., amount, download. Same data
(`getMyInvoices`) and download path as today. Empty state: orange panda.

### Profile `/user/profile`
Kept form: grouped fields in white cards, 12px-radius controls, one primary Save. Same fields,
same API. No mascot.

### Reviews `/user/reviews`
Reviews the guest has left: one card, a row per review (host, service, stars, text, date).
Same data and edit/delete behaviour as today. Empty state points to Past bookings to review.

### Rewards `/user/loyalty` — real progress (founder, option A)
- **InsightBand** (purple star): "You've spent ₹{spent}. ₹{gap} to {next tier}." with a progress
  bar; at the top tier: "You're {tier}." Small print: "Based on your paid bookings."
- **Tier ladder**: Bronze → Silver → Gold → Platinum with thresholds; the guest's current tier is
  marked, passed tiers ticked.
- **Perks**: listed per tier, each marked "Unlocking soon". No perk is applied.
- **Spend** = sum of `customer_total` over the guest's bookings with `payment_status === 'paid'`
  (refunded excluded), from `getGuestBookings()` — no new endpoint. Courses and memberships are
  not counted yet (their amounts aren't in a guest feed); the small print says so.
- **Perk copy fix:** Silver's "5% back as credits" implies a stored balance (no-wallet rule).
  Reword as a discount, e.g. "5% off your bookings", still marked "Unlocking soon".
- Tier thresholds stay the constants in `Loyalty.jsx` (placeholder values, admin-tunable later).

### Account menu (guest)
Kept `ProfileMenu` look, guest contents: identity head (name, email), Hosting|Guesting switch
(only when `isHost(user)`, same `setMode` + navigate as today's `GuestLayout.AccountMenu`),
Profile, Help, Log out. No plan badge, KYC row or setup checklist.

## 6. Mascots
One per screen, in bands and empty states only, never beside a number or in a list row.
Blue axolotl = Home / Bookings · green sprout = Library · orange panda = Invoices · purple star =
Rewards. 400px sources in `client/public/about/mascot-*.png`.

## 7. Build shape (approach A)

- **`DashboardLayoutV2`** gains an optional `config` prop. Omitted → today's host behaviour
  unchanged (sections from `visibleSections`, `GROUPS`, host `ProfileMenu`, bell, help →
  `/dashboard/chat`, home → `/dashboard`). Guest passes: `home`, `sections`, `groups`, `badges`,
  `helpTo`, `accountMenu` (element), `showBell: false`, `greetOn` (path).
- **`KeptTabBar`** gains the same kind of optional config: `sections`, tab `order`, `centreId`,
  `sheetOrder`, `icons`, `sub` lines, `helpTo`. Omitted → host unchanged.
- **Guest nav model** (`guestNav.js`): sections shaped like `NAV_V2`
  (`{ id, label, items: [{ to, label, badgeKey? }] }`) so `resolveActive` / `firstItemTo` work.
  Library = one section, two items, shown as a **leaf row**. That needs one small shared-rail
  change: `isLeafSection` (`ConsoleSidebar.jsx`) treats a 2-item section as expandable, so add an
  opt-in `section.leaf: true` it honours. Host sections never set it.
- **Routing:** `App.jsx` guest block wraps in `DashboardLayoutV2` with the guest config; adds
  `/user/my-bookings/:id`. Old `GuestLayout`, `GuestSidebar`, `GuestTabBar` are deleted once
  nothing imports them (`GuestConsolePreview` at `/preview/guest` imports `GuestSidebar` — delete
  that prototype page too, or repoint it; builder's call).
- **No flag.** All PRs stack on one feature branch `feat/guest-kept`; it merges into
  `release/2026-11` (or the then-open train) only when complete, so a `/ship-release` can never
  ship half of it.
- **Local preview:** extend `src/dev/dashPreview.js` with guest fixtures (upcoming with meeting
  link, ended awaiting confirm, completed, cancelled; 1 membership; 2 courses; 2 invoices; 1
  review) behind `VITE_DASH_PREVIEW=1`.

## 8. Delivery (stacked on `feat/guest-kept`, then one merge to the release train)
1. Shell: config props, `guestNav.js`, `isLeafSection` opt-in, guest account menu, routing,
   preview fixtures. Host unchanged (tests prove it).
2. Home.
3. Bookings + booking detail.
4. Library.
5. Invoices, Profile, Reviews.
6. Rewards (real spend progress).
7. Delete old guest shell, polish, device QA on a real phone → merge `feat/guest-kept` to the train.

## 9. Constraints
- `BRAND_RULES.md` Kept section + checklist; tokens only, no hexes.
- No route renamed; all `/user/*` and flat redirects keep working.
- `GuestRoute` gating unchanged. It admits any signed-in user, hosts included (dual login); the
  "host is bounced" comment above the guest block in `App.jsx` is stale — fix the comment.
- Emails keep linking to `/user/my-bookings`. Pointing them at `/user/my-bookings/:id` is a
  server follow-up after ship.
- Pre-push hook runs the full client suite when shell files change (~60 min). Founder has
  approved `--no-verify` with CI as the gate for shell PRs before; ask per PR.
- Client vitest with `--maxWorkers=2`; worktrees need `node_modules` junctions + `client/.env`.

## 10. Tests that must exist
- Host shell unchanged: existing `navParity` tests pass untouched; `DashboardLayoutV2` /
  `KeptTabBar` with no config render the host rail and tabs.
- Guest nav: every `/user/*` route is reachable from rail, account menu or More sheet.
- `isLeafSection` honours `leaf: true`; host sections unaffected.
- Booking detail: found / not found; action visibility follows today's rules.
- Row actions: the "did it happen?" pair shows only for `canConfirm`; Join only for upcoming
  with a link.
- Past tab includes `canConfirm`, pending and no_show bookings.
- Home band state selection (awaiting confirm → next session → book again → explore).
- Rewards spend: paid counted, refunded/unpaid/free excluded; tier + gap at each threshold.

## 11. Left to the builder
Exact config prop shapes; sharing `greetingFor`; tile icons; skeleton shapes; SubNav highlight on
Library; empty-state copy within brand voice; what to do with `GuestConsolePreview`.
