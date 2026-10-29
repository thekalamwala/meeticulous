# Guest Booking Flow Improvements — Design Spec

**Date:** 2026-06-12
**Scope:** `client/src/pages/ServiceBooking.jsx`, `server/controllers/bookingController.js`, `server/controllers/paymentController.js`, supporting theme/utility files.
**Route affected:** `/:profileSlug/booking/:serviceSlug`

## Global UI Rules (apply to entire booking flow)
- **Border radius: 4px maximum.** Replace all `rounded-2xl`/`rounded-xl`/`rounded-lg`/`rounded-full` (except true pills like the tz chip and progress dots, which may stay circular) with a 4px radius token.
- **Theme color inheritance.** Every accent — buttons, active states, progress indicators, links, selected dates, selected timeslots, payment actions, success elements, hover states — uses the vendor's `theme_color` (`tc` / `--profile-accent`, already wired via `applyProfileTheme`). No generic `green-600`, `indigo-600`, or `gray-900` accents remain in the flow.
- Consistent spacing + divider usage. Premium, clean, no oversized rounding.
- Maintain existing functionality unless explicitly changed. Verify on desktop, tablet, mobile. No regressions to booking, payment, or calendar.

## Decisions (locked)
1. **Payment fix:** defer Google Calendar event creation to post-payment for paid services.
2. **Service rating:** host-level average (existing `GET /api/reviews/:username`); the rating row is hidden entirely when review count is 0.
3. **Profile card:** collapsed-by-default expandable card on all breakpoints (replaces the always-open left sticky sidebar).
4. **Delivery:** one spec; the payment fix (Section 5) is implemented and verified first.

---

## Section 5 — Payment Bug Fix (root cause confirmed)

### Root cause
For a **paid online** service, `createBooking` (bookingController.js ~L237) creates a Google Calendar event *immediately*, while the booking is still `status:"pending" / payment_status:"unpaid"`. At checkout, `createOrder` (paymentController.js ~L69) re-validates the slot via `availabilityService.validateSlot` with `excludeBookingId`. That exclusion removes the booking's **platform row** from the busy set, but `validateSlot` also checks **Google FreeBusy** (availabilityService.js ~L234), where the just-created event appears and is **not excludable**. Result: `overlaps(start,end,google.intervals)` is true → `ok:false` → 409 *"This slot is no longer available…"*. The guest's own pending booking blocks their own payment — fires ~100% of the time when the host has Google Calendar connected. Side effect: abandoned checkouts leave orphan calendar events.

### Fix
- In `createBooking`: only create the calendar event inline when the service is **free** (`service.price === 0`). For paid services, skip event creation; leave `meeting_link` empty on the pending row.
- In `verifyPayment` (paymentController.js): after the row flips to `paid/confirmed`, create the Google Calendar event (online + host connected), persist `meeting_link`, and return it in the response. Wrap in try/catch — a calendar failure must not fail an already-captured payment (log only).
- The Razorpay webhook path (`handleWebhook`) also confirms bookings; calendar creation lives in `verifyPayment` (the interactive happy path). Webhook remains the idempotent backstop for `payment_status`. (No calendar creation added to webhook to avoid double events; verifyPayment is the canonical creator.)
- Client: `handlePayment`'s verify handler reads `meeting_link` from the verify response and stores it on `confirmation` so the success screen shows the Join link.

### Validation
- Reproduce: paid online service, Google-connected host → confirm old code throws 409 at checkout.
- After fix: full paid booking completes; calendar event exists only after payment; abandoning checkout leaves no event.
- Regression: free booking still gets its event at booking time; genuine double-book still returns 409.

---

## Section 1 — Collapsible Profile Card
Compact card with header row: `[icon] Profile Information` + chevron. Collapsed by default; click toggles expand/collapse. Expanded content, divider-separated:
- **Vendor Profile:** profile photo, cover photo, vendor name. Divider.
- **Service Information:** service name, short description, service rating (hidden when 0 reviews). Divider.
- **Pricing & Duration:** service price, service duration.

Keep the existing "View full profile →" link exactly as-is. 4px radius, subtle dividers, theme accents. Applies on all breakpoints (replaces left sticky sidebar).

## Section 2 — Theme Color System
Source: vendor Settings → Appearance → Profile Color = `profiles.theme_color`, surfaced as `host.theme_color` → `tc`. Sweep the flow and route every accent through `tc`/`--profile-accent`. Specific replacements: total amounts (`text-green-600`), checkout total (`text-indigo-600`), 12h/24h toggle active (`bg-gray-900 text-white`), any other hardcoded accent. Guest sees only the vendor's chosen color.

## Section 3 — Date & Time Selection
Design and functionality are good. Changes limited to: (a) standardize radii to 4px, (b) ensure theme color integration on selected date / selected time / Continue. No logic changes.

## Section 4 — Booking Details Two-Column
Split the `details` step into two columns:
- **Left — Booking Summary:** Service, Date, Time, **Platform Fee (₹10 + GST)** with a circular "i" info icon → tooltip *"This helps us to keep your booking authenticated and send you timely reminders."*, then **Total Amount**.
- **Right — Customer Information:** First Name, Last Name, Email Address, Mobile Number, Notes.
- **Bottom:** full-width Continue button (preserves existing OTP-vs-direct logic: `Send Verification Code` for guests, `Continue to Payment` / `Confirm Booking` for logged-in).

Responsive: two columns on desktop/tablet, stacked on mobile. 4px radius.

## Section 6 — Booking Success Screen
After successful payment / free confirm:
- Heading "Booking Confirmed" (theme color).
- Details: Service, Date, Time, Customer Name, Meeting/Joining link.
- Actions: **Add to Google Calendar** (Google template URL built from booking details) and **Download iCal (.ics)** (client-generated Blob download).
- Premium, mobile-friendly, 4px radius, theme color inherited.

---

## Out of scope / non-goals
- No change to slot-generation or timezone logic (already correct).
- No per-service rating aggregation (host-level only).
- No change to OTP, plan, or pricing-engine behavior.
- No Razorpay webhook calendar creation (verifyPayment is canonical).
