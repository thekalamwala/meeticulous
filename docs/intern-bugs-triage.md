# Intern Bug Report — Verification & Fix Plan

Verified 2026-11-14 against the codebase. 18 items from `meeticulous website bugs.pdf`.
Each: **status** (real bug / feature request / design question), root cause with `file:line`, fix plan.
No code changed yet — this is the plan.

Legend: 🐛 real bug · ✨ feature request · ❓ design/product question · ⚠️ needs reporter clarification

---

## Quick triage table

| # | Item | Verdict | Effort | Fix locus |
|---|------|---------|--------|-----------|
| 1 | Community topic UI → small pills under ads | ✨ | S | `CommunityLayout.jsx:309`, `CommunityFeed.jsx:132` |
| 2 | Ad disappears on 3-dot click | 🐛 (by-design, wrong UX) | S | `CommunityAd.jsx:174-188` |
| 3 | Notifications not live-updating | 🐛 confirmed | M | `useLiveNotifications.js`, `NotificationBell.jsx:27` |
| 4a | Booking status pills go nowhere, arrow shows | 🐛 confirmed | S | `Bookings.jsx:415-433,549-551` |
| 4b | "Account not created" | 🐛 confirmed (2 silent paths) | M | `authController.js:235-307, 799-809` |
| 5 | Chat reply only after refresh + slow | 🐛 confirmed | M | `SupportChat.jsx:183-208` |
| 6 | WhatsApp still "Book A Sloth" | 🐛 confirmed (DATA, not code) | M | DB `notification_events` + AiSensy platform |
| 7 | Account manager not shown to host | 🐛 confirmed (exists, not surfaced) | M | `Navbar.jsx:163`, `DashboardLayout.jsx:374` |
| 8 | More footer socials (LinkedIn) | ✨ (trivial) | XS | `Footer.jsx:112-125` |
| 9 | About hero text invisible + dummy team | 🐛 + ✨ | S/M | `HeroV2.jsx:18-31`, `aboutContent.js:110-155` |
| 10 | Use new mascot imgs on features/industry | ✨ | M | `featureData.js`, `professionLandingData.js` |
| 11 | 3 card btns scroll to same section | ⚠️ needs page confirm | S | likely `HostProfile.jsx:569-573` |
| 12 | Rewards page no wheel scroll | 🐛 confirmed | XS | `GuestLayout.jsx:100` |
| 13 | Chat same no-wheel scroll | 🐛 confirmed (same fix) | XS | `GuestLayout.jsx:100` |
| 14 | Phone input resets each digit | 🐛 confirmed | S | `CustomerProfile.jsx:81` |
| 15 | Reward tier "how to achieve" detail | ✨ (page is mock) | M | `Loyalty.jsx:11-16` |
| 16 | Booking completes with no-one joined | ❓ design-level | L | `bookingController.js:2129-2181` |
| 17 | Completed booking → reviews not detail | 🐛 confirmed (1-line) | XS | `GuestOverview.jsx:107` |
| 18 | "Browse host" btn → home not explore | 🐛 confirmed (1-line) | XS | `CustomerBookings.jsx:332,345` |

**Quick wins (XS, one-line each): 12, 13, 17, 18, 8.** Ship these first.

---

## Details

### 1 — Community "browse by topic" → small pills under ads ✨
Topic pills already pill-shaped (`CommunityFeed.jsx:27-45`), but sit full-width at top of center column (`:132`). Ads live in the right rail (`CommunityLayout.jsx:309`).
**Fix:** add a compact topics variant into the right `<aside>` *after* `<CommunityAd/>` (`CommunityLayout.jsx:309`); shrink pill padding. Design call: keep or remove the center-column copy.

### 2 — Ad vanishes on 3-dot 🐛
Not a bug in handlers — **by design**. The `⋯` glyph IS a direct dismiss button (`CommunityAd.jsx:187`, `onClick={onDismiss}`, persists via `sessionStorage` at `:174-176`). Reporter expected a kebab *menu*.
**Fix:** either (a) make `⋯` open a small menu ("Why this ad" / "Hide"), or (b) relabel to an explicit × close. Low effort; product decision on which.

### 3 — Notifications not live 🐛
Live path is Supabase **broadcast only** + a window-`focus` refetch — **no polling fallback** (`useLiveNotifications.js:14-43`). `.subscribe()` ignores `CHANNEL_ERROR`/`TIMED_OUT` (`:30`); anon client never `setAuth()` (`supabaseClient.js:12-40`). If realtime join fails silently → only updates on focus/refresh = exact symptom.
Plus a **definite** separate bug: admin bell fetches once on mount, no realtime/poll (`NotificationBell.jsx:27`).
**Fix:** (a) add subscribe-status handling + a poll fallback (e.g. 30–60s) in `useLiveNotifications`; (b) add polling to admin `NotificationBell`. Verify Realtime authorization config in Supabase.

### 4a — Dead status pills with chevron 🐛
`SummaryCard` is a `<Link>` always rendering `ArrowRight` (`Bookings.jsx:415-433`). All three target identical `to="/dashboard/bookings"` (`:549-551`) — the page you're already on.
**Fix:** make them status filters (no nav, drop the chevron) OR point to distinct filtered routes. Recommend: convert to filter buttons, remove `ArrowRight`.

### 4b — Account not created 🐛
Two real silent paths in `authController.js`:
- **Guest/OTP:** `ensureGuestProfile` returns `null` on any create failure (`:235-307`); callers swallow it as non-fatal (`:1035,:1074`). OTP/booking succeeds, no account made — surfaces later at login.
- **Host/Google:** auto-create has no orphaned-auth-user fallback (`:799-809`). If an auth user already exists (e.g. booked as guest first), `createUser` errors → bounce to `?error=create_failed`. Most likely concrete "host won't create".
**Fix:** guest path — surface/retry failures instead of null-swallow; host path — handle existing-auth-user (link profile instead of createUser). ⚠️ Ask reporter which flow they hit.

### 5 — Chat reply only after refresh 🐛
Same realtime weakness as #3, in support chat (`SupportChat.jsx:185-208`, admin `AdminSupportChat.jsx:298`). Worse: **no focus refetch, no poll** here. Reply row exists in DB, open panel never learns → shows on next history load. ("Slow to reply" is a separate bot/SLA latency concern, not this gap.)
**Fix:** add poll fallback + subscribe-status handling to chat subscription. Shares root cause with #3 → fix together.

### 6 — WhatsApp still "Book A Sloth" 🐛 (data, not code)
Live server code is **clean** (zero old-brand grep hits outside migrations). Rebrand migration `v3.180` swept blogs/crm_templates/badges but **never `notification_events`** — where WA/OTP/transactional copy lives. Stale rows: `v1.9_notification_system.sql:61,71,72`, `v3.169:19`, `v3.163:15`, `v3.164` (multiple), bot self-intro `v3.84:49`.
**Fix:** (a) data-migrate `notification_events`/`bot_faqs` DB rows (new migration, run on live DB); (b) update WA template bodies on the **AiSensy platform** (content lives there, not in repo). No app code change.

### 7 — Account manager not surfaced to host 🐛
Feature exists admin-side: `account_managers` table (`v3.80_host360.sql`), assignment UI, `profiles.account_manager_id`. But every **host-facing** "account manager" element is a static link to `/bolt958` (`Navbar.jsx:163`, `DashboardLayout.jsx:374`, `ConsoleSidebar.jsx:388` supreme-only) — never the host's actual assigned manager.
**Fix:** surface the assigned manager's name/contact to the host (new small endpoint reading `account_manager_id` → manager row; render in dashboard). Fall back to generic support when unassigned.

### 8 — More footer socials ✨ (trivial)
LinkedIn/Instagram/X/Facebook **already defined** with icons in `SOCIALS` (`Footer.jsx:112-125`) but `href:null`, so filtered out at `:147`. Only WhatsApp + Email show.
**Fix:** set the real URLs on the null entries. Zero markup. Need the actual profile URLs from founder.

### 9 — About hero invisible + dummy 🐛+✨
**Visibility (bug):** H1 has no text-color → dark `--ink` over a full-bleed colourful photo with no scrim (`HeroV2.jsx:18-31`); same silhouette rendered twice. Fix: add a scrim/overlay or set light text; drop the duplicate bg image.
**Dummy (content):** most copy is real; **team section** is placeholder — 3/5 members are "Team Member" with filler bios, all 5 `photo:null` (`aboutContent.js:110-155`, dead asset host). Fix: real names/roles/photos.

### 10 — Use new mascot images ✨
Mascot PNGs exist but **unused**: `client/public/features/Cheerful Scheduling Mascot Workspace.png`, `client/public/home/Four Plush Mascots on Pink Platform.png`. Image config lives in `featureData.js` (features) and `professionLandingData.js`/`V2` (industry).
**Fix:** wire mascot paths into those data files' hero/section image keys. Design call on placement.

### 11 — 3 card btns → same section ⚠️
**Could not confirm the exact page.** No feature/industry page has a 3-card-each-with-scroll-button section. Closest match: `HostProfile.jsx:569-573` — Services/Products/Feed nav all call `goOfferings()` which scrolls to one hardcoded `#offerings` (`:572`); they only differ by filter state (arguably by-design).
**Fix:** blocked — ask reporter which page/screen. If HostProfile: expected behavior likely fine (one section, filtered).

### 12 — Rewards page no wheel scroll 🐛
`GuestLayout.jsx:100` wrapper: `overflow-x-hidden` promotes `overflow-y`→`auto` (makes it a scroll container), but `min-h-screen` gives it no bounded height = no scroll range; `overscroll-y-contain` blocks chaining to window. Wheel/touch dies; scrollbar (window's) still works.
**Fix:** change `overflow-x-hidden`→`overflow-x-clip` (matches `index.css:44,77`) and/or drop `overscroll-y-contain`. One line.

### 13 — Chat same scroll bug 🐛
**Confirmed same wrapper** — `/user/loyalty` and `/user/chat` both under `GuestLayout` (`App.jsx:908-909`). **Fix #12 resolves both.** (Chat card itself is viewport-pinned at `SupportChat.jsx:299`, fine once page wheel works.)

### 14 — Phone input resets per digit 🐛
`Field` component declared **inside** `CustomerProfile` body (`CustomerProfile.jsx:81`). New function identity each render → React remounts the `<input>` every keystroke → loses focus, placeholder flashes. Name + DOB fields share it.
**Fix:** hoist `Field` (and `inputCls` at `:90`) to module scope. Small, clean.

### 15 — Reward tier "how achieved" detail ✨
`Loyalty.jsx` is entirely a **"coming soon" mock** — tiers hardcoded client-side (`:11-16`), `spent=0` (`:31`), no backend. Only a spend floor + one-line perk per tier; no "how to achieve" copy.
**Fix:** either flesh out the static tier data with per-tier criteria copy (if just showing info), or build the real backend (large). Clarify scope with founder — page is non-functional today.

### 16 — Booking completes though no one joined ❓ design-level
`autoCompleteBookings()` (`bookingController.js:2129-2181`) is **purely time-based**: confirmed + past `sessionEnd` + hold → completed + revenue recognised. **No attendance tracking anywhere** — only a `meeting_link` URL; no `joined`/`attended` flag. Only non-attended terminal state is manual `no_show` (`:1404`).
**Fix (design):** needs a real join/attendance signal (meeting-provider join webhook or presence ping) before auto-complete + revenue recognition. Large. Interim: make `no_show` easier to flag, or add a dispute window. Product decision required.

### 17 — Completed booking → reviews 🐛 (one line)
`GuestOverview.jsx:107` "Completed" StatTile hardcoded `to="/user/reviews"`; "Upcoming" (`:106`) correctly `to="/user/my-bookings"`.
**Fix:** change `:107` to `/user/my-bookings` (or a completed-filtered view).

### 18 — "Browse host" → home not explore 🐛 (one line)
`CustomerBookings.jsx:345` "Browse creators" and `:332` empty-state both `to="/"` (homepage). Explore is `/explore` (`App.jsx:800`).
**Fix:** change both to `to="/explore"`.

---

## Suggested batching (one PR per group, base = release train)
1. **One-line nav/CSS fixes** (12, 13, 17, 18, 8) — trivial, high value.
2. **Phone input** (14) — isolated.
3. **Realtime reliability** (3 + 5) — shared root cause.
4. **Booking pills UX** (4a) + **ad 3-dot UX** (2) — small UX.
5. **Account creation** (4b) — needs reporter repro first.
6. **WhatsApp/notification_events rebrand** (6) — DB migration + AiSensy platform.
7. **Account manager surface** (7).
8. **About page** (9) + **mascots** (10) + **footer URLs** (8 content).
9. **Design/product decisions** (1, 11, 15, 16) — need founder input before build.
