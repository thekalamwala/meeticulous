# Pro growth features (P2) — make Pro "the actual Meeticulous"

**Why:** after the founding 100, Pro needs features hosts can *name*, beyond 0% commission and
WhatsApp reminders. Confirmed absent from the codebase on 2026-11-03: discount codes, packages,
group sessions, waitlist, custom domain, branding removal. Intake questions exist only as a phantom
`custom_fields` key.
**Depends on:** P0 (taste + founding counter) and P1 (founding lock, triggers) — see
[`../free-vs-pro-audit.md`](../free-vs-pro-audit.md) §7.

Suggested order: 1 → 2 → 3 → 4 → 5, then the rest by demand.

---

### 1. "Your Pro month" value statement
- **What:** monthly email + dashboard card: commission saved, WhatsApp reminders sent,
  reschedules handled, rebookings from automation and their revenue.
- **Options:** (a) email + card from a monthly job; (b) card only (cheaper, less reach).
  **Recommend (a).**
- **Lands in:** new `server/services/proMonthStatement.js` (pattern: `weeklyHostRecap.js`),
  `SCHEDULED_JOBS` in `server.js`, a template in `config/emailTemplates.js`, a card in
  `hostNudges.js`. Data: `bookings.commission_percentage` snapshot (what 5% would have been),
  `reminder_*_sent`, `followups` rows.
- **Rule:** if saved < plan cost, say so and suggest yearly.

### 2. Cancel flow
- **What:** before cancel → show saved ₹, "you'll lose your founding price for good", offer a
  1-month pause.
- **Options:** pause = (a) Razorpay `pause` on the subscription; (b) cancel + a reminder to
  resubscribe. **Recommend (a)** if Razorpay pause works with UPI mandates (verify), else (b).
- **Lands in:** `UpgradePlan.jsx` manage section, `razorpaySubscriptions.js`.

### 3. Discount codes
- **What:** host creates codes (% or ₹ off, expiry, max uses, per service or all).
- **Options:** (a) Pro-only; (b) Free gets 1 active code, Pro unlimited. **Recommend (b)** —
  it lifts GMV on both plans (5% of more is still more) and teaches the feature.
- **Lands in:** new `discount_codes` table (migration on BOTH DBs + schema fallback),
  `pricingEngine.js` (pure: apply discount before commission), `bookingController` create, the
  booking UI. **Snapshot the discount on the booking** (ADR-003).

### 4. Intake questions at booking
- **What:** per-service custom questions (text / choice / yes-no), answers on the booking + in the CRM.
- **Options:** (a) Pro-only; (b) Free 1 question, Pro unlimited. **Recommend (a)** — it's the
  clearest "professional" signal for coaches and therapists.
- **Lands in:** `services.intake_questions jsonb`, `bookings.intake_answers jsonb`,
  ServiceBooking flow, ClientDetail. Remove the phantom `features.custom_fields` then.

### 5. Multi-session packages
- **What:** sell "5 sessions for ₹X"; guest books each session against the package balance.
- **Options:** (a) prepaid credits per guest; (b) a recurring weekly slot series. **Recommend
  (a)** first — simpler, raises order value.
- **Lands in:** `packages` + `package_credits` tables, a payment path (commission on the package
  price), and the booking flow consuming a credit. Biggest of the five — spec it first.

### 6. "Booked on Meeticulous" mark (Free) + removal (Pro)
- **What:** small footer mark on the public profile, service page and guest emails for Free;
  Pro hides it. An acquisition loop that fits "Free = acquisition".
- **Lands in:** public profile/service pages, guest email layout, a
  `limits.hide_branding` or `features.custom_branding` gate (reuse the existing key, make it real).

### 7. Booking-page analytics
- **What:** views → booking starts → paid, per service, last 30 days.
- **Options:** (a) read PostHog via its API; (b) count our own `host_profile_viewed` /
  `booking_started` events into a table. **Recommend (b)** — no third-party dependency for a host-facing number.
- **Lands in:** `eventsRoutes.js` ingest → a daily rollup table, a dashboard card.

### 8. Lapsed-client list + one-tap nudge
- **What:** clients with no booking in 45 days. Free sees the count; Pro sees the list and can
  send a rebook nudge (WhatsApp/email) in one tap.
- **Lands in:** `crmService` (`LAPSE_DAYS` already exists), `followups` (reuse the rebook flow).

### 9. "Today's schedule" morning message
- **What:** 8am IST message on days with bookings. Email on Free, WhatsApp on Pro.
- **Lands in:** `SCHEDULED_JOBS` with `when: istHour() === 8`, reuse the reminder queries;
  needs a WhatsApp template.

---

## P3 — after the founding 100

- **Price review at ~300 Pro:** yearly/monthly mix, break-even, whether monthly moves.
- **Studio tier** for teams: staff calendars, multiple booking pages, per-staff payouts.
- **USD checkout:** Razorpay International + USD plans (`PREMIUM_PLAN_USD` is display-only today).
- **WhatsApp at subscription halt** (template needed).
