# Contact Visibility Gating (Anti-Disintermediation)

**Status:** SPEC — build scheduled 2026-07-15 13:45 IST
**Branch:** `docs/contact-visibility-gating` (docs) → build on `feat/contact-visibility-gating`
**Author decisions:** locked with founder 2026-07-14

---

## Problem

Both host and guest currently see each other's **phone number** on every paid
booking. Two people meet on-platform, swap numbers, re-book over WhatsApp — the
platform never sees the money again. This is **disintermediation** (marketplace
leakage). Goal: cut the realistic leak channel (phone) while keeping meetings
functional, and turn "see your client's number" into a Studio upsell.

## What leaks today (verified)

- **Host sees guest phone** — `getHostBookings` selects `*, profiles!bookings_guest_id_fkey(*)`.
  The `*` pulls `guest_phone`; the guest profile join pulls `phone`.
  [server/controllers/bookingController.js:575](../../../server/controllers/bookingController.js)
- **Guest sees host phone** — `getGuestBookings` selects host `profiles(*)`.
  [server/controllers/bookingController.js:605](../../../server/controllers/bookingController.js)
- **Also audit (builder):** any single-booking GET (`getBookingById`) and the
  reschedule/cancel response paths that return a full booking to a client. The
  `selectServiceWithFallback` fallback at [line 121](../../../server/controllers/bookingController.js)
  still lists `guest_phone`. Apply the redactor everywhere a booking payload is
  returned to a client — not just the two list endpoints.

**Not a leak (keep untouched):** notification sends use `guest_phone`/`host.phone`
server-side to fire WhatsApp/email (e.g. [line 1382](../../../server/controllers/bookingController.js)).
Those are server→provider, never returned to a client. **Do not remove the DB
column or touch the send paths.**

---

## Policy (final)

| Direction | Plan / booking mode | Phone | Email | Location |
|---|---|---|---|---|
| **Guest phone → Host** | Starter, Host+ | ❌ never | ✅ | — |
| | Studio | ✅ from 15 min before `scheduled_at`, then permanent | ✅ | — |
| | Supreme | ✅ always (god tier bypass) | ✅ | — |
| **Host phone → Guest** | `meeting_mode = 'online'` | ❌ never | ✅ | ✅ |
| | `meeting_mode = 'offline'` | ✅ from 15 min before `scheduled_at`, then permanent | ✅ | ✅ |

- **"15 min before → permanent" needs NO state column.** The rule is exactly:
  `now >= scheduled_at - 15*60*1000`. Future bookings hide the number; imminent
  and past bookings show it. This *is* "keep forever once opened" AND blocks
  bulk pre-harvest of a far-future calendar.
- `meeting_mode` is on the **service** (`services.meeting_mode ∈ ('online','offline')`,
  default `'online'` — [schema.sql:54](../../../server/config/schema.sql)). Both booking
  queries already join the service, so it's free.
- **Email and location stay visible both directions, all plans.** (Accepted
  residual — see below.)

---

## Build (response redaction ONLY — no schema change, no migration)

One shared helper, applied at every point a booking is returned to a client.

### 1. Helper — `redactBookingContact(booking, viewer, now)`

Put in `bookingController.js` (or a small `server/lib/contactVisibility.js` if
reused). Pseudocode:

```
GRACE_MS = 15 * 60 * 1000
windowOpen(booking, now) => now >= new Date(booking.scheduled_at).getTime() - GRACE_MS

redactBookingContact(booking, viewer):
  // viewer = { role: 'host' | 'guest', plan: <slug> }
  mode = booking.services?.meeting_mode || 'online'

  if viewer.role == 'host':
    // guest's number visible to host?
    show = isSupreme(viewer.plan)
        || (isStudio(viewer.plan) && windowOpen(booking, now))
    if !show:
      booking.guest_phone = null
      if booking.profiles then booking.profiles.phone = null   // guest profile join

  if viewer.role == 'guest':
    // host's number visible to guest?
    show = (mode == 'offline') && windowOpen(booking, now)
    if !show:
      if booking.profiles then booking.profiles.phone = null   // host profile join
      // guest side has no host_phone column; leak is only via the profiles join

  return booking
  // ponytail: email + notes free-text disintermediation accepted (see residuals)
```

- **Plan lookup:** use `server/services/planService.js` (`normalizePlan` / plan
  slug helpers; `isFreeSlug` already there). Add `isStudio(slug)` / `isSupreme(slug)`
  or reuse existing tier checks. Host's plan = the authed host's own plan
  (`req.user`). Confirm the exact export names at build time.
- **Supreme = god tier**, always bypasses (consistent with existing SAFETY_KEYS
  pattern — Supreme sees everything).

### 2. Apply it

- `getHostBookings` (575): map each row through `redactBookingContact(row, {role:'host', plan: hostPlan}, now)` before `res.json`.
- `getGuestBookings` (605): map each row through `redactBookingContact(row, {role:'guest'}, now)`.
- `getBookingById` + reschedule/cancel client responses: same, role inferred from
  whether `req.user.id === booking.host_id` (host) else guest.
- Keep the stale-schema fallback selects working; they already omit `guest_phone`
  in some branches — the redactor is the source of truth, not the select list.

### 3. Client

No client change strictly required — server stops sending the number, so the
dashboard renders nothing. **Optional polish:** where the guest-phone cell was
shown to Starter/Host+ hosts, replace with an upsell nudge → *"See your client's
number — upgrade to Studio."* Reuse existing plan-gate/upsell components; do not
invent new ones. Ship redaction first; upsell copy is a fast follow.

---

## Enforcement note

Redaction is **server-side** and authoritative. Never rely on the client to hide
the number — the whole platform rule is "never trust the client." The number
must not be in the JSON at all until the window opens.

## Residuals (accepted — do NOT build fixes)

1. **Email stays visible both ways** → off-platform contact via email still
   possible. Founder's call: realistic re-booking leakage in India is
   WhatsApp/phone, not email (higher friction). Not sealing this.
2. **Free-text leak** — a number typed into `notes` or the name/`guest_name`
   field slips through. Regex-scrubbing is a rabbit hole with false positives.
   Accepted. `// ponytail: notes free-text leak accepted`
3. **Offline host on Starter/Host+ still can't see guest number.** Fine — the
   guest gets the *host's* number (offline rule), guest calls host, host now has
   it from the call. One-directional reveal is enough for offline coordination.

## Test plan (one runnable check per branch of the logic)

Unit test `redactBookingContact` (Jest, `server/tests/unit/`):

- host + Starter → `guest_phone` null, regardless of time.
- host + Host+ → `guest_phone` null.
- host + Studio, booking 3 days out → null.
- host + Studio, booking 10 min from now → phone present.
- host + Studio, booking in the past → phone present (permanent).
- host + Supreme → present always.
- guest + online booking → host `profiles.phone` null even 1 min before.
- guest + offline booking, >15 min out → null.
- guest + offline booking, within 15 min → present.
- Confirm `guest_email` / host `email` / location untouched in all cases.

Do NOT mock the DB for the helper — it's a pure function over a booking object.

## Rollout

- **No migration. No DB deploy. No both-DBs step.** Response-shaping only.
- Ship behind normal PR → `main`. Server-only change + optional client upsell copy.
- `npm test` (server) green, `npm run build` (client) green if client touched.

## Out of scope (future, YAGNI now)

- Proxy/relay phone numbers (Uber/Airbnb masked-number model).
- Time-window *closing* after the meeting (founder chose permanent-once-open).
- Scrubbing free-text fields.
