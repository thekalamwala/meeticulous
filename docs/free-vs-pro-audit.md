# Free vs Pro — Monetisation & Habit Audit (2026-11-03)

**Question:** would a host genuinely *want* to pay for Pro? Where is Starter (free) too generous,
where does it frustrate for no good reason, and does Pro deliver value a host can feel?

**Goal it is judged against:** Starter is generous enough to run and grow a real business; Pro is
the obvious next step once the business is growing. Optimise for value delivered, not for forcing
upgrades.

**Sources:** live `subscription_plans` rows + live DB counts (project `spquowzrefozmrzoszkf`,
read-only), `server/middleware/planMiddleware.js`, `server/services/planService.js`,
`server/controllers/bookingController.js`, `server/services/{upgradeNudge,weeklyHostRecap,activationNudges,followups/*}.js`,
`client/src/data/plans.js`, `client/src/lib/hostNudges.js`, `client/src/pages/{UpgradePlan,onboarding/PlansStep}.jsx`,
`docs/activation-funnel.md`, `docs/DECISIONS.md` (ADR-006, ADR-011).

---

## 0. TL;DR

1. **The model is right; the gates are in the wrong places.** Starter earns us 5% of every paid
   booking, so a free host who is earning is *revenue*, not cost. The job of Starter is to make
   hosts earn more. Today three gates take away *operational reliability* (reschedule alerts,
   WhatsApp reminders after 60 days, seeing your own client list) — the things that make a host
   trust the product — instead of gating *growth* features.
2. **Pro sells exactly one thing a host understands on day one: 0% commission.** Everything else
   (1-hour reminder, rebook automation, full CRM, unlimited AI) is "more of" or invisible until
   used. Pro needs 3–4 growth features hosts can name: packages, discount codes, intake questions,
   branding removal, booking-page analytics.
3. **The upgrade math is extremely strong — maybe too strong.** Pro yearly (₹1,179) pays for itself
   at ~₹1,965/month of bookings. A host doing ₹20k/month pays us ~₹12,000/yr on Starter and
   ₹1,179/yr on Pro. Hold prices until there are paying hosts to learn from (§6), but know that
   our best hosts are steered to a ~90% discount.
4. **Habit loops are built but switched off.** The weekly host recap (`WEEKLY_RECAP_ENABLED`)
   and stage-based activation nudges (event rows seeded inactive in v3.163) both exist and
   don't send. Turning them on is the cheapest retention win available.
5. **Onboarding asks for money before value.** `PlansStep.jsx:215` leads with "Go live with
   everything unlocked on Pro — or start free below." A brand-new host has earned ₹0; the first
   ask should come after the first booking.

**Data caveat:** the live DB was reset on 2026-10-30 (rebrand). It holds 3 host profiles, 2
services and 0 bookings, all on `free`. There is no usage data on this DB to tune limits from.
The previous DB's funnel (`docs/activation-funnel.md`) recorded ~5 activated hosts out of ~65
signups. **Activation, not conversion, is the bottleneck.** Every recommendation below is ranked
with that in mind.

---

## 1. Current Free vs Pro feature audit

Live `subscription_plans` (prices ex-GST; customer pays +18%):

| Capability | Starter (`free`) | Pro (`premium`) | Enforced where | Verdict |
|---|---|---|---|---|
| Price | ₹0 | ₹199/mo · ₹999/yr (₹235 · ₹1,179 incl. GST) | Razorpay subscription | see §6 |
| Commission on paid bookings | **5%** | **0%** | `commission_percentage` → `bookingController.js:440` | ✅ the core lever |
| Guest booking fee | ₹10 + GST (guest pays) | same | `platform_settings.platform_fee` | neutral |
| Paid services | Unlimited | Unlimited | `limits.services = -1` | ✅ keep |
| Bookings/year | Unlimited | Unlimited | `limits.bookings_per_year = -1` | ✅ keep — never cap (guest-facing error) |
| Free (₹0) services | 2 | Unlimited | `canAddFreeService` | ✅ fair: ₹0 bookings earn nothing |
| Booking page, UPI/card, GST invoices, payouts | ✓ | ✓ | — | ✅ keep |
| Google Calendar + Meet | 1 calendar | 2 (Google + iCal) | `calendar_integrations` | ✅ fine |
| Confirmation (email + WhatsApp) | ✓ | ✓ | NotificationEngine | ✅ |
| 24h reminder | ✓ | ✓ | `reminder_flows = 1` | ✅ |
| 1h reminder | ✗ | ✓ | `reminder_flows` → `reminderWindowsForPlan` | ✅ good Pro perk |
| WhatsApp reminders | First 60 days only, then email | ✓ | `whatsappRemindersAllowed` `bookingController.js:1827` | ⚠️ **frustrating** — see §2 |
| Reschedule notifications (email/WhatsApp to guest + host) | ✗ (in-app only) | ✓ | `rescheduleNotifyForPlan` `planService.js:122` | ❌ **wrong gate** — see §2 |
| Client CRM | 10 most recent clients | Full | `limits.crm = 10` → `requireCrm` + `crmService.listClients` | ⚠️ **feels like data held hostage** |
| Follow-up / rebook automation | ✗ | ✓ (day 3 + day 21) | `followup_flows` → `followups/flowRegistry.js` | ✅ great Pro perk, under-sold |
| Digital products | 3 | Unlimited | `checkProductLimit` | ✅ fine |
| AI service writing | 10 per 6 months | Unlimited | `ai_generations` + `WINDOW_DAYS` | ✅ fine |
| Support | Email | Priority WhatsApp + email | `support_type` (manual) | ✅ |
| `features.*` JSON (data_export, advanced_reports, client_notes, custom_fields, recurring_clients, multiple_schedules, custom_branding, priority_feature_access) | mixed | all true | **nothing reads them** | ❌ phantom — build or delete |

Upgrade surfaces that exist today:

| Surface | Trigger | File |
|---|---|---|
| Onboarding plan step | Every new host, before going live | `client/src/pages/onboarding/PlansStep.jsx` |
| Dashboard "Next step" card | Free host with commission paid > 0 or a real earning | `client/src/lib/hostNudges.js` (priority 80) |
| Upgrade email | First time cumulative commission ≥ ₹300 (≈ ₹6,000 GMV) | `server/services/upgradeNudge.js` |
| 403 `upgrade_required` | Hitting product/CRM caps | `planMiddleware.js` `blockResponse` |
| `/dashboard/upgrade` "Why hosts upgrade" band | Free hosts visiting the page | `UpgradePlan.jsx` |
| Pricing page matrix | Public | `client/src/data/plans.js` `PLAN_MATRIX` |

The commission card and email are the best things here: they quote the host's own rupees, so the
upgrade is a calculation rather than a pitch. Keep that tone everywhere.

---

## 2. Free vs Pro balance

### Too generous on Starter?

Barely. Under a commission model, unlimited services and bookings on Starter is the *correct*
choice — every paid booking pays us. The only real gap is that Starter gives nothing back to the
platform when a host has **no** paid bookings:

- **No growth loop on the free booking page.** There is no "Booked on Meeticulous" mark on the
  public profile, booking confirmation, or guest emails (no `Powered by` anywhere in the public
  pages). Every guest who books is a prospective host who never sees the brand. Add a small
  footer mark on Starter; removing it becomes a Pro perk. This is the standard freemium trade and
  rarely frustrates anyone.

Nothing else should be taken away from Starter.

### Restricting the wrong things on Starter

These three gates cost hosts trust and save us almost nothing:

1. **Reschedule notifications are Pro-only.** When a guest reschedules a Starter host's booking,
   neither side gets an email or WhatsApp — only an in-app notice. A host who turns up at the old
   time, or a guest who never got the new time confirmed, blames Meeticulous, not their plan.
   This is basic reliability. It's also coupled to `reminder_flows` (`rescheduleNotifyForPlan`
   returns true only when a plan gets *every* reminder window), so it was a side effect of the
   reminder gate rather than a deliberate pricing choice. **Unlock for all plans.**

2. **WhatsApp reminders switch off after 60 days.** The cliff lands right when a host has started
   to rely on it. Every host with paid bookings already pays 5% per booking. WhatsApp utility
   messages cost a few paise to low single-digit rupees each (check the AiSensy invoice for the
   exact rate), so the commission on a ₹500 booking (₹25) covers the message many times over.
   **Recommendation:** keep WhatsApp confirmations and the 24h reminder on Starter permanently
   for *paid* bookings; apply the 60-day/email fallback only to ₹0 bookings, which earn nothing.
   Pro keeps "WhatsApp on everything + 1h reminder".

3. **CRM shows only the 10 most recent clients.** Hiding a host's own customers behind a paywall
   reads as data held hostage, and it removes the screen most likely to become a daily habit
   (§4). **Recommendation:** Starter sees *every* client with contact details and booking
   history (read-only). Pro gets what turns a list into a growth tool: notes, tags, a lapsed-client
   view ("hasn't booked in 45 days"), CSV export, and the automated rebook flow. The upgrade moment
   becomes "I want to *do* something with these clients", not "where did my clients go?"

### Restrictions that are fine (keep)

2 free services, 3 digital products, 10 AI generations per 6 months, 1 calendar, 1h reminder on Pro
only, rebook automation on Pro only. Each one caps *extra* capability, never the core job of
getting booked and getting paid.

---

## 3. Value perception — does Pro sell itself?

**What a host understands in 5 seconds:** "0% commission — keep every rupee." That's it.

**What they don't feel until they've used it:** 1h reminders (an avoided no-show doesn't show up
anywhere), rebook automation (no report shows the rebookings it caused), unlimited AI (Starter's
10 is plenty for most hosts), iCal (niche).

So Pro's value depends entirely on the host's GMV. A host earning ₹1,500/month has no reason to
upgrade, and nothing on Pro speaks to them. Three fixes:

1. **Make Pro's invisible work visible.** A monthly "Your Pro month" statement: commission saved
   (₹), reminders sent, guests who rebooked after an automated nudge, revenue from those
   rebookings. The data is already there (bookings snapshot `commission_percentage`, followups
   rows, reminder flags). This is the single biggest retention lever for Pro (§7).
2. **Give Pro growth features hosts can name.** Today Pro has none of the features booking-tool
   buyers compare on. Confirmed absent from the codebase: discount codes, multi-session
   packages, group/batch sessions, waitlist, custom domain, branding removal. Intake questions
   (`custom_fields`) exist only as a phantom `features` flag. See §5 for which to build and in
   what order.
3. **Delete the phantom `features` keys, or build them.** `subscription_plans.features` lists
   `advanced_reports`, `data_export`, `client_notes`, `custom_fields`, `recurring_clients`,
   `multiple_schedules`, `custom_branding`, `priority_feature_access`. Nothing on the server reads
   them. `plans.js` already keeps them off the pricing page (good), but AdminPlans shows them, and
   they invite someone to market a feature that doesn't exist.

---

## 4. Habit formation — becoming part of the host's day

A booking product earns a daily habit from two things only: **money** and **the calendar**. The
weekly recap's header (`weeklyHostRecap.js`) already says this. The loops:

| Loop | Cadence | Status today | Action |
|---|---|---|---|
| Weekly recap: earned, booked, upcoming | Weekly | **Built, OFF** (`WEEKLY_RECAP_ENABLED !== 'true'`, line 111) | Turn on. Free + Pro. |
| Activation nudges (add service → share → first booking → payout) | Stage-based | **Built, effectively OFF** (flag absent so fails open, but `notification_events` rows seeded inactive in v3.163) | Activate the 4 events after checking the templates |
| "Today's schedule" morning message | Daily, only on days with bookings | Not built | Email on Starter, WhatsApp on Pro. Reuses reminder queries. |
| Payout landed | Per payout | Built (`payoutEmails.js`) | Add one line: commission paid this month (Starter) / saved (Pro) |
| Review received | Per review | Built | Show on dashboard; reviews keep hosts coming back |
| Lapsed clients | Weekly | Not built | Dashboard list on Starter (count + names); Pro gets the one-tap "nudge them" action |
| Birthday greetings | Per guest | Built, flag ON | Keep |

Rule: never send a host a "you earned ₹0" message (the recap's `worthSending` already does this
right). Silence beats noise.

---

## 5. Aha moments, conversion triggers, placements

### Aha moments (protect these — no upgrade prompts before them)

1. **Page live + shared** (`profile_link_shared`)
2. **First paid booking** (`host_first_booking`) — the real aha
3. **First payout lands in the bank**
4. **First repeat client** — proof the business compounds
5. **First review**

**Rule:** a host sees no upgrade prompt until after aha #2. The only exceptions are pages the host
opens themselves (`/pricing`, `/dashboard/upgrade`). That means flipping onboarding: Starter is the
primary "Go live free" button, and Pro is one line underneath ("Pro removes the 5% commission —
most hosts switch once they're earning ₹2,000+/month").

### Conversion triggers

Each trigger is a moment where Pro solves a problem the host is having *right now*:

| # | Moment | Signal | Message (host's own numbers) | Placement | Frequency |
|---|---|---|---|---|---|
| T1 | Commission crosses Pro's break-even | Rolling 30-day commission ≥ ₹98 (yearly) | "You paid ₹X commission this month. Pro yearly is ₹98/month and takes 0%." | Earnings page savings meter (always visible) + Next-step card | Card once per 30 days |
| T2 | Payout lands | Payout email | One footer line: "₹X went to commission this month — ₹0 on Pro." | Payout email | Every payout, one line, no banner |
| T3 | First repeat client | 2nd non-cancelled booking from the same guest phone | "Priya booked again. Pro asks clients like her to rebook automatically on day 3 and day 21." | In-app notification + CRM row badge | Once |
| T4 | Lapsed clients pile up | ≥5 clients with no booking in 45 days | "7 clients haven't rebooked. Pro sends them a nudge for you." | CRM lapsed list (Starter sees list, action locked) | Weekly at most |
| T5 | No-show / late cancel | Booking marked no-show or cancelled < 2h before | "A 1-hour WhatsApp reminder cuts last-minute no-shows. On Pro." | Booking detail | Once per 30 days |
| T6 | Hits a cap | 4th product, 11th AI generation, 3rd ₹0 service | Existing 403 copy, plus the specific Pro benefit | Inline at the action | At the action |
| T7 | Wants a growth feature | Clicks a locked Pro control (discount code, package, intake form) | Show the control, explain it, one-tap upgrade | Inline | At the action |

Already exists: T1 in partial form (card + ₹300-lifetime email) and T6. Tighten T1 from a
**lifetime** ₹300 threshold to a **rolling-30-day break-even**, so the message reads "this pays
for itself", not "you've paid us a lot".

**Never:** modal popups on login, countdown timers, prompts during the booking/checkout flow, or
anything a guest can see.

**Measure:** add PostHog events `upgrade_prompt_viewed {trigger}`, `upgrade_started {trigger}`,
`upgrade_completed {trigger, cadence}` so every trigger's conversion is measurable from day one.

---

## 6. Recommended allocation, limits & pricing

### Starter — "Run your business"

- Unlimited paid services and bookings, booking page, UPI/card, GST invoices, payouts
- Confirmations + 24h reminder by **email and WhatsApp, permanently for paid bookings** *(change)*
- **Reschedule and cancellation alerts to host and guest** *(unlock)*
- **Full client list** with contact details and booking history, read-only *(unlock)*
- Weekly recap, payout emails, review collection, birthday greetings
- 2 free (₹0) services · 3 digital products · 10 AI generations per 6 months · 1 calendar
- 5% commission on paid bookings
- Small "Booked on Meeticulous" mark on the public page and guest emails *(add)*

### Pro — "Grow and automate"

- **0% commission**
- 1h reminder; WhatsApp on everything, ₹0 bookings included
- **Client growth:** notes, tags, lapsed-client view, one-tap nudge, CSV export *(new gates on existing data)*
- **Rebook automation** (day 3 + day 21) — already built
- **Sell more:** discount codes, multi-session packages *(build)*
- **Know your guest:** intake questions at booking *(build)*
- **Your brand:** remove the Meeticulous mark *(build)*
- **Booking-page analytics:** views → bookings conversion *(build)*
- Unlimited products, AI, ₹0 services; 2 calendars; priority WhatsApp support
- Monthly "Your Pro month" value statement *(build)*

### Limits

Keep every current numeric limit. The live DB has no usage data that would justify a change, and
none of the current caps blocks the core job. Revisit once 50+ hosts have taken paid bookings.
Re-check: is `free_services: 2` blocking hosts whose model is "free discovery call → paid
session"? If many hosts hit it, go to 3.

### Pricing considerations

Break-even (5% commission vs Pro, GST-inclusive):

| Pro cadence | Cost / month | GMV at which Pro pays for itself |
|---|---|---|
| Monthly ₹235 | ₹235 | **₹4,700/month** |
| Yearly ₹1,179 | ₹98 | **₹1,965/month** |

What we earn from one host:

| Host GMV / month | Starter (5%) / yr | Pro yearly / yr | Our revenue change on upgrade |
|---|---|---|---|
| ₹5,000 | ₹3,000 | ₹1,179 | −61% |
| ₹20,000 | ₹12,000 | ₹1,179 | −90% |
| ₹50,000 | ₹30,000 | ₹1,179 | −96% |

Implications:

1. **Upgrading is excellent value for hosts.** That fits "make upgrading obvious". It also means
   every successful host who does the maths moves to a flat ₹1,179/yr. Pro is a volume discount
   with no ceiling.
2. **The yearly discount (58%) is unusually steep.** It makes monthly look overpriced next to
   yearly, and it is the main reason the break-even is so low.
3. **Recommendation: change nothing now.** With 0 paying hosts on this DB, a price change is a
   guess. Revisit when **20–30 hosts are paying**, and consider in this order:
   - (a) a smaller yearly discount (~35–40%, e.g. ₹1,499–₹1,799 ex-GST) — keeps "0% commission",
     raises the break-even modestly;
   - (b) a higher tier (the "Studio" name already in `CLAUDE.md`) for multi-staff / high-volume
     hosts: team calendars, multiple booking pages, payouts per staff member;
   - (c) **not** reintroducing commission on Pro — "keep every rupee" is the brand promise and
     ADR-011's rationale.
4. **Optional Pro perk to test:** a Pro host can absorb the ₹10 guest booking fee, so the price on
   the page is what the guest pays. It costs us ₹10 + GST per Pro booking and makes the booking
   page look cleaner. Model it first, then test with a few hosts.

---

## 7. Retention & expansion for Pro

1. **"Your Pro month" statement** (email + dashboard card, monthly): commission saved, reminders
   sent, rebookings from automation and the revenue they brought in. If the saved amount is less
   than the plan cost, say so plainly and suggest yearly — honesty buys trust.
2. **Yearly is the default selection** on the upgrade page. It's already the better deal, and
   yearly hosts churn less.
3. **Cancel flow:** show the host's saved-₹ figure, offer a 1-month pause (keep the mandate,
   skip a cycle) before cancelling. Downgrading never deletes data — `resolveVendorPlan` already
   guarantees this; say it in the UI.
4. **Dunning:** `subscriptionReconciler` + the `SUBSCRIPTION_HALTED` in-app notice exist. Add
   one WhatsApp at halt, since a failed UPI mandate is usually a bank-side issue the host can fix
   in a minute.
5. **Expansion:** Studio tier (teams) when 2+ Pro hosts ask for staff seats; USD pricing is
   already designed (`PREMIUM_PLAN_USD`, display-only).

---

## 8. Prioritised roadmap

Ranked by (impact on activation & trust) ÷ effort. P0 items are config or small code changes.

### P0 — this release (days)

| # | Change | Where | Type |
|---|---|---|---|
| 1 | Turn on weekly host recap | Render env `WEEKLY_RECAP_ENABLED=true` | config |
| 2 | Activate the 4 activation-nudge events (after reviewing templates) | `notification_events` rows from v3.163 | data |
| 3 | Onboarding: Starter primary, Pro secondary with break-even line | `client/src/pages/onboarding/PlansStep.jsx` | copy/UI |
| 4 | Reschedule/cancel alerts for every plan | `planService.rescheduleNotifyForPlan` → always true (or a new `limits.reschedule_alerts`) | small code |
| 5 | WhatsApp reminders permanent for paid bookings on Starter | `bookingController.whatsappRemindersAllowed` — pass the booking, allow when price > 0 | small code |
| 6 | Add `upgrade_prompt_viewed/started/completed {trigger}` events | `hostNudges.js` consumers, `UpgradePlan.jsx`, payment verify | small code |

### P1 — next 2–4 weeks

| # | Change | Where |
|---|---|---|
| 7 | Full client list on Starter; gate notes/tags/lapsed actions/export on Pro | `limits.crm` semantics, `crmService.listClients`, `requireCrm`, ClientsList/ClientDetail |
| 8 | Earnings-page savings meter + payout-email commission line (T1, T2) | Earnings page, `payoutEmails.js` |
| 9 | Rolling-30-day break-even trigger instead of ₹300 lifetime | `upgradeNudge.js`, `hostNudges.js` |
| 10 | Repeat-client trigger (T3) | `bookingConfirmation.js` + `inAppNotify` |
| 11 | Remove phantom `features` keys (or mark them "planned") | `subscription_plans.features` (migration), `AdminPlans.jsx` |
| 12 | Fix stale comments ("Host+/Studio", "Studio-tier perk") | `upgradeNudge.js`, `bookingController.js` |

### P2 — 1–2 months (Pro growth features)

| # | Feature | Why first |
|---|---|---|
| 13 | "Your Pro month" value statement | Retention: makes Pro's invisible work visible |
| 14 | "Booked on Meeticulous" mark on Starter + removal on Pro | Growth loop + an instantly understood Pro perk |
| 15 | Discount codes | Most-requested selling tool; drives GMV on both plans |
| 16 | Intake questions at booking | Coaches, therapists and consultants need these before a session |
| 17 | Multi-session packages | Raises order value; strong reason to upgrade |
| 18 | Booking-page analytics (views → bookings) | Answers "is my link working?" — reinforces the share habit |
| 19 | Lapsed-client list + one-tap nudge (T4) | Built on P1-7; the daily CRM habit |
| 20 | "Today's schedule" morning message | Daily habit; email on Starter, WhatsApp on Pro |

### P3 — when data exists (20–30 paying hosts)

| # | Change |
|---|---|
| 21 | Pricing review: yearly discount, break-even, monthly vs yearly mix (§6) |
| 22 | Studio tier for teams / high-volume hosts |
| 23 | Pause-instead-of-cancel flow |
| 24 | USD checkout (Razorpay International) |

### Success metrics

- **Activation:** % of signups reaching `host_first_booking` within 30 days (baseline ≈ 5/65 ≈ 8% on the old DB)
- **Habit:** % of hosts with ≥1 booking in 3 of the last 4 weeks
- **Conversion:** % of hosts past the yearly break-even (₹1,965/mo GMV) who upgrade within 60 days — the only conversion rate that matters; conversion among non-earning hosts should stay near zero, by design
- **Pro retention:** month-3 and month-12 renewal rate; yearly share of new Pro subs
- **Trust guardrail:** support tickets about missed reschedules / reminders → should go to zero after P0-4/5
