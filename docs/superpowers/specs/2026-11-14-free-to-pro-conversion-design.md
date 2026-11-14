# Free → Pro conversion system — design

**Date:** 2026-11-14 · **Status:** approved (decisions D1–D3 locked)

## Intent & why
Meeticulous earns ₹0 commission on Pro GMV; the business runs on free→Pro
upgrades. The job of the dashboard's gated surfaces is to **move freeloaders
(hosts taking bookings on Starter, paying only the 5% cut) onto Pro.** Free hosts
convert when staying free is shown to **cost them, personally, in the moment** —
not from a pricing page.

## Goals
- Make the cost of staying free **visible, personal, present** on high-intent
  surfaces, upgrade one tap away.
- Attribute every upgrade entry `?src=<surface>` (UpgradePlan already reads it).
- Lead with the sharpest honest lever: **commission already paid**.

## Non-goals
- No marketing-site / pricing-page work. No change to server plan enforcement.
- Not launching Courses/Coupons/Membership — only their "coming to Pro" teasers.

## Anti-goals
- **Dishonesty** — never tease a benefit the server doesn't gate (honesty rule,
  plans.js).
- **Nag fatigue** — one considered nudge per surface; soft nudges dismissible.
- **Punishing the just-started** — a host with zero bookings / zero commission is
  not a freeloader; show activation, not a guilt meter (meter already hides at ₹0).

## Constraints
- **Brand:** Loop & Slot tokens only (maroon/cream/blush/rose/marigold, rounded,
  Poppins/Bricolage). Existing nudges use off-brand gray/`primary` — rebrand on touch.
- **Real gates only** (plans.js PLAN_MATRIX): commission 5%→0% · free ₹0-services 2 ·
  1h reminder · WhatsApp + reschedule alerts (60-day taste) · follow-up automation ·
  digital products 3 · AI writing 10/6mo · calendar 1→2 · priority support ·
  CRM 10-recent→full.
- **Infra:** shared checkout is churned by other live sessions; implement in an
  **isolated worktree**, one slice per branch/PR.

## Decisions (locked)
- **D1 tone:** blunt once commission paid > Pro yearly (₹1,179) — "you've already
  paid more than Pro costs"; gentle below.
- **D2 unlaunched teasers:** one-click **"Notify me"** tied to the host account,
  no form (slice 4).
- **D3 dismissibility:** hard caps (Products/CRM blur) non-dismissible; soft nudges
  (commission, reschedule) dismissible for the session.

## Reuse (don't rebuild)
- `components/dashboard/CommissionMeter.jsx` — paid-commission nudge; data from
  `GET /host/nudges` (`commissionPaid`). Home-only, off-brand, no `?src`.
- `components/dashboard/ConversionFunnel.jsx` — canonical blur-teaser + overlay +
  `?src` (brand-correct).
- `data/plans.js` — PREMIUM_PLAN (₹1,179/yr), FOUNDING (100 seats).
- `UpgradePlan.jsx` already reads `?src`.

## Approach — stacked levers, commission as spine
1. **Loss made real** — actual ₹ paid vs Pro price ("paid ₹2,340; Pro ₹1,179 —
   kept ₹1,161"). Highest leverage, honest, hits the freeloader.
2. **Ceiling made visible** — at a real cap, locked rows blur behind a ProTeaser.
3. **Expiry made urgent** — WhatsApp 60-day taste countdown; Founding-100 seats.

Rejected: pricing-page-only (misses freeloaders), hard paywall (kills activation,
raises refunds), generic banners (nag, unmeasured).

## Per-page (full system)
| Page | Gate | Nudge | src |
|---|---|---|---|
| Home | — | CommissionMeter + funnel (exist) | home/funnel |
| Money/Earnings | 5%→0% | CommissionMeter placed here | earnings |
| Customers | 10 recent | ProTeaser blurred older rows | crm |
| Products | 3 cap | ProTeaser on 4th | products |
| Services | 2 free-svc · AI 10/6mo | inline AI-left meter | services-ai |
| Bookings | 1h · WA taste | taste countdown | reminders |
| Availability | reschedule alerts | inline nudge | reschedule |
| Courses/Coupons/Membership | unbuilt | "Coming to Pro — Notify me" | soon-<x> |
| UpgradePlan | close | Founding seats + ₹4/day | — |

## Build order (slices, each own PR)
1. **ProTeaser + CommissionMeter rebrand/extend + mount on Earnings + attribution.**
2. Customers + Products onto ProTeaser.
3. Expiry: WhatsApp taste countdown (Bookings) + Founding seats (UpgradePlan).
4. "Coming to Pro" Notify-me teasers (Courses/Coupons/Membership) + intent store.
5. Services AI meter + Availability reschedule nudge.
