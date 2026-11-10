# Email Playbook

How Meeticulous writes and designs email. Companion to
[`docs/email-journey-map.md`](email-journey-map.md): the map says WHAT we send
and WHEN; this says HOW it looks and sounds.

Read before touching any `email_templates` row, writing new ones, or shipping a
new sender. Short-circuit the whole doc: if you can't name the **frame**, the
**sender**, and the **one ask**, you're not ready to write.

## Terminology (re-cap from the map)

- **Frame** — one of five email shapes. Receipt / Ladder / Loss / Founder /
  Sectioned. ONE per email. Mixing is slop.
- **Sender** — the `sender_key` on the template row. `email_senders` table
  pins the visible name + reply-to. Never swap a sender mid-sequence.
- **One ask** — the single next action the reader is expected to take.
  Multiple CTAs = measurably worse clicks on the primary one.

---

## Senders — who writes what

| sender_key | Visible name | Reply-to | Writes |
|---|---|---|---|
| `shubham` | Shubham, Meeticulous | shubham@meeticulous.com | Founder frame. First-booking, milestones, win-back 60/90d, invite, anniversary, all greetings. |
| `tithi` | Tithi at Meeticulous | team@meeticulous.com | Ladder, nudges, onboarding, dormant 30d, Pro Taste ending/ended, reviews. |
| `crm_shubham` | Shubham \| CEO, Meeticulous | shubham@meeticulous.com | Cold outreach to leads only. Separate `.in` root. |
| `crm_tithi` | Tithi at Meeticulous | team@meeticulous.com | CRM sequences to opted-in hosts. |
| `bookings` | Meeticulous Bookings | team@meeticulous.com | Receipt only. State changes on bookings. |
| `payments` | Meeticulous Payments | team@meeticulous.com | Receipt / loss on payments, payouts, subscription. |
| `account` | Meeticulous Account | team@meeticulous.com | Receipt on profile/KYC decisions. |
| `verify` | Meeticulous | team@meeticulous.com | OTP, email verify, password reset, security alerts. |
| `news` | Meeticulous Collective | team@meeticulous.com | Sectioned frame. Newsletter, founding spots, upgrade nudges. |

**Rules:**
- Shubham sends in first person. Everyone else writes as "we".
- Reply-to is always a monitored mailbox. No `noreply@`. Every Founder email
  says "reply any time" because he actually reads them.
- Function senders (bookings/payments/account/verify) never change frame,
  never tell a story, never ask for a reply unless there's a real request.

---

## The five frames

### 1. Receipt

A state has changed. Tell the reader what it is in one line, show the
underlying record as a labelled block, give one CTA.

**Shape:**
1. One hero line (≤ 10 words) stating the state.
2. One line of context (what/who/when), 20 words max.
3. Record block: 4–6 labelled fields.
4. One CTA, outcome-named ("View my booking", never "Click here").
5. Footer with a help line and a reply affordance.

**Use for:** `BOOKING_*`, `PAYOUT_*`, `KYC_APPROVED`, `KYC_REJECTED`,
`SUBSCRIPTION_PURCHASED`, `SUBSCRIPTION_RENEWED`, `AUTH_*`, `SECURITY_*`.

**Gold reference:** Alpha Adventures hold-on-trek email. 6 fields, one CTA,
"You can also just reply to this email" at the base.

**Do:**
- Lead with what happened, not the process that caused it.
- Show the record. Readers trust records more than prose.
- Keep tone neutral. State-change emails are not a chance to charm.

**Don't:**
- Open with a greeting ("Hi {{first_name}}!") on a transactional email.
- Add a second CTA ("or upgrade your plan").
- Hide amounts behind "₹X.XX" — show the actual number.

### 2. Ladder

The reader has to do a thing in several steps. Make the steps the design.

**Shape:**
1. One hero line naming the goal.
2. Numbered 3 steps, each = title + one sentence + deep-link.
3. Soft footer: "Any trouble, reply here."

**Use for:** `HOST_ADD_SERVICE_NUDGE`, `HOST_SHARE_LINK_NUDGE`,
`HOST_START_KYC_NUDGE`, `PAYOUT_VERIFICATION_NEEDED`, `PROFILE_COMPLETION_REMINDER`.

**Gold reference:** Acuity's trial-ending "Maximize revenue in 3 easy steps".
Each step links to the exact admin screen. Trial deadline sits BELOW the
value, not above.

**Do:**
- Three steps, not four, not five. Three is the attention budget.
- Deep-link each step to the exact page, not the dashboard root.
- Let the step itself be the body. No paragraph intro.

**Don't:**
- Number steps that aren't sequential ("1. Pick a plan 2. Learn more").
- Use the ladder frame when the reader can act in one tap. That's a Founder
  frame.

### 3. Loss

The reader is about to lose something, or already did. Name the loss, name
the fix, one CTA.

**Shape:**
1. Hero line = the loss, in plain words.
2. One line listing what's affected (not what's "available again").
3. One CTA to the fix.
4. Soft reversal at the base ("Turn WhatsApp back on any time with Pro").

**Use for:** `SUBSCRIPTION_HALTED`, `SUBSCRIPTION_EXPIRING`,
`PRO_TASTE_ENDING`, `PRO_TASTE_ENDED`, `PAYOUT_FAILED`,
`HOST_PAYOUT_WAITING_NUDGE`.

**Gold reference:** OpenAI's "Your Go access will end soon". Bullets of
what the reader LOSES. Single CTA. Signed from "The ChatGPT Team" with a
physical address.

**Do:**
- Loss framing > gain framing. "WhatsApp reminders are now off" beats
  "Upgrade to keep WhatsApp".
- Keep urgency honest. If the deadline is real, say the date. Fake urgency
  tanks domain reputation.

**Don't:**
- Panic. Loss frames are calm. Panic reads as desperate.
- Stack two losses ("Your plan expired AND your KYC lapsed"). Pick one.

### 4. Founder

Shubham writes a personal note. First person. One ask. No grid, no hero
image, no benefit list.

**Shape:**
1. One opening line that proves the email is real (uses a specific detail
   the reader recognises — a count, a name, a date).
2. 2–4 short paragraphs. Short.
3. Optional one-line Hindi phrase (Javed-Akhtar-voice; see
   `shubham-voice` skill). Not translated — used for its own feel.
4. One ask, and it's always *also a reply invite*. CTA button optional;
   the reply is the real ask.
5. Sign-off is "Shubham" or "— Shubham". Never "Shubham Datarkar, CEO".

**Use for:** `MILESTONE_*`, `GUEST_TO_HOST_INVITE`, `HOST_DORMANT_60D`,
`HOST_DORMANT_90D`, `BIRTHDAY`, `ACCOUNT_ANNIVERSARY`, `PLAN_GIFT_RECEIVED`,
all Humanity-track greetings.

**Gold reference:** Neil Patel's one-line "I'll answer any marketing
question you have." Text-only. One ask. Replies pour in.

**Do:**
- Prove the email is real. "You've booked three times" tells the reader
  it's not a blast. If the detail isn't true, cut it.
- Write how Shubham speaks, not how marketers write. The
  [`shubham-voice`](../.claude/skills/shubham-voice/) skill is the source
  of truth; use it at authoring time, every time.
- Keep CTAs understated. A link in prose often beats a button.

**Don't:**
- Em-dashes for drama. Short sentences do the same work.
- "Not X, but Y" framing.
- Decorative opens ("As I was thinking about..."). Lead with the specific
  detail; that IS the hook.

### 5. Sectioned

Newsletter. Multiple short items, one primary CTA, clearly sponsored
sections OK.

**Shape:**
1. Date + issue number top-left. Logo top-right.
2. 3–5 sections separated by emoji dividers (🛠 📉 💡).
3. Each section = headline + 2–3 lines + source link.
4. Sponsor block (if any) marked, below the fold.
5. One subscribe/preferences line at the base.

**Use for:** `NEWSLETTER_WELCOME`, product-update emails, Collective
digests, `FOUNDING_SPOTS_LOW`.

**Gold reference:** Marketing Monk / The Hustle / Marketing Brew.

**Do:**
- Keep each item scannable. Reader is on a train.
- One primary CTA per issue, not per section.
- Date-stamp every issue. Readers archive newsletters.

**Don't:**
- Fake a newsletter to disguise a sales email. If the whole thing is a
  pitch, it's a Loss or a Founder frame, not Sectioned.

---

## Voice

### Shubham

Owned by the [`shubham-voice`](../.claude/skills/shubham-voice/) skill. Short
version:

- Indian English. Say what you mean. No hedging.
- Trevor Noah wit, Jobs clarity, Javed-Akhtar-ish Hindi. One phrase of
  Hindi is enough; translating it kills it.
- First person always. "I" not "we".
- Replies are the product. Every Shubham email can be replied to and
  will be read.
- Three-line paragraphs max. The next line matters more than the current
  one.

**Example openers that work:**
- "You've booked three times on Meeticulous. I noticed, and figured I'd
  write."
- "Three months. I'll stop writing after this."
- "Your first booking is in. This is the start of something."

**Opener anti-patterns:**
- "We're thrilled to announce..." (not his voice)
- "Hi {{first_name}}, hope this finds you well..." (empty words)
- "At Meeticulous, we believe..." (nobody cares)

### Tithi

No installed skill. This section IS Tithi's voice spec until one lands.

**Who she is:** platform team, warm, efficient, not corporate. Thinks in
jobs-to-be-done. Writes like a competent friend walking you through
something, not a brand.

- "We" not "I" (she represents the team, not herself).
- Second person — "your page", "your bookings", not "the page".
- One reply invite per email, same as Shubham — but the reply goes to
  team@meeticulous.com, not her personally.
- Never apologises for routine events. ("Sorry to bother you" is not
  Tithi. "Just checking in" is.)
- No emoji in subject lines except for confirmed moments
  (🎉 once, nowhere else).
- Short subject lines, question form welcome. "Everything ok,
  {{first_name}}?" works.
- When in doubt, cut a line.

**Example openers that work:**
- "Your Meeticulous page is almost ready. Finish these and it goes live."
- "It's been a quiet month on your Meeticulous page."
- "You have a payout waiting."

**Opener anti-patterns:**
- "Hi hi!" / "Hey friend!" (too casual, performing warmth)
- "We know you're busy, but..." (apologising for existing)
- "At Meeticulous, our mission is..." (nobody cares, same as above)

### The function senders (bookings / payments / account / verify)

No voice. Neutral, state-first, no greetings. The record IS the email.

---

## Language rules (every sender)

### Always

- Use the user's real recognisable identifier (first name, service name,
  booking date, amount, host name). An email that doesn't read as built
  for one person reads as spam.
- Use currency symbols and real numbers, not ranges or approximations.
  `₹999`, not "around a thousand".
- Use the IST date format `Fri 20 Nov 2026` (short month, no comma). It's
  how `formatDate` renders.
- Keep subject lines under 55 characters where possible. Mobile cuts.
- Send one message per email. The reader decides one thing, or nothing.

### Never

- Em-dashes for rhythm. They read as AI. Use a full stop.
- "Not X, but Y" framing.
- Stock openers: "We're thrilled", "I hope this finds you well", "Just a
  quick note".
- Emoji in body copy except for one-off celebration beats (🎉 on
  milestone, 💸 on payout, 🎁 on gift). Zero elsewhere.
- Marketing superlatives: "incredible", "amazing", "game-changing".
- Internal product words leaked out: "notification engine", "cron",
  "flag", "sender_key". Say "an email we send", not "a NotificationEngine
  event".
- Apologetic framing on routine things. ("Sorry to bother you",
  "Hope you don't mind me writing.")
- Translating a Hindi phrase inline. If a reader won't get it, cut it.

### Hindi usage (Shubham only, per skill)

One line per email, at most. No italics, no footnote translation. Common
spots that work:

- Sign-off beat: "Phir milte hain." / "Shukriya."
- Opener on a festival: "Diwali mubarak, {{first_name}}."
- Mid-note emphasis: Shift mid-note to Hindi for a single plain-spoken
  observation ("Zaroori nahi hai, par acha hai.")

Never use transliterated Hindi as filler or ornament; it reads worse than
English prose when it's not doing specific work.

---

## Design conventions

### Layout

Every template body passes through `services/email/emailLayout.js`. Don't
re-build headers, footers or the logo in template HTML — the layout adds
them. Bodies are **body-only** HTML.

**Width:** 640px max on desktop, fluid on mobile. Already pinned by the
layout. Don't override.

**Padding:** Let the layout's 32px side padding handle the gutter. Don't
re-pad inside bodies or you get double gutters on mobile.

### Colour (tokens, never literals)

All colour tokens from `design-system/styles.css`. In email HTML we use
the inlined hex for Gmail compatibility — read from the kit, don't
guess:

| Token | Hex | Role |
|---|---|---|
| `--maroon` | `#960D32` | Primary accent, CTA background |
| `--maroon-dark` | `#6E0824` | CTA hover, text on cream |
| `--rose` | `#D4536C` | Ladder step markers |
| `--blush` | `#FBE4E6` | Soft fill behind step markers |
| `--cream` | `#FDF8F2` | Alt band background |
| `--ink` | `#2B1218` | Body text |
| `--ink-soft` | `#4A3A3E` | Secondary text |
| `--muted` | `#7D6B70` | Fine print, captions |
| `--rule` | `#F1DCE1` | Hairline separators |

**Rules:**
- The CTA button is always maroon fill, white text, full-width on mobile,
  sentence-case verb ("See my bookings", not "SEE MY BOOKINGS").
- Step markers (Ladder frame) use blush fill + maroon number.
- Loss frame uses `--marigold` (`#F5A524`) for the "OFF" or "ending" badge.
  Nowhere else.
- One accent per email. Never two.

### Typography

Already pinned by the layout. Don't override:
- Body: Poppins 15px / line-height 1.65 / `--ink-soft`.
- Headings: Poppins 26px bold / line-height 1.25 / `--ink`.
- Fine print: 13px / `--muted`.
- No Instrument Serif in email. (Serif renders inconsistently in Outlook;
  save it for the web.)

### Imagery

- Hero image only on Founder milestones (`milestone-1.png`,
  `anniversary-1.png`). Loss, Ladder, Receipt frames: no hero.
- Icons from `email/assets/`: `link.png`, `calendar.png`, `wallet.png`,
  etc. 24px square, two per row max. Never AI-generated illustrations.
- Alt text on every image: a short sentence, not a repeat of the headline.

### Footer (all layouts)

The layout appends:
- Reply line ("Reply to this email any time — we read every one.")
- Address block (needs real street + city; India DPDP + Gmail bulk-sender
  rule).
- Preferences link + Unsubscribe link. Unsubscribe must be ONE click.
- Logo at the top of the footer. Nowhere else.

Transactional emails (verify, bookings, payments) carry a lighter footer:
no Preferences link, just Unsubscribe, address, help line.

---

## Governance

- `touchGovernor`: ≤ 1 non-transactional email per user per 48h. Receipt
  frames are exempt. Loss frames are exempt only for payment / subscription
  halts.
- `sendGate`: quiet hours 09–20 IST. A lifecycle email queued at 02:00
  waits until 09:00. Receipts always send.
- `crm_admin_sends` and `activation_nudges` / `dormant_nudges` /
  `review_nudges` feature flags are the master off switches. Flipping any
  to false pauses that whole track inside 60 seconds (flag cache TTL).
- Opt-out: every lifecycle email honours `email_opt_out` on the profile.
  Transactional emails bypass opt-out (service-of-contract basis).

---

## Measurement

The three numbers that matter:
1. **Delivered rate** — bounces + spam complaints under 0.3%.
2. **Reply or action rate** — the ONE CTA click, or a human reply. Opens
   are vanity; iOS killed them.
3. **Next-milestone rate** — did the reader do the thing we asked within
   N days.

Dashboards live in `supabase` via `notification_logs`. Weekly review by
the founder; monthly review by the team.

---

## When this doc isn't the source of truth

- `docs/email-journey-map.md` — the authoritative list of events +
  current state in the DB.
- `shubham-voice` skill — the authoritative voice for Shubham.
- `design-system/` + `design-system/BRAND_RULES.md` — the authoritative
  brand kit. The colour and type section here echoes the kit; the kit
  wins.
- `config/emailTemplates.js` — the authoritative copy. If a template
  disagrees with the frame description here, either the template is
  wrong or the frame is. Propose the fix as a separate PR.

## Change log

- 2026-11-10 — first pass. Frames, senders, voice (Shubham + a new Tithi
  spec), design tokens pulled from the brand kit, language rules + anti-
  patterns, governance + measurement.
