# Host Lifecycle — Nurturing Hosts to Try and Pay for Pro

Companion to [`free-vs-pro-audit.md`](free-vs-pro-audit.md). This is the message map: what each
host hears, on which channel, at which stage. It sells Pro by letting hosts *experience* it
first, then telling them plainly what they'll lose.

**Strategy recap:** Free = acquisition scheduler (5% commission). New hosts get **WhatsApp
reminders + reschedule alerts for 60 days, counted from their first booking**. The first 100 Pro
hosts pay **₹999/yr, locked for life**, then Pro yearly is ₹1,499.

---

## Channels and rules

| Channel | Used for | Rules |
|---|---|---|
| **Dashboard** (Next-step card + bell) | Every stage — the always-on surface | One card at a time (`client/src/lib/hostNudges.js` ranks them). Money-stuck > taste > conversion > activation. Snoozable except KYC. |
| **Email** | Milestones, countdowns, monthly numbers | ≤ 1 upgrade-type email per host per 7 days. Marketing events honour unsubscribe (`communicationEngine.MARKETING_EVENTS`). |
| **WhatsApp** | Only the 2–3 moments that matter most | Needs an AiSensy/Meta-approved template per event (founder submits). Ships **OFF** (`notification_events.whatsapp_enabled=false`). Quiet hours 09–20 IST. ≤ 1 marketing WhatsApp per 14 days. |

Never: login popups, invented countdowns, anything a guest can see, messages to hosts who
haven't booked ("you earned ₹0").

---

## The stages

| # | Stage | Entry signal | Dashboard | Email | WhatsApp | Built |
|---|---|---|---|---|---|---|
| 1 | **Signed up, no service** | `profiles.is_host`, 0 services | "Add your first service" card | `HOST_ADD_SERVICE_NUDGE` | same event (template) | ✅ exists, events OFF |
| 2 | **Listed, not shared** | ≥1 service, never shared | Share hero | `HOST_SHARE_LINK_NUDGE` | same | ✅ exists, events OFF |
| 3 | **Shared, no booking (7d)** | shared ≥ 7d ago, 0 bookings | Share hero | `HOST_FIRST_BOOKING_NUDGE` | same | ✅ exists, events OFF |
| 4 | **First booking → taste starts** | first confirmed booking | Card: "WhatsApp reminders are on for 60 days" | `PRO_TASTE_STARTED` | — | **P0** |
| 5 | **Taste, day 45** | 15 days left | Card: "15 days of WhatsApp reminders left" | — | — | **P0** |
| 6 | **Taste, day 55** | 5 days left | Card with countdown + founding price | `PRO_TASTE_ENDING` (N reminders sent, spots left) | `PRO_TASTE_ENDING` | **P0** |
| 7 | **Taste ended** | day 60 | Card: "WhatsApp reminders are off" (until upgrade or dismissed) | `PRO_TASTE_ENDED` | — | **P0** |
| 8 | **Free, earning** | paid bookings after taste | Earnings meter; Next-step card at break-even | `UPGRADE_COMMISSION_NUDGE` (rolling 30-day break-even) | — | **P1** |
| 9 | **Payout lands** | payout sent | — | One line in `PAYOUT_SENT`: commission paid this month | — | **P1** |
| 10 | **First repeat client** | 2nd booking from the same guest | Bell: "Priya booked again — Pro rebooks clients like her automatically" | — | — | **P1** |
| 11 | **CRM > 10 clients** | client count > 10 | CRM footer: "You have 23 clients — see all on Pro" | — | — | **P1** |
| 12 | **Founding spots ≤ 20** | counter ≤ 20 | Banner on upgrade page | `FOUNDING_SPOTS_LOW` (one-shot, earning free hosts) | — | **P1** |
| 13 | **Pro subscribed** | subscription active | Founding badge on profile | `SUBSCRIPTION_PURCHASED` (exists) | — | P1 (badge) |
| 14 | **Pro, monthly** | each month | "Your Pro month" card | Value statement | — | future |
| 15 | **Pro renewal / halt** | renewal due / mandate failed | Card | `SUBSCRIPTION_EXPIRING`, `SUBSCRIPTION_HALTED` (exist) | halt WhatsApp | future |
| 16 | **Cancel intent** | cancel clicked | Saved ₹ + "you'll lose the founding price" + pause | — | — | future |

---

## Message copy

Variables are in `{{ }}`. Email copy lives in `server/config/emailTemplates.js`. WhatsApp texts
below are for submission to AiSensy; the param order is what the code sends.

### PRO_TASTE_STARTED — email + dashboard (stage 4)
- **Subject:** Your first booking is in, {{first_name}} 🎉
- **Body:** For the next 60 days your guests get WhatsApp reminders, and both of you get
  reschedule alerts — that's Pro, on us. After {{taste_ends_on}} they switch to email unless you go Pro.
- **CTA:** See my bookings

### PRO_TASTE_ENDING — email + WhatsApp + dashboard (stage 6)
- **Subject:** 5 days left of WhatsApp reminders
- **Body:** Since your first booking, Meeticulous has sent WhatsApp reminders for
  {{reminded_count}} bookings. On {{taste_ends_on}} they switch to email. Keep them on with Pro —
  founding price ₹999/yr, locked for life. {{spots_left}} of 100 founding spots left.
- **CTA:** Keep WhatsApp reminders
- **WhatsApp template** (params: `[first_name, reminded_count, taste_ends_on, spots_left, upgrade_link]`):
  > Hi {{1}}, your guests have had WhatsApp reminders for {{2}} bookings. They switch to email on {{3}}. Keep them with Meeticulous Pro — founding price ₹999/yr, locked for life ({{4}} of 100 spots left): {{5}}

### PRO_TASTE_ENDED — email + dashboard (stage 7)
- **Subject:** WhatsApp reminders are now off
- **Body:** Your guests now get email reminders only, and reschedule alerts are off for you.
  Everything else stays the same — your page, bookings and payments keep working. Turn WhatsApp
  back on any time with Pro.
- **CTA:** Turn WhatsApp back on

### FOUNDING_SPOTS_LOW — email (stage 12)
- **Subject:** {{spots_left}} founding spots left
- **Body:** The founding Pro price — ₹999/yr, locked for life — closes after 100 hosts. After that
  Pro is ₹1,499/yr. You've paid {{commission_total}} in commission so far; Pro takes 0%.
- **CTA:** Claim a founding spot

---

## Measurement

Every prompt carries a `trigger` key. PostHog events: `upgrade_prompt_viewed {trigger}`,
`upgrade_started {trigger}`, `upgrade_completed {trigger, cadence, founding}`. The number to
watch is the **% of hosts who upgrade within 14 days of their taste ending**.

## Go-live checklist (founder)

1. Run `node server/scripts/seedEmailTemplates.js` after deploy (registers the new email events).
2. Submit the `PRO_TASTE_ENDING` WhatsApp template in AiSensy; when approved, set its
   `campaign_name` + `whatsapp_enabled=true` in admin → Notifications.
3. Turn on the existing loops: Render env `WEEKLY_RECAP_ENABLED=true`; activate the four v3.163
   activation events in admin → Notifications.
