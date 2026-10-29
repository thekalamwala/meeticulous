# Host Activation Funnel

The one funnel that matters: does a new host reach their first booking? Every
event below is keyed to the **host's** PostHog `distinct_id` (the host's user id),
so they line up as one funnel on one person.

## The four steps

| # | Event | Where it fires | Keyed to |
|---|-------|----------------|----------|
| 1 | `user_registered` | `authController` (Google host signup) | host |
| 2 | `service_published` | `serviceController` (host creates a service) | host |
| 3 | `profile_link_shared` | `Dashboard.jsx` (host copies/shares their link) | host |
| 4 | `host_first_booking` | `hostActivation.js` via `bookingConfirmation` (first paid booking) | host |

Steps 1–2 already existed; 3–4 were added for this funnel.

- **`profile_link_shared`** — client event, `{ method: 'native' | 'copy', source }`.
  The share/copy is the host's only demand channel, so it's a first-class step.
- **`host_first_booking`** — server event, fires **once** on the host's first paid
  (non-₹0) booking. Booking events (`booking_paid`) are keyed to the guest, so they
  can't drive a host funnel — this is the host-side milestone.

## Build the funnel in PostHog

1. Product Analytics → **New insight → Funnel**.
2. Add steps in order: `user_registered` → `service_published` → `profile_link_shared`
   → `host_first_booking`.
3. Conversion window: 30 days. Breakdown by nothing to start.
4. Save as **"Host Activation"**.

## What to read from it

- **Step 1→2 drop** = signups that never publish a service (onboarding friction).
- **Step 2→3 drop** = hosts who publish but never share (the biggest lever — they
  built a page and never sent it to anyone).
- **Step 3→4 drop** = hosts who shared but got no booking (demand/offer problem).

At ~5 activated hosts today, this tells you *where* the other ~60 died. Fix the
biggest drop first.

## Notes

- All events are fire-and-forget; none can break signup, publish, or a booking.
- PostHog must be configured (`POSTHOG_*` / `VITE_POSTHOG_*`). Events no-op locally
  when keys are unset.
- `host_first_booking` counts paid bookings at confirmation time; a rare
  simultaneous double-first just over-counts one activation (acceptable).
