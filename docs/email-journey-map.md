# Email Journey Map

Reference doc. Maps every user milestone → the email we send (or should send)
→ the template row that backs it. Grounded in live `email_templates` +
`notification_events` on project `spquowzrefozmrzoszkf` as of 2026-11-10.

Used together with [`docs/email-playbook.md`](email-playbook.md) (voice + design;
to be written) and [`config/emailTemplates.js`](../server/config/emailTemplates.js)
(the seed).

## Terminology

- **Milestone** — a state change in the user's life on Meeticulous (signup, KYC
  approved, first booking paid, …). Trigger-independent. Not every milestone
  gets an email; most should not.
- **Frame** — one of five email shapes (see §Frames). ONE per email.
- **Channel** — email / WhatsApp / in-app. Picked per milestone, not per user.
- **Governor** — `touchGovernor` + `sendGate`: ≤1 non-transactional / host /
  48h, quiet hours 09–20 IST, `crm_admin_sends` master switch (OFF today).

## Senders in play

From `email_senders` (prod, 2026-11-01):

| sender_key | Visible name | Root | Used for |
|---|---|---|---|
| `shubham` | Shubham, Meeticulous | team.meeticulous.com (Resend) | Founder-frame, milestones, PLAN_GIFT_RECEIVED |
| `tithi` | Tithi at Meeticulous | news.meeticulous.com (Brevo) | Lifecycle, onboarding, nudges |
| `crm_shubham` | Shubham \| CEO, Meeticulous | mail.meeticulous.in (Brevo, cold) | Cold outreach to leads only |
| `crm_tithi` | Tithi at Meeticulous | news.meeticulous.com (Brevo) | CRM to opted-in hosts |
| `bookings` / `payments` / `account` / `verify` / `news` | Function mailboxes | team.meeticulous.com (Resend) | Transactional |

Rule: a template's `sender_key` must match the frame. Shubham never sends a
receipt. Bookings never sends a founder note.

## Frames (pick one)

| Frame | Shape | Use for | Example event |
|---|---|---|---|
| **Receipt** | Hero line + 4–6 field record block + 1 CTA | Transactional state change | BOOKING_CONFIRMED_CUSTOMER, PAYOUT_SENT |
| **Ladder** | Numbered 3 steps, each a deep-link | Onboarding checklist | HOST_ADD_SERVICE_NUDGE (disabled) |
| **Loss** | What you lose if you don't act | Dunning, trial end | SUBSCRIPTION_HALTED, PRO_TASTE_ENDING |
| **Founder** | Plain text, 1 line, 1 ask, signed Shubham | Milestones, win-back, cold | MILESTONE_FIRST_BOOKING, GUEST_TO_HOST_INVITE |
| **Sectioned** | Emoji dividers + sections + 1 primary CTA | Newsletter, product update | NEWSLETTER_WELCOME |

Reference: Alpha Adventures (Receipt), Acuity (Ladder), OpenAI (Loss), Neil
Patel (Founder), Marketing Monk (Sectioned). See `email-playbook.md` for the
breakdown.

---

## Host journey

Seven milestones. Column `State` = what's live in DB today. `Frame` = what
shape it SHOULD be (not necessarily what it is).

### H0 → H1 : Signup → Verified identity

| Milestone | Trigger | Channel | Template | Sender | Frame | State |
|---|---|---|---|---|---|---|
| H0 Signup | OAuth success (Google/LinkedIn) | Email | `VENDOR_WELCOME` | tithi | Founder-lite | **live** |
| H0+2d No KYC | KYC not submitted 48h after signup | Email | *(none)* | tithi | Ladder | **MISSING** |
| H1a KYC submitted | KYC docs uploaded | In-app only | — | — | — | OK |
| H1b KYC approved | Admin approves KYC | Email | `KYC_APPROVED` | account | Receipt | live |
| H1c KYC rejected | Admin rejects KYC | Email + in-app | `KYC_REJECTED` | account | Receipt (loss) | live, self-clears on re-approve |

**Gap**: no "KYC not started" nudge. Hosts can stall here for weeks. Add Day-2
Ladder email (`HOST_START_KYC_NUDGE`, new event).

### H1 → H2 : Verified → First service created

| Milestone | Trigger | Channel | Template | Sender | Frame | State |
|---|---|---|---|---|---|---|
| H2a 0 services, 24h after KYC approved | Cron check | Email | `HOST_ADD_SERVICE_NUDGE` | tithi | Ladder | **DISABLED** (`is_active=false`) |
| H2b 1st service created | `services.insert` | — | *(none)* | — | — | OK — moment of truth, don't interrupt |

**Critical finding**: `HOST_ADD_SERVICE_NUDGE` exists but its event row is
`is_active=false` and `email_enabled=false`. The highest-value activation email
is OFF. Fix before any new copy.

### H2 → H3 : First service → First booking

| Milestone | Trigger | Channel | Template | Sender | Frame | State |
|---|---|---|---|---|---|---|
| H3a Page live, no share | 48h after 1st service, 0 visits | Email | `HOST_SHARE_LINK_NUDGE` | tithi | Ladder | **DISABLED** |
| H3b 7d no booking | Cron | Email | `HOST_FIRST_BOOKING_NUDGE` | tithi | Founder | **DISABLED** |
| H3c First booking lands | `bookings.insert` where host=X count=1 | Email + WA | `MILESTONE_FIRST_BOOKING` + `PRO_TASTE_STARTED` | shubham + tithi | Founder + Receipt | live |

**Pro Taste** = free 30-day Pro on first booking. Good mechanic, but a host
receives TWO emails simultaneously. Consolidate: one Shubham note that says
"first booking + here's a month of Pro on us" (Founder frame, embedded
receipt block).

### H3 → H4 : First booking → Earning habit

| Milestone | Trigger | Channel | Template | Sender | Frame | State |
|---|---|---|---|---|---|---|
| H4a Booking confirmed | `bookings.status=confirmed` | Email + WA | `BOOKING_CONFIRMED_VENDOR` | bookings | Receipt | live |
| H4b Session reminder | 24h + 1h before | Email + WA | `BOOKING_REMINDER_VENDOR` | bookings | Receipt | live |
| H4c Session complete | Marked complete | Email + WA | `BOOKING_COMPLETED_VENDOR` | bookings | Receipt | live |
| H4d First earning unlocked | Booking paid, earnings > 0 | Email | `KYC_EARN_NUDGE` | tithi | Founder | live — mis-named, this is the "you've earned" note |
| H4e Payout waiting 7d | Bank details missing | Email | `HOST_PAYOUT_WAITING_NUDGE` | tithi | Loss | **DISABLED** |
| H4f Payout verification | Needed | Email | `PAYOUT_VERIFICATION_NEEDED` | payments | Receipt | live |
| H4g Payout sent | Bank transfer | Email | `PAYOUT_SENT` | payments | Receipt | live |
| H4h Payout failed | Bank return | Email | `PAYOUT_FAILED` | payments | Loss | live |
| H4i Earning reversed | Refund | Email | `EARNING_REVERSED` | payments | Receipt | live |

**Gap**: no "payout delay — holiday" is actually `PAYOUT_DELAY_HOLIDAY` live,
good. `HOST_PAYOUT_WAITING_NUDGE` is the biggest money-left-on-table event
and it's OFF.

### H4 → H5 : Earning → Repeat

| Milestone | Trigger | Channel | Template | Sender | Frame | State |
|---|---|---|---|---|---|---|
| H5a Pro Taste ending 5d | Cron | Email | `PRO_TASTE_ENDING` | tithi | Loss | live |
| H5b Pro Taste ended | Day 30 | Email | `PRO_TASTE_ENDED` | tithi | Loss | live |
| H5c Founding spots low | Admin flag | Email | `FOUNDING_SPOTS_LOW` | news | Sectioned | live |
| H5d Commission threshold | Monthly cron | Email | `UPGRADE_COMMISSION_NUDGE` | news | Founder | live |
| H5e Plan gift received | Admin gifts | Email + in-app | `PLAN_GIFT_RECEIVED` | shubham | Founder | live |
| H5f Plan gift ending/ended | Cron | Email + in-app | `PLAN_GIFT_ENDING` / `_ENDED` | tithi | Loss | live |
| H5g Sub purchased | Razorpay success | Email | `SUBSCRIPTION_PURCHASED` | payments | Receipt | live |
| H5h Sub renewing 7d | Cron | Email | `SUBSCRIPTION_EXPIRING` | payments | Receipt | live |
| H5i Sub renewed | Razorpay charge | Email | `SUBSCRIPTION_RENEWED` | payments | Receipt | live |
| H5j Sub halted | Charge fail | Email + in-app | `SUBSCRIPTION_HALTED` | payments | Loss | live, self-clears on next charge |

Dense here. Right density — this is where revenue happens.

### H5 → H6 : Rhythm → Milestones

| Milestone | Trigger | Channel | Template | Sender | Frame | State |
|---|---|---|---|---|---|---|
| H6a 10 bookings | Count = 10 | Email | `MILESTONE_10_BOOKINGS` | news | Founder | live |
| H6b 50 bookings | Count = 50 | Email | `MILESTONE_50_BOOKINGS` | news | Founder | live |
| H6c 100 bookings | Count = 100 | Email | `MILESTONE_100_BOOKINGS` | news | Founder | live |
| H6d Badge unlocked | `vendor_metrics` | Email | `BADGE_UNLOCKED` | news | Founder | live |
| H6e Anniversary | Yearly | Email | `ACCOUNT_ANNIVERSARY` | *null* | Founder | live **sender missing** |
| H6f Birthday | `profiles.dob` | Email | `BIRTHDAY` | shubham | Founder | live |
| H6g Referral payout | `referrals.released` | Email + in-app | `REFERRAL_REWARD_RELEASED` | payments | Receipt | live |

**Gap**: `ACCOUNT_ANNIVERSARY` has no `sender_key`. Falls through to default.
Fix.

### H6 → H7 : Churn risk / win-back

| Milestone | Trigger | Channel | Template | Sender | Frame | State |
|---|---|---|---|---|---|---|
| H7a 30d no booking | Cron + `vendor_metrics` | Email | *(none)* | tithi | Founder | **MISSING** |
| H7b 60d no booking | Cron | Email | *(none)* | shubham | Founder | **MISSING** |
| H7c 90d dormant | Cron | Email | *(none)* | shubham | Founder (final) | **MISSING** |

**Biggest gap**. We have no churn-risk or win-back track for hosts. These are
the three highest-ROI emails we're not sending. Each needs its own event +
template + the sends-proof row.

---

## Guest journey

Shorter. Five milestones.

### G0 → G1 : Discover → First booking attempt

| Milestone | Trigger | Channel | Template | Sender | Frame | State |
|---|---|---|---|---|---|---|
| G0 Signup via OTP | OTP verified, first login | Email | `GUEST_WELCOME` | shubham | Founder | live |
| G1a Booking abandoned | Hold timeout, no payment | Email | `BOOKING_ABANDONED_CUSTOMER` | tithi | Receipt (Alpha pattern) | live |
| G1b Booking confirmed | Payment success | Email + WA | `BOOKING_CONFIRMED_CUSTOMER` | bookings | Receipt | live |

Alpha's hold-ended email is a gold reference for G1a — compare and match.

### G1 → G2 : Confirmed → Showed up

| Milestone | Trigger | Channel | Template | Sender | Frame | State |
|---|---|---|---|---|---|---|
| G2a 24h reminder | Cron | Email + WA | `BOOKING_REMINDER_CUSTOMER` | bookings | Receipt | live |
| G2b 1h reminder | Cron | WA only | — | — | — | live (WA) |
| G2c Rescheduled | Host or guest reschedules | Email + WA | `BOOKING_RESCHEDULED_CUSTOMER` | bookings | Receipt | live |
| G2d Cancelled | Either party cancels | Email + WA | `BOOKING_CANCELLED_CUSTOMER` | bookings | Receipt | live |

### G2 → G3 : Done → Review

| Milestone | Trigger | Channel | Template | Sender | Frame | State |
|---|---|---|---|---|---|---|
| G3a Session complete | Marked complete | Email + WA | `BOOKING_COMPLETED_CUSTOMER` | bookings | Receipt (+ review ask inline) | live |
| G3b No review 48h after | Cron | Email | *(none)* | tithi | Founder | **MISSING** |

### G3 → G4 : Return

| Milestone | Trigger | Channel | Template | Sender | Frame | State |
|---|---|---|---|---|---|---|
| G4a Rebook nudge 30d | Same host, no return | Email + WA | `REBOOK_NUDGE_CUSTOMER` | news | Founder | live |
| G4b Birthday | DOB | Email | `BIRTHDAY` | shubham | Founder | shared with hosts |
| G4c Anniversary | Yearly | Email | `ACCOUNT_ANNIVERSARY` | *null* | Founder | shared, sender missing |

### G4 → H0 : Guest → Host conversion

| Milestone | Trigger | Channel | Template | Sender | Frame | State |
|---|---|---|---|---|---|---|
| G5 Guest-to-host invite | completed_bookings ≥ 3 | Email | `GUEST_TO_HOST_INVITE` | news | Founder | live |

Our best conversion lever. Live, but subject line is weak. Reframe as Founder
(switch sender to shubham), rewrite as "one question, one line, reply yes".

---

## Cross-cutting tracks

### Auth / security (transactional, all audiences)

| Event | Sender | Frame | State |
|---|---|---|---|
| `AUTH_EMAIL_VERIFICATION` | verify | Receipt | live |
| `BOOKING_OTP` | verify (WA only, email off) | Receipt | live |
| `PASSWORD_RESET` | verify | Receipt | live |
| `SECURITY_LOGIN_ALERT` | verify | Receipt | live |
| `SECURITY_PASSWORD_CHANGED` | verify | Receipt | live |

### Community (hosts only today)

`COMMUNITY_MENTION`, `COMMUNITY_REPLY`, `COMMUNITY_CONTENT_REMOVED` — all live,
email + in-app, sender tithi. Community flags are OFF today (fail-closed).
Review when community phase 1 ships.

### Feedback

`FEEDBACK_STATUS_CHANGED` (vendor only) live, sender account.

### Cold outreach (CRM)

Separate flow. Lives on `mail.meeticulous.in` via `crm_shubham`. Governed by
`crm_admin_sends` (OFF today). Playbook in `docs/current-work.md` + the
Phase-2 governor. **Not part of this map** — lead journey is a separate doc.

---

## Humanity track

What separates Meeticulous from a SaaS form-filler. These are the mails
where the trigger isn't a system event — it's "the human remembered." All
**Shubham sender, Founder frame, often no CTA**. A greeting is the whole
mail. One-line Hindi (Javed-Akhtar-voice per `shubham-voice` skill) is
welcome. Governed by the same `touchGovernor` as everything else, so a host
who fires BIRTHDAY the same week as MILESTONE_10 gets one, not both.

### Festival / calendar (zero today)

Driven by a new `calendar_events` table: `(date, event_key, enabled,
audience)`. Cron runs daily, enqueues the day's greetings into
`notification_events`.

| Event | When | Audience | Sender | Notes |
|---|---|---|---|---|
| `GREETING_DIWALI` | Diwali (varies) | all | shubham | Keep CTA out. One line, one image. |
| `GREETING_HOLI` | Holi | all | shubham | — |
| `GREETING_EID` | Eid-ul-Fitr + Eid-ul-Adha | all | shubham | — |
| `GREETING_CHRISTMAS` | 25 Dec | all | shubham | — |
| `GREETING_NEWYEAR` | 1 Jan | all | shubham | Short retrospective allowed ("your year on Meeticulous"). |
| `GREETING_PONGAL_SANKRANTI` | 14–15 Jan | all | shubham | Regional. |
| `GREETING_ONAM` | Onam | all | shubham | Regional. |
| `GREETING_INDEPENDENCE_DAY` | 15 Aug | all | shubham | — |
| `GREETING_REPUBLIC_DAY` | 26 Jan | all | shubham | — |
| `GREETING_TEACHERS_DAY` | 5 Sep | vendor (coaches/mentors) | shubham | Segment by profession. |
| `GREETING_MENTAL_HEALTH_DAY` | 10 Oct | vendor (therapists) | shubham | Segment by profession. |
| `GREETING_YOGA_DAY` | 21 Jun | vendor (yoga) | shubham | Segment by profession. |
| `GREETING_WOMENS_DAY` | 8 Mar | all | shubham | — |

Opt-out per track (not just global). A yoga host who hates Yoga Day mail
should be able to skip just that one.

### Human-moment events (missing)

Triggered off `vendor_metrics` and `bookings`, not a calendar. All Founder
frame, `shubham` sender, in-app on, email on, WhatsApp off.

| Event | Trigger | Audience |
|---|---|---|
| `HOST_FIRST_REVIEW` | First review row ever for this host | vendor |
| `HOST_FIRST_FIVE_STAR` | First 5★ review | vendor |
| `HOST_PERFECT_MONTH` | 100% show-up in a calendar month, ≥5 bookings | vendor |
| `HOST_BOOKING_STREAK` | 3 consecutive weeks with ≥1 booking | vendor |
| `HOST_FIRST_REPEAT` | Same guest books again | vendor |
| `HOST_PROFESSION_MILESTONE` | 10 / 50 / 100 of profession-typed service (10th yoga class etc.) | vendor |
| `GUEST_EXPLORER_5_HOSTS` | Guest has booked 5 distinct hosts | guest |
| `GUEST_COMEBACK` | Guest returns after 90+ day gap | guest |
| `GUEST_REVIEW_LANDED` | Guest's review is now live on the host's page | guest |

### Soft / empathy (frame fix for existing + 2 new)

| Event | Status | Fix |
|---|---|---|
| `BOOKING_CANCELLED_CUSTOMER` | live, cold receipt | Add empathy opener for refund path. Receipt frame + warm first line. |
| `EARNING_REVERSED` | live, cold receipt | Same — explain it, don't just report it. Signed from `payments`, body written by Shubham. |
| `HOST_LOW_RATINGS_RUN` | missing | 3 ratings in a row ≤3★. Private Shubham note, no CTA, offer a call. |
| `ACCOUNT_PAUSED_BY_USER` | missing | User pauses their own page. "We'll keep it safe, come back anytime." |

### Why this track matters

SaaS brands fear mail with no CTA. That's the differentiator. A greeting IS
the email. Measure success not by click (there is none) but by **reply rate
to Shubham** — the number of hosts who email back. That number goes up, the
brand is working.

### What this needs to ship

1. `calendar_events` table + daily cron (`services/humanity/calendarDrip.js`).
2. `profession_segment` on templates — Yoga Day mail only reaches yoga hosts.
3. Per-track opt-out (one preference per humanity event_key).
4. `shubham-voice` skill used at authoring time for every copy block in this track.
5. Rate: `touchGovernor` cap stays 1/48h. Greetings can collide with other mail — collisions resolve by priority (festival > milestone > nudge).

### 18 new events, in build order

PR-6 (proposed, after the 5 PRs above): festival track (13 events, calendar-driven, lowest-risk).
PR-7: human-moment track (9 events, metric-driven).
PR-8: soft/empathy fixes (2 reframes + 2 new).

---

## Scorecard

Counts across the host + guest + cross-cutting maps above.

| Status | Count | Action |
|---|---|---|
| **Live and correct** | 48 | Keep. Audit copy against frames in a later PR. |
| **Live but disabled** | 4 | Re-enable with correct trigger + copy audit. See below. |
| **Live but wrong sender/frame** | 3 | Fix sender_key / reframe. |
| **Missing — system events** | 6 | Add migration + template + wire into `notify.js`. |
| **Missing — humanity track** | 18 | New domain. See Humanity section. Festival (13) + human-moment (9) + soft/empathy (2 reframes + 2 new). |

### The 4 disabled events (fix order, highest ROI first)

1. **`HOST_ADD_SERVICE_NUDGE`** — fires 48h after KYC approved, 0 services.
   Highest activation ROI. Ladder frame. Deep-link each step.
2. **`HOST_FIRST_BOOKING_NUDGE`** — fires 7d after 1st service, 0 bookings.
   Founder frame. Short, one ask ("share your link").
3. **`HOST_SHARE_LINK_NUDGE`** — fires 48h after 1st service. Can merge with
   #2 or stay separate. Decide after activation funnel data.
4. **`HOST_PAYOUT_WAITING_NUDGE`** — fires when earnings > 0 but bank details
   missing. Loss frame. Direct money impact.

### The 6 missing events (design order)

1. **`HOST_START_KYC_NUDGE`** — 48h after signup, KYC not started.
2. **`HOST_DORMANT_30D`** — 30d no booking, had activity. Tithi, Founder.
3. **`HOST_DORMANT_60D`** — 60d, no response to 30d. Shubham, Founder.
4. **`HOST_DORMANT_90D`** — 90d, final. Shubham, Founder (one line).
5. **`GUEST_REVIEW_NUDGE`** — 48h after completed booking, no review.
6. **`ACCOUNT_ANNIVERSARY` sender fix** — assign `shubham`.

Each needs:
- migration (seed `notification_events` + `email_templates`)
- `notify.js` trigger wiring
- `touchGovernor` registration (so the 48h cap applies)
- metric on next-milestone rate (did they do the thing in N days)

---

## Build order

Not the strategy doc order. The merge order.

1. **PR-1 (code-safe)** — re-enable the 4 disabled events with current copy.
   Run for 2 weeks, look at `notification_events` fire counts +
   `vendor_metrics`. Zero new copy, zero new events. Low risk.
2. **PR-2 (copy audit)** — rewrite the live-but-wrong 3 (ACCOUNT_ANNIVERSARY
   sender, GUEST_TO_HOST_INVITE reframe, Pro-Taste consolidation).
3. **PR-3 (dormant track)** — add the 3 dormant events. Biggest new surface.
4. **PR-4 (guest review nudge + KYC start nudge)** — the two remaining gaps.
5. **PR-5** — newsletter cadence doc (Tithi) + voice doc (both senders).

Each PR = one migration + one notify.js wiring + the template seed, nothing
else. The playbook doc (`email-playbook.md`) is written after PR-2 so it
describes what already exists.

## What this doc is not

- Not the copy. Copy lives in `config/emailTemplates.js` and the playbook.
- Not the voice guide. Shubham voice is the installed skill; Tithi needs one.
- Not the cold-outreach / lead journey — that's a separate doc.
- Not the newsletter editorial calendar.

## Change log

- 2026-11-10 — first pass. Grounded against live DB
  (`spquowzrefozmrzoszkf`). Flagged 4 disabled events, 6 missing events, 3
  wrong-sender events.
- 2026-11-10 — added Humanity track (18 events across festival, human-moment,
  soft/empathy). Build order extended to PR-6/7/8.
