# Free vs Pro — Monetisation & Habit Audit (2026-11-03)

**Question:** would a host genuinely *want* to pay for Pro? Where is Starter (free) too generous,
where does it frustrate for no good reason, and does Pro deliver value a host can feel?

**Sources:** live `subscription_plans` rows + live DB counts (project `spquowzrefozmrzoszkf`,
read-only), `server/middleware/planMiddleware.js`, `server/services/planService.js`,
`server/controllers/{bookingController,planAdminController}.js`,
`server/services/{upgradeNudge,weeklyHostRecap,activationNudges,followups/*}.js`,
`client/src/data/plans.js`, `client/src/lib/hostNudges.js`,
`client/src/pages/{UpgradePlan,onboarding/PlansStep}.jsx`, `docs/activation-funnel.md`,
`docs/DECISIONS.md` (ADR-006, ADR-011).

---

## 0. The strategy (founder decision, 2026-11-03)

| Decision | Choice |
|---|---|
| What Free is for | **Acquisition.** A Calendly-style scheduler: unlimited services ("multiple lists"), booking page, calendar, payments. |
| Paid bookings on Free | **Yes, at 5% commission.** Booking pages never break; hosts who never subscribe still earn us money. |
| What Pro is | **The actual Meeticulous.** WhatsApp reminders, reschedule alerts, 1h reminder, full CRM, rebook automation, 0% commission. |
| Pro taste on Free | **WhatsApp reminders + reschedule alerts for the first 60 days**, then Pro-only. Everything else in Pro stays locked from day one. |
| Founding price | **The first 100 Pro hosts pay ₹999/yr (ex-GST), locked for life** while subscribed. |
| After 100 | **Pro yearly goes to ₹1,499 (ex-GST)** for new subscribers. |

**Why this works:** the 60-day taste lets a host *feel* the two things guests notice — WhatsApp
reminders and reschedule alerts — and day 61 is an upgrade moment created by the host's own
experience, not by a sales prompt. "X of 100 founding spots left" is a true deadline, not a
fake countdown.

**The risk to manage:** money only comes once hosts are *earning*. The previous DB's funnel
(`docs/activation-funnel.md`) recorded ~5 activated hosts out of ~65 signups. The live DB was
reset on 2026-10-30 and holds 3 hosts, 2 services and 0 bookings, all on `free`. Getting to 100
Pro hosts is mainly an activation problem. If ~10–20% of *earning* hosts convert (an assumption,
not data), 100 Pro needs roughly 500–1,000 hosts with paid bookings. That's why activation work
stays in P0 below.

---

## 1. Current Free vs Pro feature audit

Live `subscription_plans` (prices ex-GST; the customer pays +18%):

| Capability | Starter (`free`) | Pro (`premium`) | Enforced where | Under the new strategy |
|---|---|---|---|---|
| Price | ₹0 | ₹199/mo · ₹999/yr (₹235 · ₹1,179 incl. GST) | Razorpay subscription | ₹999 founding → ₹1,499 after 100 (§5) |
| Commission on paid bookings | **5%** | **0%** | `commission_percentage` → `bookingController.js:440` | keep |
| Guest booking fee | ₹10 + GST (guest pays) | same | `platform_settings.platform_fee` | keep |
| Paid services | Unlimited | Unlimited | `limits.services = -1` | keep ("multiple lists") |
| Bookings/year | Unlimited | Unlimited | `limits.bookings_per_year = -1` | keep — never cap (guests would see the error) |
| Free (₹0) services | 2 | Unlimited | `canAddFreeService` | keep |
| Booking page, UPI/card, GST invoices, payouts | ✓ | ✓ | — | keep |
| Google Calendar + Meet | 1 calendar | 2 (Google + iCal) | `calendar_integrations` | keep |
| Confirmations (email + WhatsApp) | ✓ | ✓ | NotificationEngine | keep |
| 24h reminder | ✓ (email; WhatsApp first 60 days) | ✓ | `reminder_flows = 1` | keep |
| 1h reminder | ✗ | ✓ | `reminderWindowsForPlan` | keep Pro-only |
| WhatsApp reminders | First 60 days, then email | ✓ | `whatsappRemindersAllowed` `bookingController.js:1827` | **already matches the strategy** |
| Reschedule notifications (email/WhatsApp) | ✗ (in-app only) | ✓ | `rescheduleNotifyForPlan` `planService.js:122` | **change: give them during the 60-day taste** |
| Client CRM | 10 most recent clients | Full | `limits.crm = 10` → `requireCrm` + `crmService.listClients` | keep, but show what's hidden (§4 T4) |
| Follow-up / rebook automation | ✗ | ✓ (day 3 + day 21) | `followup_flows` | keep Pro-only |
| Digital products | 3 | Unlimited | `checkProductLimit` | keep |
| AI service writing | 10 per 6 months | Unlimited | `ai_generations` + `WINDOW_DAYS` | keep |
| Support | Email | Priority WhatsApp + email | `support_type` | keep |
| `features.*` JSON (data_export, advanced_reports, client_notes, custom_fields, recurring_clients, multiple_schedules, custom_branding, priority_feature_access) | mixed | all true | **nothing reads them** | build or delete |

Upgrade surfaces that exist today:

| Surface | Trigger | File |
|---|---|---|
| Onboarding plan step | Every new host, before going live | `client/src/pages/onboarding/PlansStep.jsx` |
| Dashboard "Next step" card | Free host with commission paid > 0 or a real earning | `client/src/lib/hostNudges.js` |
| Upgrade email | First time cumulative commission ≥ ₹300 | `server/services/upgradeNudge.js` |
| 403 `upgrade_required` | Hitting product/CRM caps | `planMiddleware.js` `blockResponse` |
| "Why hosts upgrade" band | Free hosts on `/dashboard/upgrade` | `UpgradePlan.jsx` |
| Pricing matrix | Public | `client/src/data/plans.js` `PLAN_MATRIX` |

---

## 2. Gaps against the strategy

1. **The 60-day taste is half built.** WhatsApp reminders already follow it
   (`WHATSAPP_FREE_DAYS = 60`). Reschedule alerts don't: Free hosts never get them, so the taste
   is missing one of its two features. Fix: let `rescheduleNotifyForPlan` use the same window
   helper.
2. **The taste ends silently.** Nothing tells the host on day 55 that WhatsApp is about to switch
   off, or on day 61 that it has. Without that message there's no upgrade moment, just a quiet
   downgrade the host may never notice until a guest no-shows.
3. **The 60-day clock starts at signup, not at first booking.** With ~8% activation, most hosts
   would spend their taste with zero bookings and never see a reminder go out.
   **Recommendation:** start the clock at the host's first confirmed booking (fall back to signup
   + 60 days if they never book). It costs nothing extra and every host gets a full 60 days of
   real reminders.
4. **No founding-100 mechanics.** No counter, no founding plan row, no badge. Prices can change
   safely (below), but one gap needs closing first.
5. **Onboarding asks for money before value.** `PlansStep.jsx:215` leads with "Go live with
   everything unlocked on Pro — or start free below." Under this strategy Free is the front
   door: lead with "Go live free — WhatsApp reminders included for 60 days", and put the founding
   price underneath.
6. **Habit loops are built but switched off.** Weekly host recap (`WEEKLY_RECAP_ENABLED !== 'true'`,
   `weeklyHostRecap.js:111`) and activation nudges (events seeded inactive in v3.163) both exist
   and don't send. These are the cheapest activation levers available.
7. **Pro has few features a host can name.** Beyond 0% commission and WhatsApp, Pro is mostly
   "more of" or invisible work. Confirmed absent from the codebase: discount codes, packages,
   group sessions, waitlist, custom domain, branding removal. These are what "the actual
   Meeticulous" should mean once the founding 100 are in.

**Guardrail (recommended, your call):** after day 60, keep the **guest-facing** reschedule
*email* on every plan, and gate only WhatsApp and the host-side alerts. A guest who never learns
their new time blames Meeticulous, not the host's plan, and the email costs nothing.

### How a price change behaves today (verified in code)

- Editing `annual_price` in admin clears `razorpay_plan_id_annual`
  (`planAdminController.js`, the "Razorpay Plan objects are immutable" block). The next checkout
  creates a new Razorpay plan at the new price.
- Existing Razorpay subscriptions stay bound to their old plan object, so **founding hosts keep
  renewing at ₹999 automatically**. Locked-for-life is almost free to deliver.
- **Gap:** a founding host who switches monthly ↔ yearly (or cancels and resubscribes) gets a new
  subscription at the *current* `premium` price. Fix: before the cutover, move founding
  subscribers to an archived `premium_founding` row (`clonePlan` already creates inactive
  clones). Archived rows still resolve and renew — the same pattern the legacy `creator` partner
  tier uses today.

---

## 3. Habit formation — becoming part of the host's day

A booking product earns a daily habit from two things: **money** and **the calendar**.

| Loop | Cadence | Status | Action |
|---|---|---|---|
| Weekly recap: earned, booked, upcoming | Weekly | Built, OFF | Turn on. Free + Pro. |
| Activation nudges (add service → share → first booking → payout) | Stage-based | Built, OFF | Activate the 4 events after reviewing templates |
| Taste countdown ("WhatsApp reminders: 12 days left") | Day 45 / 55 / 61 | Not built | P0 — the upgrade moment |
| "Today's schedule" morning message | Days with bookings | Not built | Email on Free, WhatsApp on Pro |
| Payout landed | Per payout | Built | Add one line: commission paid (Free) / saved (Pro) |
| Lapsed clients | Weekly | Not built | Count on Free, list + one-tap nudge on Pro |

Never send a "you earned ₹0" message (`weeklyHostRecap.worthSending` already gets this right).

---

## 4. Aha moments, conversion triggers, placements

**Aha moments** (no upgrade prompts before #2, except the taste notices and the pricing pages):
page shared → **first paid booking** → first payout → first repeat client → first review.

| # | Moment | Signal | Message (host's own numbers) | Placement |
|---|---|---|---|---|
| T1 | **Taste ending** | Day 55 of the 60-day window | "In 5 days, WhatsApp reminders and reschedule alerts switch off. So far they've sent 34 reminders to your guests. Keep them: founding Pro is ₹999/yr — 27 of 100 spots left." | Email + WhatsApp + dashboard card |
| T2 | **Taste ended** | Day 61 | "WhatsApp reminders are now off. Your guests get email only." | Dashboard card (persistent until dismissed) |
| T3 | Reminder went out by email instead of WhatsApp | First email-only reminder after day 60 | "This reminder went by email. On Pro it goes on WhatsApp, where guests actually read it." | In-app, once |
| T4 | CRM cap | Host has > 10 clients | "You have 23 clients — you're seeing your 10 most recent. See them all on Pro." | CRM list footer (show the count, never hide it) |
| T5 | Commission crosses break-even | Rolling 30-day commission ≥ Pro's monthly cost | "You paid ₹X commission this month. Pro is ₹98/month and takes 0%." | Earnings page meter + Next-step card |
| T6 | Payout lands | Payout email | "₹X went to commission this month — ₹0 on Pro." | Payout email footer line |
| T7 | First repeat client | 2nd booking from the same guest phone | "Priya booked again. Pro asks clients like her to rebook automatically." | In-app, once |
| T8 | Founding spots running out | Counter ≤ 20 | "Only 12 founding spots left at ₹999/yr. After that Pro is ₹1,499." | Pricing + upgrade page + one email to earning Free hosts |
| T9 | Hits a cap | 4th product, 11th AI generation, 3rd ₹0 service | Existing 403 copy + the specific benefit | Inline |

**Never:** login popups, invented countdowns, prompts during guest checkout, or anything a guest can see.

**Measure:** PostHog `upgrade_prompt_viewed {trigger}`, `upgrade_started {trigger}`,
`upgrade_completed {trigger, cadence, founding}`.

---

## 5. Recommended allocation & pricing

### Free (Starter) — "Get booked"

- Unlimited services and bookings, booking page, Google Calendar + Meet
- UPI/card payments at **5% commission**, GST invoices, payouts
- Email confirmations + 24h email reminder
- **60-day taste: WhatsApp reminders + reschedule alerts**, starting at first booking
- CRM: 10 most recent clients (total count always visible)
- 2 free (₹0) services · 3 digital products · 10 AI generations per 6 months
- Weekly recap

### Pro — "The actual Meeticulous"

- **0% commission**
- **WhatsApp reminders on every booking**, 1h reminder, reschedule & cancellation alerts
- Full client CRM + rebook automation (day 3 + day 21)
- Unlimited products, AI, ₹0 services; 2 calendars; priority WhatsApp support
- **Founding members:** ₹999/yr locked for life + a founding badge on their profile (`badgeEngine.js` exists)
- Coming (P2): monthly value statement, discount codes, intake questions, packages, branding removal, booking analytics

### Pricing

| | Founding (first 100) | After 100 |
|---|---|---|
| Yearly, ex-GST | ₹999 | **₹1,499** |
| Yearly, charged (incl. 18% GST) | ₹1,179 | ₹1,769 |
| Per month equivalent | ₹98 | ₹147 |
| GMV/month where Pro pays for itself vs 5% | ₹1,965 | ₹2,948 |
| Monthly, ex-GST | ₹199 | ₹199 (recommended — see below) |

**Recommended: keep monthly at ₹199 and raise only yearly.** At ₹1,499 yearly vs ₹199 × 12, the
yearly saving drops from 58% to 37%. That's a healthier discount and fixes the "monthly looks
overpriced" problem from the first audit. ₹1,769 / 365 = ₹4.85 a day still supports an "under ₹5
a day" headline. *Open decision: confirm whether monthly changes too.*

**What "first 100" means:** count **paying** Pro subscriptions (active Razorpay mandate on
`premium`, excluding comped `supreme` and legacy `creator`/`professional`). Honour anyone who
checks out while the counter reads ≤ 100. A few over the line during the cutover is fine — the
promise is "about 100", not a race.

**Expectations:** 100 founding hosts on yearly = ~₹1L/yr ex-GST. That's validation money, not the
business. The real revenue comes from the ₹1,499 price after 100 plus the 5% from Free hosts.
Monthly founding subscribers are worth more (₹2,388/yr) than yearly ones.

**Cancel = lose the founding price.** State it plainly at checkout and in the cancel flow. It's
honest, and it's the strongest retention line you'll have.

---

## 6. Retention & expansion for Pro

1. **"Your Pro month" statement** (monthly): commission saved, WhatsApp reminders sent,
   reschedules handled, rebookings from automation. Founding members are the base of the
   business, so keeping them matters most.
2. **Yearly is the default selection** at checkout.
3. **Cancel flow:** show saved ₹, and that cancelling forfeits the founding price for good. Offer a
   1-month pause first.
4. **Dunning:** `subscriptionReconciler` + `SUBSCRIPTION_HALTED` exist. Add one WhatsApp at halt,
   since UPI mandate failures are usually bank-side issues the host can fix quickly.
5. **Expansion:** Studio tier (teams) once Pro hosts ask for staff seats; USD pricing is already
   designed (`PREMIUM_PLAN_USD`).

---

## 7. Prioritised roadmap

Nothing in P0 needs a migration. The founding cutover (P1) must ship **before** the 100th paying host.

### P0 — this release (days)

| # | Change | Where | Size |
|---|---|---|---|
| 1 | **Reschedule alerts in the 60-day taste** — one window helper used by both WhatsApp reminders and reschedule notifications | `bookingController.whatsappRemindersAllowed` → shared helper; reschedule paths at `bookingController.js:1633`, `:1767` | S |
| 2 | **Start the taste clock at first booking** (fallback: signup) | same helper; one `min(bookings.created_at)` lookup | S |
| 3 | **Taste countdown + day-61 notice** with the host's real reminder count (T1, T2, T3) | new daily job on `notification_logs` + `inAppNotify` + email/WhatsApp event | M |
| 4 | **Founding counter** — public, cached count of paying Pro subs | new `GET /api/plans/founding` + Pricing, `/dashboard/upgrade`, PlansStep | S |
| 5 | **Pricing copy** — founding ₹999 locked for life, "X of 100 left", then ₹1,499; taste rows say "Free for your first 2 months of bookings" | `client/src/data/plans.js` (`PREMIUM_PLAN`, `PLAN_MATRIX`), `UpgradePlan.jsx` | S |
| 6 | **Onboarding: Free first** — "Go live free, WhatsApp reminders included for 60 days"; founding Pro underneath | `PlansStep.jsx` | S |
| 7 | **Turn on weekly recap + activation nudges** | Render env `WEEKLY_RECAP_ENABLED=true`; v3.163 `notification_events` rows | config |
| 8 | **Upgrade funnel events** (`{trigger, founding}`) | `hostNudges.js` consumers, `UpgradePlan.jsx`, payment verify | S |

### P1 — next 2–4 weeks

| # | Change | Where |
|---|---|---|
| 9 | **Founding lock mechanics:** `premium_founding` archived plan row (₹199/₹999); new founding subs land on it; monthly ↔ yearly switches stay on it | migration on the live DB + `subscriptionService` checkout/switch + `planService.FALLBACK_PLANS` |
| 10 | **Founding badge** on the public profile | `badgeEngine.js` |
| 11 | **Cutover runbook + alert at 90 and 100** paying subs: raise `premium.annual_price` → 1499 in admin (auto-creates a new Razorpay plan), update `plans.js` + `FALLBACK_PLANS` + `plans.pricing.test.js` | `docs/` runbook + founder alert (email/in-app) |
| 12 | **CRM count teaser** (T4) — show the total, lock rows beyond 10 | `ClientsList.jsx`, `crmService.listClients` (return total) |
| 13 | **Break-even trigger** on rolling 30-day commission instead of ₹300 lifetime (T5) + payout email line (T6) | `upgradeNudge.js`, `hostNudges.js`, `payoutEmails.js` |
| 14 | **Founding-scarcity email** to earning Free hosts at ≤ 20 spots (T8) | `upgradeNudge.js` (one-shot, deduped on `email_logs`) |
| 15 | **Repeat-client trigger** (T7) | `bookingConfirmation.js` + `inAppNotify` |
| 16 | Remove phantom `features` keys; fix stale "Host+/Studio" comments | `subscription_plans.features` migration, `AdminPlans.jsx`, `upgradeNudge.js`, `bookingController.js` |

### P2 — 1–2 months (make Pro "the actual Meeticulous")

| # | Feature | Why |
|---|---|---|
| 17 | "Your Pro month" value statement | Keeps founding members; makes Pro's invisible work visible |
| 18 | Cancel flow: saved ₹ + "you'll lose your founding price" + pause | Retention |
| 19 | Discount codes | Most-requested selling tool; increases GMV on both plans |
| 20 | Intake questions at booking | Coaches, therapists and consultants need them before a session |
| 21 | Multi-session packages | Raises order value |
| 22 | "Booked on Meeticulous" mark on Free + removal on Pro | Acquisition loop (fits "Free = acquisition") + an obvious Pro perk |
| 23 | Booking-page analytics (views → bookings) | Answers "is my link working?" |
| 24 | Lapsed-client list + one-tap nudge | The daily CRM habit |
| 25 | "Today's schedule" morning message | Daily habit; email on Free, WhatsApp on Pro |

### P3 — after the founding 100

Price review at ~300 Pro (yearly/monthly mix, break-even) · Studio tier for teams · USD checkout ·
WhatsApp at subscription halt.

### Success metrics

- **Activation:** % of signups reaching `host_first_booking` within 30 days (baseline ≈ 8% on the old DB)
- **Taste conversion:** % of hosts who upgrade within 14 days of their taste ending — the main conversion rate
- **Founding progress:** paying Pro count vs 100, weekly
- **Pro retention:** month-3 / month-12 renewal; yearly share of new subs
- **Guardrail:** support tickets about missed reschedules on Free after day 60
