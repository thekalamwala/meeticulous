# AiSensy template spec

Reference for the WhatsApp templates that match each `notification_events`
row shipped in PR-3..PR-7. Create one AiSensy campaign per row below,
matching the **exact** name in the `campaign_name` column. When Meta
approves the template, flip `whatsapp_enabled = true` on the matching
`notification_events` row — the engine picks it up inside 60 seconds (flag
cache TTL).

Wiring state (verified 2026-11-10 after v3.198 applied):
- `notification_events.campaign_name` — seeded per event below.
- `notification_events.whatsapp_enabled` — `false` on every one of these
  rows. **Flip per event as its AiSensy template lands.**
- Services pass `data.templateParams` as the array shape documented here.

## Naming convention

`Title Case - Audience` (singular). Examples: `Dormant 30 Day - Vendor`,
`Greeting - Diwali`, `First Review - Vendor`. Keep names stable across
template versions — swap the content inside AiSensy, never rename.

## Template params

AiSensy uses `{{1}}`, `{{2}}`, `{{3}}` positional params in the body. The
`templateParams` array in each service passes them in order. Pick a stable
param order per template — changing it later needs a coordinated code +
AiSensy edit.

Body language rules in [`docs/email-playbook.md`](email-playbook.md) apply
to WhatsApp too: Shubham voice for Founder-frame events, Tithi voice for
Ladder / nudges, one line of Hindi where it fits, zero emoji except on
celebrations.

---

## Nudge / Ladder events

### `Start KYC - Vendor`
- Event: `HOST_START_KYC_NUDGE`
- Fires: 2 days after host signup, onboarding incomplete
- Params: `[{{1}} = first_name, {{2}} = dashboard deep link]`
- Body suggestion:
  ```
  Hi {{1}}, your Meeticulous page is almost ready. Finish KYC + add a
  service and it goes live. Takes 5 minutes: {{2}}
  ```

### `Review Request - Guest`
- Event: `GUEST_REVIEW_NUDGE`
- Fires: 48h after a completed, paid booking with no review
- Params: `[{{1}} = guest first_name, {{2}} = vendor_name, {{3}} = review link]`
- Body suggestion:
  ```
  Hi {{1}}, how was your session with {{2}} on Meeticulous? If it went
  well, two lines helps a small creator. {{3}}
  ```

### `Dormant 30 Day - Vendor`
- Event: `HOST_DORMANT_30D`
- Fires: inactive 30–59 days, ≥1 past booking
- Params: `[{{1}} = first_name, {{2}} = dashboard link]`
- Body suggestion:
  ```
  Hi {{1}}, it's been a quiet month on your Meeticulous page. Anything
  we can help with? Reply here, or open your dashboard: {{2}}
  ```

### `Dormant 60 Day - Vendor`
- Event: `HOST_DORMANT_60D`
- Fires: inactive 60–89 days
- Params: `[{{1}} = first_name, {{2}} = dashboard link]`
- Body suggestion:
  ```
  Hi {{1}}, Shubham from Meeticulous. Noticed your page has been quiet
  for two months — hit reply and tell me what's going on? {{2}}
  ```

### `HOST_DORMANT_90D` — email only (no WA template)
Final goodbye, personal letter. Not for WhatsApp.

---

## Greeting events (festivals)

All greetings share one param: `[{{1}} = first_name]`. Thirteen campaigns,
one per event. Short, no CTA, no link.

| Campaign | Event | Body suggestion |
|---|---|---|
| `Greeting - Diwali` | `GREETING_DIWALI` | `{{1}}, Diwali mubarak from Meeticulous. Thank you for being here. Phir milte hain.` |
| `Greeting - Holi` | `GREETING_HOLI` | `Happy Holi, {{1}}. Whatever your colour is today, hope it's a good one.` |
| `Greeting - Eid` | `GREETING_EID` | `Eid mubarak, {{1}}. Celebrate well. — Shubham, Meeticulous` |
| `Greeting - Christmas` | `GREETING_CHRISTMAS` | `Merry Christmas, {{1}}. Hope today is warm and slow. — Shubham` |
| `Greeting - New Year` | `GREETING_NEWYEAR` | `Happy new year, {{1}}. Here's to the next one. Aage dekhte hain.` |
| `Greeting - Pongal Sankranti` | `GREETING_PONGAL_SANKRANTI` | `Happy Pongal, {{1}}. Pongal, Sankranti, Bihu, Lohri — same beat.` |
| `Greeting - Onam` | `GREETING_ONAM` | `Happy Onam, {{1}}. Hope the sadya is good.` |
| `Greeting - Independence Day` | `GREETING_INDEPENDENCE_DAY` | `{{1}}, today you get to do your own work, in your own voice. Jai Hind.` |
| `Greeting - Republic Day` | `GREETING_REPUBLIC_DAY` | `Republic Day, {{1}}. Keep doing your thing.` |
| `Greeting - Teachers Day` | `GREETING_TEACHERS_DAY` | `Thank you, {{1}}. Guru Dakshina is reading your replies — tell me one thing a student told you lately.` |
| `Greeting - Mental Health Day` | `GREETING_MENTAL_HEALTH_DAY` | `{{1}}, the work you do is often invisible. Today's a note to say: it's seen. Take care of you too.` |
| `Greeting - Yoga Day` | `GREETING_YOGA_DAY` | `Happy Yoga Day, {{1}}. Teach one extra class today if you can.` |
| `Greeting - Womens Day` | `GREETING_WOMENS_DAY` | `{{1}}, a lot of what Meeticulous runs on is built by women. Today's a good day to say that plainly.` |

Profession-scoped greetings (Teachers / Mental Health / Yoga) only reach
hosts with the matching `profiles.profession`. Non-matching hosts get
nothing even when WhatsApp is enabled — the service filter runs first.

---

## Human-moment events

### `First Review - Vendor`
- Event: `HOST_FIRST_REVIEW`
- Fires: first review row ever for this host
- Params: `[{{1}} = host first_name, {{2}} = reviewer first_name, {{3}} = dashboard link]`
- Body suggestion:
  ```
  {{1}}, your first review on Meeticulous is in — from {{2}}. First
  ones mean the most. Read it: {{3}}
  ```

### `First Five Star - Vendor`
- Event: `HOST_FIRST_FIVE_STAR`
- Fires: first 5-star review
- Params: same as First Review
- Body suggestion:
  ```
  Five stars, {{1}}. {{2}} just rated your session 5★ on Meeticulous.
  Mubarak. {{3}}
  ```

### `Perfect Month - Vendor`
- Event: `HOST_PERFECT_MONTH`
- Fires: ≥5 bookings in prev calendar month, 100% completion
- Params: `[{{1}} = first_name, {{2}} = completed count, {{3}} = month name]`
- Body suggestion:
  ```
  {{1}}, clean month on Meeticulous: {{2}} bookings in {{3}}, zero
  no-shows. Harder than it looks.
  ```

### `Booking Streak - Vendor`
- Event: `HOST_BOOKING_STREAK`
- Fires: ≥1 booking in each of the last 3 weeks
- Params: `[{{1}} = first_name]`
- Body suggestion:
  ```
  Three weeks in a row of bookings on Meeticulous, {{1}}. That's a
  rhythm. Keep it going.
  ```

### `First Repeat Guest - Vendor`
- Event: `HOST_FIRST_REPEAT`
- Fires: first time a guest books the host twice
- Params: `[{{1}} = host first_name, {{2}} = guest first_name]`
- Body suggestion:
  ```
  {{2}} came back to book you again, {{1}}. First repeat is the real
  signal — whatever you did the first time worked.
  ```

### `Explorer Five Hosts - Guest`
- Event: `GUEST_EXPLORER_5_HOSTS`
- Fires: guest has booked 5 distinct hosts
- Params: `[{{1}} = first_name]`
- Body suggestion:
  ```
  Five hosts in, {{1}}. Most guests stick to one. Thanks for exploring
  Meeticulous.
  ```

### `Comeback - Guest`
- Event: `GUEST_COMEBACK`
- Fires: guest returns after 90+ day gap
- Params: `[{{1}} = first_name]`
- Body suggestion:
  ```
  Good to see you again, {{1}}. Welcome back to Meeticulous.
  ```

### `GUEST_REVIEW_LANDED` — email only (no WA template)
Personal confirmation after a review goes live. Email-only, warm.

---

## Not wired for WhatsApp (intentional)

| Event | Why email-only |
|---|---|
| `HOST_DORMANT_90D` | Final goodbye, personal letter. WA feels transactional. |
| `GUEST_REVIEW_LANDED` | Celebration after a review posts. Sits better as email. |
| `HOST_LOW_RATINGS_RUN` | Private note offering a call. WA is too public. |
| `ACCOUNT_PAUSED_BY_USER` | Empathy note. Already visible in the dashboard. |

Adding WA on any of these later = one row update + a `campaign_name` edit.

---

## How to go live per event

1. In AiSensy, create the campaign with the **exact** name from the table above.
2. Submit for Meta template approval (24–72h typical).
3. Once approved, flip the row:
   ```sql
   UPDATE notification_events
      SET whatsapp_enabled = true, updated_at = now()
    WHERE event_key = '<EVENT>';
   ```
4. Engine starts routing WA alongside email within 60s.

### Kill switch

Fail-closed per track via the existing feature flags
(`activation_nudges`, `dormant_nudges`, `review_nudges`, `festival_nudges`,
`human_moments`). Flipping any to false stops all channels for that track
instantly — not just WhatsApp.

## Change log

- 2026-11-10 — first pass. Named 21 campaigns; param shapes for every one;
  services pass `templateParams` in the spec'd order; all WA rows remain
  `enabled=false` pending AiSensy approvals.
