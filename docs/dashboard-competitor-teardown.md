# Competitor teardown — Topmate creator dashboard vs Host Lab

**Date:** 2026-11-18
**Method:** signed-in walkthrough of topmate.io/dashboard (Home, Services, Bookings,
Memberships, Payments, Invite & Earn, Boost checkout, Growth Analytics) in Chrome.
**Companion to:** `docs/dashboard-facelift-audit.md` (which covers colour/token drift).

The headline: **what makes their dashboard feel like a dashboard is almost never styling.**
It is a small set of structural patterns repeated without exception on every page. We already
have the information architecture. We are missing the repetition.

---

## 1. The page skeleton, repeated without exception

Every page is: **`H1 title` → pill tab row → optional right-aligned page actions → content.**

| Page | Tabs | Right actions |
|---|---|---|
| Services | 1:1 Call · Webinars & Cohorts · Products/Courses · Package · Priority DM | `+ Add New` `Templates` |
| Bookings | same 5 service-type pills, then Upcoming / Completed underline tabs | — |
| Membership | Overview · Posts · Tiers · Members · Telegram | `Draft` toggle |
| Payments | — | `Connect payout` |

Two tab *levels* are used deliberately: **pills = which object type**, **underline = which state
of it** (Bookings: pills for service type, underline for Upcoming/Completed). That is a real
convention, applied consistently.

**Us:** Host Lab sections each lay themselves out. No shared page header, no tab convention.

**Fix:** one `PageHeader` (title, optional subtitle, right action slot) + one `TabRow` with
`variant="pill" | "underline"`, used by all 11 sections. Highest payoff per line changed in
this whole document.

## 2. Empty states are a system, and the copy sells a move

Their empty states are: tinted circle icon (or illustration) → **benefit headline** → two lines
of explanation → exactly one dark CTA.

- Memberships Overview → "Start earning recurring income" / `Create your first tier`
- Membership Posts → "Give your members something to come back for" / `Write your first post`
- Bookings → "Share your page" / "A new booking might just be around the corner" / `Share page`

The headline is never a status. It is the outcome the creator wants.

**Their one failure proves the rule:** the Home analytics card says *"No Data Available / No
analytics data found for the selected time period."* It is the weakest surface on the product
and the only one that reports a state instead of offering a move.

**Us:** we have the better mechanism and the worse copy. Host Lab's `Empty` (`intelUi.jsx:515`)
and the community `EmptyState` (`CommunityLayout.jsx:430`, with illustration + serif line) both
exist, but Host Lab's strings are status-voice — "No bookings yet", "Nothing matches",
"No one matches", "No quotes yet", "No one-offs set".

**Fix:** rewrite Host Lab empty copy to benefit-voice, and render the illustrations from
`design-system/assets/04-illustrations/` that the community `EmptyState` already uses and Host
Lab uses zero of. The kit is built; nothing is blocking this.

## 3. Every number explains itself

Two conventions applied to every metric without exception:

- **ⓘ tooltip** on Visits, Earnings, Sales, MRR, Active members, Tiers, Withdrawable balance,
  In withdrawal, Lifetime earnings.
- **A sublabel under the value**: "Monthly recurring", "Currently subscribed", "Published",
  "No pending withdrawal", "Total you've made on Topmate", "Includes ongoing & upcoming".

A bare number is never shipped.

**Us:** some tiles have a hint, most do not, and there is no tooltip convention at all.

**Fix:** extend the Host Lab stat tile to require `label`, `value`, `sublabel`, `info` — make
`info` a required prop so a tile cannot ship unexplained.

## 4. Stat tiles do not have to be numbers

Growth Analytics runs a 5-tile strip that is deliberately heterogeneous:

> LIFETIME EARNING **₹9** · LIFETIME BOOKINGS **2** · BEST MONTH **Jan 2026** · TOP SERVICE TYPE
> **Video Call** (100.0% of revenue) · LAST BOOKING **302d ago**

"Top service type: Video Call, 100% of revenue" and "Last booking: 302d ago" tell a host more
than any count does. Qualitative tiles are the cheapest way to make a dashboard feel like it
knows something about you.

**Us:** every tile is a number or a currency. We hold the data for all five of those.

## 5. Period-over-period is a first-class block

"Weekly Growth" and "Monthly Growth" are their own cards: metric name, **This Week (₹0) ₹0/day**
beside **Last Week (₹0) ₹0/day**, with a right-aligned green `↑ 0.0%`. Normalised per-day, so
a short week does not read as a crash.

**Us:** `Insights`/`Intelligence` have charts, but no this-vs-last block. This is a small
component and a strong one.

## 6. Monetisation as a browsable catalog — the biggest gap

**Boost checkout** is a 3×3 grid of nine cards: tinted icon square (a different hue per card),
title, one-line benefit, an `Active` badge when on, and `Set up` / `Manage`.

> Country based pricing · Recording add-on · Checkout add-ons · AI Assist add-on · Cart
> abandonment · Discount codes · Profile popup and banner · Affiliate · Pay what you want

Every revenue lever in one place, each stating its benefit in four words, each showing whether
it is live. A host can see what the platform can do for them in a single screen.

**Us:** we have real levers — coupons, memberships, courses, referrals, Pro, boost/share — and
they are scattered across Catalog, Grow and Settings. **There is no screen that shows a host
everything available to switch on.** Of everything in this teardown, this is the one that would
change host behaviour rather than host perception.

## 7. Onboarding is a persistent, resumable checklist

Home carries "Make the page yours!" — a **segmented progress bar** (one segment per step, filled
green as completed), then accordion rows: `✓ Set availability`, `○ Customize your creator page`
(expanded, with description + `Customize page` + accept/dismiss icons), `✓ Sell 1:1s`, `○ Set up
payouts`, `○ Set up Instagram Auto DM`. Beside it, a **"Get inspired"** panel showing three real
creators with photos.

**Us:** we have `NextStepCard` and `ProfileCompletionPanel`, but the completion panel is hidden
in a toolbar popover (it "never occupies dashboard layout space", per its own comment). We took
the one artefact that drives activation and hid it. Given 0 hosts KYC-verified and payouts
blocked until they are, a visible, resumable checklist on Today is not cosmetic — it is the
activation path.

## 8. Money page is a working surface, not a summary

Three tiles, each with its own action: **Withdrawable balance ₹9** (`Withdraw` + `Breakdown`,
dashed sub-row "🔒 No holds"), **In withdrawal** ("No pending withdrawal", `Past withdrawals →`),
**Lifetime earnings** (context sentence). Below: a transactions table with type filter, search
by service/name/email/phone, `Download`, pagination, expandable rows, and a footer offering
older transactions + support.

Plus a dismissible amber **"NEW — A clearer transactions table"** banner with `Need help?` and
`See what's new →`. They announce their own changes in-product.

**Us:** `Money.jsx` has the tiles and a transaction list, but not the hold/withdrawal split as
separate tiles-with-actions, and the file itself admits guest invoices "are not listed anywhere
yet".

## 9. Per-item analytics

Each service card carries `Edit` · **`Analytics`** · share · ⋮. Analytics is scoped to the thing
you are looking at, not only to a global Analytics section.

**Us:** `Catalog` items have edit/share. Per-service analytics exists nowhere.

## 10. What they do that we should NOT copy

- **Two floating widgets** ("Ask Loop…" and a purple "Enhance Profile" with a `3` badge) that
  overlap page content on every screen, obscuring the analytics card and buttons. In several
  screens they cover real controls.
- **A full-bleed advertisement** ("Get your own app, in your name") as the first thing above
  their own greeting on Home.
- **Un-title-cased raw values** reaching the UI (our `platform`, their equivalents).
- The **"No Data Available"** card described in §2.

---

## Priority

Ordered by payoff per line of diff.

| # | Change | Why first |
|---|---|---|
| 1 | Shared `PageHeader` + `TabRow` across all 11 Host Lab sections | Creates the "one app" feeling; mechanical; no new design needed |
| 2 | Benefit-voice empty copy + kit illustrations in Host Lab | Assets already built and already used by community; copy-only elsewhere |
| 3 | Stat tile requires `sublabel` + `info` | Makes every number self-explaining; small component change |
| 4 | "Everything you can switch on" catalog screen | The only item here that moves revenue, not perception |
| 5 | Activation checklist visible on Today, not in a popover | Directly addresses the 0-hosts-KYC'd blocker |
| 6 | Qualitative tiles (best month, top service type, last booking) | We hold the data; no new queries of substance |
| 7 | This-period vs last-period block | Small component, high signal |
| 8 | Money: hold/withdrawal split + table controls | Largest build in the list; do last |

Items 1–3 are a consistency layer over what exists and should land as one PR each. Items 4–5
are product decisions, not design ones, and want a brief before code.
