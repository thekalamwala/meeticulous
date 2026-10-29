# Host Dashboard — App-Feel UI/UX Audit

**Branch:** `feat/host-dashboard-ui` · **Date:** 2026-07-08 · **Scope:** entire Host experience (login → onboarding → dashboard → all sub-screens, modals, forms). **Method:** full read of every host-facing file. **Frame:** *Current mobile-friendly website ↔ native app-like experience.* No code changed — this is findings only.

---

## TL;DR

The dashboard is a **well-built responsive website**, not yet a native-feeling app. The primitives layer (`components/dashboard/ui/*`) already ships several genuinely app-like pieces — bottom tab bar, FAB, StickyActionBar, SegmentedControl, ConfirmSheet, spring bottom-sheet Overlay, skeleton loaders. Two screens (**Transactions**, **Bookings**) show what "good" looks like: day-grouped feeds, sticky headers, press states, money-forward rows. The problem is **inconsistency and web-chrome leaking through everywhere else**.

**The 8 recurring website-isms** (each appears on many screens):

1. **Hover-only feedback, no press states.** Buttons/cards/tabs use `hover:` which never fires on touch → elements feel dead on tap. (Everywhere except Fab, ConfirmSheet, Transactions/Bookings cards.)
2. **Modals instead of bottom-sheets.** Booking detail, transaction detail, reschedule, withdrawal, WhatsApp verify, billing, subcategory — all centered web dialogs. The app *has* a spring bottom-sheet (`Overlay.Sheet`, `ConfirmSheet`) but most screens don't use it.
3. **`<select>` dropdowns & `window.confirm` / `window.prompt`** as primary controls — the loudest "this is a browser" tells.
4. **No pull-to-refresh anywhere.** Every screen is load-once-on-mount + error-Retry.
5. **Touch targets < 44px and inputs < 16px font** (iOS focus-zoom). Button `sm`/`icon`, Tabs, all Form inputs, SearchInput.
6. **Toasts as the only feedback channel** for validation *and* success — native prefers inline field errors + committed state + haptics.
7. **Web-grid artifacts carried into mobile:** dual-rendered `<table>`s behind `md:`, numbered pagination, dashed-border dropzones/empty-states, `<dl>` grids.
8. **No page/step transitions.** Route and tab changes hard-swap; framer-motion is already a dep (used in Overlay) but not for navigation.

**Fix these platform-wide first and ~70% of the "it's a website" feeling disappears** without touching any business logic.

---

## Part A — Platform-wide fixes (do these once, everywhere benefits)

| # | Fix | Where it lives today | App target |
|---|-----|----------------------|-----------|
| A1 | Add `active:scale`/`active:bg` press states to every tap target; pair every `hover:` with an `active:` | `ui/Button.jsx:5-10`, `Card.jsx:9`, `StatCard.jsx:24`, `Tabs.jsx:19`, `DashboardLayout.jsx:496` | physical press feedback + optional haptic |
| A2 | Bump touch targets to ≥44px, input font to ≥16px | `Button.jsx:14,17`, `Tabs.jsx:18`, `Form.jsx:13,49`, `Toolbar.jsx:12` | no focus-zoom, thumb-friendly |
| A3 | Route booking/transaction/detail/confirm flows through `Overlay.Sheet` / `ConfirmSheet`, retire centered `Modal` on mobile | `Bookings.jsx:313`, `Transactions.jsx:343`, `Payouts.jsx:47`, `ServicesList.jsx:297`, `UpgradePlan.jsx:257`, `ServiceForm.jsx:361` | bottom-sheets, swipe-to-dismiss |
| A4 | Wire swipe-to-dismiss on the grabber handles (framer-motion `drag="y"`, already a dep) | `Overlay.jsx:54,102`, `DashboardLayout.jsx:171,527` | grabbers are decorative today |
| A5 | Add page/tab transitions (`AnimatePresence` fade/slide on the `<main>` outlet) | `DashboardLayout.jsx:492,547` | tab/route hard-swaps today |
| A6 | Add pull-to-refresh to primary list screens | `DashboardLayout.jsx:547` + each list | none today |
| A7 | Safe-area-top on the sticky topbar (notch collision) | `DashboardLayout.jsx:422` | only bottom insets handled |
| A8 | Replace `window.confirm`/`window.prompt` | `UpgradePlan.jsx:121`, `ServiceForm.jsx:83` | action sheet / inline URL sheet |
| A9 | Slide, don't snap, selection indicators (shared-layout animation) | `SegmentedControl.jsx:31`, `Tabs.jsx:27` | iOS thumb slides |
| A10 | Adopt inline per-field validation (validate on blur, focus first invalid on submit) instead of one-toast-at-a-time | every form (see below) | toasts detached from fields today |

**Already strong — keep and replicate:** bottom tab bar + More sheet (`DashboardLayout.jsx:487-544`), `Fab`, `StickyActionBar`, `SegmentedControl`, `ConfirmSheet`, `Overlay` spring sheet, skeleton loaders, native `<select>` where a wheel picker is fine, `DataTable` card-collapse, KYC live-camera capture with stream cleanup, Transactions `TxCard` feed.

---

## Part B — Screen-by-screen findings

### Navigation chrome — `DashboardLayout.jsx`
Most app-like file in the codebase. Real bottom tab bar (`:487`), portaled More sheet (`:522`), responsive dropdown→sheet menus, body-scroll lock, safe-area bottom.
- `:496,511` tab tap = instant color swap, no press/scale/haptic → native tab press + selection haptic.
- `:492,547` no page transition on tab change → cross-fade the outlet.
- `:422` topbar `top-0` with no safe-area-top → notch collision; add `pt-[env(safe-area-inset-top)]`.
- `:523` More sheet pops in instantly (no framer-motion) → slide up like `Overlay.Sheet`.
- `:171,527` grabber decorative, not swipe-to-dismiss.
- `:335` profile chevron caret is a desktop-dropdown signifier → drop at `<md`.

### Home — `Dashboard.jsx`
Skeleton loader, tappable Stat tiles, "Next session" hero with relative time = good.
- `:49` Stat tiles hover-only, no `active:` press.
- `:64-72` `BookingRow` is a non-tappable `div` — can see a booking but not open it from home → make rows open the detail sheet.
- `:238-278` copy-link uses clipboard+toast → native OS share sheet (`navigator.share`).
- `:420` WhatsApp verify is a centered `Modal` → bottom-sheet.
- `:150` load-once, Retry-only → no pull-to-refresh.

### Bookings — `Bookings.jsx`
`BookingCard` (`:454`) + day-grouped sticky agenda (`:613`) + SegmentedControl with counts = the reference pattern for the app.
- `:454-481` no swipe actions on rows → swipe-left for Cancel/Complete/Reschedule; every action currently needs opening the full modal.
- `:313` detail is a centered `Modal size="xl"` → bottom-sheet, swipe-down dismiss.
- `:681-699` **numbered pagination** (Prev/1 2 3/Next) — clearest web artifact → infinite scroll.
- `:84-251` reschedule = hand-rolled month-grid inside a `size="sm"` modal → full-screen/sheet date-time picker with momentum.
- `:581` always-visible header search box → native hides behind tap/pull-down with cancel.
- `:590` segmented filter isn't sticky — scrolls away → pin it.

### Earnings — `Earnings.jsx`
- `:80-91` revenue-by-service rows are static, not tappable, no drill-down → tappable cards with chevron → per-service breakdown.
- `:87-88` money at `text-sm`/`text-xs` like table cells → large tabular headline figure, count-up.
- `:74-95` no period selector → sticky time-scope segmented control (This month / All time).
- `:26` no pull-to-refresh.

### Services list — `ServicesList.jsx`
Mobile card list (44px targets), FAB, skeleton, segmented+search = good.
- `:158-234` full desktop `<table>` (horizontal-scroll) shipped in parallel → pure web; native shows only cards.
- `:270-289` per-card 4-button grid always visible → swipe-to-reveal / long-press context menu.
- `:88-94` enable/disable round-trips and reloads the whole list → optimistic toggle switch.
- `:297-314` delete uses centered `Modal` — but Products uses `ConfirmSheet` for the same action → **inconsistent**; match the sheet.

### Service form — `ServiceForm.jsx` (highest website-ism density)
- `:521-665` one giant 6-section long-scroll form → stepped/segmented or accordion flow with progress.
- `:465-471` validation only on submit, one toast at a time → inline per-field errors, focus first invalid.
- `:53-117` `contentEditable` editor on deprecated `execCommand` + `window.prompt('URL:')` → native formatting/inline URL sheet; plain markdown likely enough.
- `:329-341` thumbnail crop = fixed canvas + range-slider zoom + single-touch pan, **no pinch** → full-bleed pinch-to-zoom crop.
- `:63-67` no keyboard-avoidance — on-screen keyboard covers the sticky save bar/fields.
- `:560-573` required Category `<select>` silently vanishes when list is empty → tappable picker row; never hide a required field.
- `:361-396` hand-rolled centered subcategory modal → bottom sheet (`ConfirmSheet` exists).

### Add/Edit wrappers — `AddService.jsx` / `EditService.jsx`
- `EditService.jsx:20` loading = plain "Loading…" text → skeleton of the form.

### Products — `Products.jsx`
Most app-like editor: `ConfirmSheet` for delete + discard, dirty guard, FAB.
- `:316-412` add/edit is an **inline toggled form** while Services uses a **full-page route** → pick one create/edit paradigm and apply consistently.
- `:383-398` cover image "Paste URL / Upload" tabs + raw file input → tap thumbnail well → photo library/camera sheet.
- `:365-372` bare native file input with `file:*` styling → labeled upload well with picked filename.
- `:373,399` upload progress = "Uploading…" pulsing text → determinate progress on the thumbnail.

### Availability — `Availability.jsx`
View-mode summary + dirty guard = good.
- `:201-202` **no per-day on/off toggle** — enabling a day = hunting for "Add slot" → trailing toggle switch per day row (biggest gap here).
- `:207-209` `<input type="time">` pairs → wheel/drum time picker in a sheet.
- `:210` "Remove" as red text link → swipe-to-delete / trailing trash.
- `:156-178` timezone/buffer as inline `<Select>` in a card → grouped-list rows ("Timezone ›") that push to a picker.
- `:248-261` blocked dates as raw `YYYY-MM-DD` chips → humanized ("Mon, 14 Jul") list rows, swipe-delete.
- `:266` non-sticky bottom Save → sticky bar / nav-bar Save.
- `:122-148` explicit read-only→edit mode flip is a web-CMS pattern → rows directly editable.

### Profile — `ProfileSetup.jsx`
- `:317-331` underline **web tab-bar** with animated underline; the 6th "Plan" tab actually `navigate()`s away → don't mix in-page tab with nav push; use segmented control or grouped rows that push detail screens.
- `:354-383` avatar/cover = "Click to upload" box → tap → action sheet (Take Photo / Library / Remove); copy says "Click" not "Tap".
- `:494-500` custom color = monospace **hex text input** → color wheel / `<input type="color">`; hex as advanced only.
- `:644-661` integrations as a marketing-style card grid with "Coming soon" pills → grouped list rows (icon·title·subtitle·chevron).
- `:64-86` brand icons fetched from Google favicon service → bundle vector assets (remote flicker/network dep).
- `:427-464` 9 always-visible social URL text boxes → tappable grouped rows.
- `:671` non-sticky Save; mixes raw `<button>` and `<Button>`.

### Upgrade — `UpgradePlan.jsx`
Cadence pill toggle = good.
- `:121` **`window.confirm("Cancel auto-renew?")`** — most jarring web tell → native action sheet with destructive action.
- `:257-299` billing details in a centered `Modal` → bottom sheet from the CTA.
- `:191-250` 3-across pricing-card grid = marketing page → vertical selectable plan rows + single sticky Continue, or swipe carousel.
- `:104,126` purchase outcomes via auto-dismiss toasts (incl. 🎉) → dedicated success state/sheet on the critical payment path.

### Payouts — `Payouts.jsx`
StickyActionBar + responsive stat promotion = good.
- `:71-85,180` withdrawal history as a `DataTable` grid on mobile → full-width list rows (amount lead, status pill) like `TxCard`.
- `:47` withdrawal opens centered `Modal` → bottom sheet / pushed screen.
- `:56` amount = `<input type="number">` with tiny ₹ prefix → large hero amount field, `inputMode="decimal"`, format-as-you-type, reject over-balance live.
- `:72` absolute dates → relative ("2 days ago") like Transactions.

### Transactions — `Transactions.jsx` (reference-quality)
Day-grouped `TxCard` feed, sticky headers, press states, tap-to-copy IDs = the model.
- `:343-345` detail still opens a centered `Modal size="lg"` 2-col grid → pushed full-screen / full-height sheet, single-column, back gesture.
- `:330-341` Prev/Next + "Showing 1-20 of N" → infinite scroll.
- `:271-297` three stacked `<select>` filters → filter chip row / filter sheet (the horizontal-scroll row at `:278` is a decent halfway step).
- `:199-206` invoice "Download" as `<a target="_blank">` → in-app document viewer / share sheet.

### Feedback — `Feedback.jsx`
Chip type-picker with `aria-pressed` = good.
- `:81-84` "Area" is a lone `<select>` right under the chip picker → make it chips too (consistency).
- `:95-97` small left-aligned submit → full-width / pinned.
- `:38` empty-body validation post-submit toast → live-disable submit.

### KYC flow — `kyc/*`
Step-guard, visual stepper, live front-camera capture with stream cleanup = strong bones.
- `KycFlow.jsx:64-80` each step is a `Card` in a `max-w-2xl` column with a "Cancel" text link → full-screen edge-to-edge per step, nav bar with back chevron + × icon.
- `:52` step labels `hidden` below `sm` — mobile shows bare numbered circles → keep "Step 2 of 4 · Bank" text.
- `:25-27` step changes are route swaps, no transition → horizontal push/pop.
- `KycStart.jsx:61`/`KycBank.jsx:43` Aadhaar/account single input, no live grouping/masking → auto-format in groups.
- `KycStart.jsx:64` step 1 has no Back (others do) → consistent nav-bar back.
- `KycSelfie.jsx:74-80` camera preview is a `max-w-xs` thumbnail in a card → full-screen viewport with face-outline guide + shutter; `:78` feed isn't mirrored; `:42-62` no liveness prompt despite "Live selfie".
- `KycDocuments.jsx:38` `<input type="file">` with no `capture` + dashed dropzone → "Take photo" camera path / doc scanner with edge detection; show captured thumbnail.
- `KycHome.jsx:55-60` verified details as `<dl>` grid → grouped inset list rows.
- `KycSubmitted.jsx:13-15` "Schedule a Video KYC" is `<a target="_blank">` leaving the app → in-app webview / native screen.

### Onboarding + login — `HostLogin.jsx`, `onboarding/*`
Paged flow, per-step server saves, route guard, Google-only auth = correct backbone. **`CategoryStep.jsx` is the one screen that already behaves like an app** (fixed `100dvh` shell, scrollable middle, pinned footer) — make it the template.
- `ProgressBar.jsx:11` "33%" numeric percentage = web wizard → segmented dots, no percent.
- `:5` progress bar sits inside page flow under an assumed 72px site navbar → fixed app-chrome region with back chevron, retiring per-screen "← Back" text links.
- All steps wrap content in a `.page-card` centered in `min-h-[calc(100vh-72px)]` → escape the site shell: full-bleed screens, fixed header/footer, scroll only the middle (CategoryStep already does this).
- `HostLogin.jsx:78` two-column brand-panel desktop login grid → single full-screen auth, Google button in thumb zone.
- `SlugClaim.jsx:156` slug input has no `inputMode`/`autoCapitalize=none`/`autoCorrect=off` → mobile keyboard autocapitalizes a URL. (Same class of fix in CategoryStep search, WhatsApp OTP needs `autoComplete="one-time-code"`.)
- `AboutYouStep.jsx:86` two questions on one screen → one-question-per-screen with tap-to-advance.
- `PlansStep.jsx:161` `md:grid-cols-3` pricing table → swipe carousel or pre-selected recommended plan + one sticky CTA.
- `ExploreWithBolt.jsx:43` static web thank-you card → full-screen celebratory moment (confetti/haptic); move "what's next" into a dashboard checklist.
- All steps: buttons ~40px + hover-driven → ≥48px + active states; no inter-step transitions → directional slide.

---

## Part C — Suggested sequencing (functionality preserved throughout)

1. **Primitives pass (A1, A2, A9):** press states, target sizes, sliding indicators. One PR, every screen improves. Highest leverage, lowest risk.
2. **Sheet conversion (A3, A4):** swap centered `Modal` → `Overlay.Sheet`/`ConfirmSheet` + swipe-dismiss on the money/detail/confirm flows. Kill `window.confirm`/`window.prompt` (A8).
3. **List & feed pass (A6, pagination→infinite, swipe actions):** Bookings, Payouts, Transactions, Services — replicate the `TxCard` feed pattern; drop the mobile `<table>` branches.
4. **Form pass (A10 + keyboard-avoidance):** inline validation, sticky save bars, `<select>`→picker sheets, upload wells; split ServiceForm into sections. Availability per-day toggle.
5. **Navigation & transitions (A5, A7):** page/tab transitions, safe-area-top, onboarding fixed-shell + segmented progress.
6. **Screen-specific polish:** KYC full-screen steps + camera overlay, Earnings period selector, Profile grouped-rows + color wheel, plan carousel, native share sheet.

None of the above requires backend, route, or data-model changes — it's all presentation-layer, and the app already owns every primitive needed (`Overlay`, `ConfirmSheet`, `Fab`, `StickyActionBar`, `SegmentedControl`, framer-motion).

---

## Part D — Host Mobile Design System (the constitution)

**Rule:** these 14 interaction patterns are the *only* allowed vocabulary for the host app. No screen invents a new interaction. New feature → assemble from these. This is what makes every future screen automatically consistent — the audit above is mostly "screens that reached outside this set." Most patterns already have a component; the gaps are the build list.

### The 14 patterns

| # | Pattern | Use for | Component today | Status |
|---|---------|---------|-----------------|--------|
| 1 | **Push Screen** | full-screen create/edit, multi-step flows, detail views | route + `DashboardLayout` | ✅ exists · ✗ needs slide transition (A5) |
| 2 | **Bottom Sheet** | focused input, detail, pickers (date/time/category/color) | `Overlay.Sheet` | ✅ exists · ✗ not adopted; add swipe-dismiss (A4) |
| 3 | **Confirmation Sheet** | destructive/irreversible confirms | `ConfirmSheet` | ✅ exists · ✗ replace all `Modal`+`window.confirm` (A8) |
| 4 | **Context Menu** | secondary row actions (long-press) | — | ✗ **build** (replaces per-card button grids) |
| 5 | **Floating Action Button** | one primary create action per list | `Fab` | ✅ done |
| 6 | **Sticky Bottom Action Bar** | primary save/submit on forms | `StickyActionBar` | ✅ exists · ✗ not on every form; `sticky`→`fixed` |
| 7 | **Segmented Control** | in-page filter/scope switching (never underline tabs) | `SegmentedControl` | ✅ exists · ✗ replace `Tabs`, `<select>` filters; add slide (A9) |
| 8 | **Swipe Actions** | quick row actions (cancel/complete/delete/toggle) | — | ✗ **build** |
| 9 | **Pull to Refresh** | reload any feed/list | — | ✗ **build** (A6) |
| 10 | **Infinite Feed** | any list (never numbered pagination) | — | ✗ **build** (kills Bookings/Transactions pagination) |
| 11 | **Skeleton Loading** | any load state (never spinner/"Loading…") | `Skeleton` | ✅ exists · ✗ EditService still bare text |
| 12 | **Empty State** | no-data (borderless: illustration+text+1 CTA) | `EmptyState` | ✅ exists · ✗ drop dashed border |
| 13 | **Success State** | committed money/save/submit actions | — | ✗ **build** (replaces success toasts on critical paths) |
| 14 | **Error State** | failed load/action, inline with retry | ad-hoc per screen | ✗ **standardize** into one component |

**Build list (5):** Context Menu, Swipe Actions, Pull-to-Refresh, Infinite Feed, Success State + one standard Error State. Everything else is adopt-and-wire.

### Allowed-pattern matrix (which screens use what)

- **Feeds** (Bookings, Transactions, Payouts history, Services, Products): Infinite Feed + Pull-to-Refresh + Skeleton + Empty/Error, rows open a Push Screen or Bottom Sheet, Swipe Actions for quick ops, Context Menu for the rest, FAB to create, Segmented Control to filter.
- **Forms** (ServiceForm, ProfileSetup, Availability, KYC steps, Feedback): Push Screen, Sticky Bottom Action Bar, Bottom Sheet for every picker, inline validation, Success State on save.
- **Money actions** (withdrawal, upgrade, billing): Bottom Sheet to collect → Confirmation Sheet → Success State. No centered modals, no `window.confirm`.
- **Detail views** (booking, transaction): Bottom Sheet (mobile) / Push Screen (full), never centered `Modal`.

### Visual language (from the PhonePe references — direction, not spec)

The screenshots read as an app because of a tight, repeated visual grammar — worth mirroring in *our* tokens (do **not** copy their purple; keep Meeticulous brand):

- **Dark canvas, elevated tiles.** Near-black background, cards are subtly lighter rounded-2xl tiles with generous padding. Our dashboard is light-first — a proper dark theme with elevated surfaces would do a lot of the "app" work. (Ties to existing `--adm-*`/dark-mode groundwork.)
- **Icon-tile grid sections.** 4-across rounded tiles, colored glyph + short 2-line label, grouped under a bold section header ("Loans", "Insurance"). This is the home-screen shortcut pattern — maps cleanly to our Dashboard quick-actions and could replace flat stat/link rows.
- **Section rhythm.** Each section = header + tile grid + one inline promo strip + a "More →" — consistent spacing between sections creates the scannable feed feel.
- **Persistent bottom nav with center FAB.** 5 slots, elevated circular primary action in the middle. We already have the bottom tab bar; a center primary action (e.g. "Add"/scan-equivalent) is the missing centerpiece.
- **Swipeable promo carousel with page dots.** Auto-advancing banner with segmented progress dots — a native home-feed staple; slots into Dashboard for tips/nudges.
- **One accent, restrained.** Single brand accent for active states/CTAs; everything else neutral. Keeps the grid calm.

**Takeaway:** lock the 14 patterns + a dark, tile-grid, section-rhythm visual language as the design system *before* implementation. Then Part C sequencing becomes "make each screen legal under the constitution," and every future host feature inherits the app feel for free.

---

## Part E — Coordination: in-flight work to not clobber

**Active parallel line:** `feat/write-with-bolt` (separate worktree `../bas-write-with-bolt`). Building the **"Write with Bolt"** AI listing generator — a button that lands on the host **service form** and AI-fills it. Backend in progress (`server/services/planService.js` AI quota, migration `v3.69_ai_listing_generations.sql`); the button hits the UI later.

**Shared files — do NOT touch on this branch until they land:**
- `client/src/pages/services/ServiceForm.jsx`
- `client/src/pages/services/AddService.jsx`
- `client/src/pages/services/EditService.jsx`

Part C's form-screen rework (Push Screen, Sticky Bottom Action Bar, Bottom Sheet pickers) targets exactly these files. **Sequence around Write with Bolt:** do the form-pattern migration *after* their button merges, or coordinate so their button slots into the new Sticky Action Bar / header. Everything else in Part C (Bookings, Transactions, Dashboard, Payouts, Products, KYC) is collision-free — start there.
