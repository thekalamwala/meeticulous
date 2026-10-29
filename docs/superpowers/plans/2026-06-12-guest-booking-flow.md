# Guest Booking Flow Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the false "slot no longer available" payment bug and redesign the guest booking flow (collapsible profile card, two-column details, themed success screen) to a premium 4px-radius, vendor-theme-colored experience.

**Architecture:** Server fix moves Google Calendar event creation from booking-time to payment-verification-time for paid services, eliminating a self-collision during slot re-validation. Client changes are confined to `client/src/pages/ServiceBooking.jsx`, routing every accent through the vendor `theme_color` (`tc`) and standardizing radii to Tailwind's bare `rounded` (4px).

**Tech Stack:** React 18 + Vite + Tailwind (client), Node/Express + Jest (server), Supabase, Razorpay, Google Calendar API.

**Conventions:**
- Server tests: `cd server && npx jest tests/unit/<file> -t "<name>"`. Mock pattern mirrors `server/tests/unit/serviceController.test.js` (fluent supabase mock).
- Client has **no test runner**; verify UI with the preview tools (`preview_start`, `preview_snapshot`, `preview_screenshot`, `preview_resize`) per the verification workflow. Reproduce → observe → fix.
- Tailwind `rounded` = `0.25rem` = **4px**. The radius sweep replaces `rounded-2xl|xl|lg` with `rounded`. Keep `rounded-full` only on true circles (progress dots, status dot, tz/avatar) — these are pills, not "oversized corners".
- Commit after every task. Branch first (repo currently not a git repo per environment — run `git init` + initial commit only if the user confirms; otherwise commit into the existing VCS the user uses).

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `server/controllers/bookingController.js` | Modify ~L234-266 | Skip calendar event for PAID services at booking time |
| `server/controllers/paymentController.js` | Modify `verifyPayment` ~L135-246 | Create calendar event + persist `meeting_link` after capture |
| `server/tests/unit/bookingCalendarDeferral.test.js` | Create | Assert calendar deferral decision logic |
| `client/src/pages/ServiceBooking.jsx` | Modify | All 6 UI sections + read `meeting_link` from verify response |

---

## PHASE A — Payment Bug Fix (Section 5) — build & verify FIRST

### Task 1: Defer calendar event creation for paid services in `createBooking`

**Files:**
- Modify: `server/controllers/bookingController.js:234-266`
- Test: `server/tests/unit/bookingCalendarDeferral.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `server/tests/unit/bookingCalendarDeferral.test.js`:

```javascript
/**
 * Verifies the payment-bug fix: createBooking must NOT create a Google Calendar
 * event for PAID services (deferred to verifyPayment). Free services still do.
 */
jest.mock('../../config/google', () => ({
  createCalendarEvent: jest.fn().mockResolvedValue({ meetLink: 'https://meet.google.com/x' }),
}));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (v) => v }));
jest.mock('../../services/availabilityService', () => ({
  validateSlot: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock('../../middleware/planMiddleware', () => ({
  checkBookingReceiveLimit: jest.fn().mockResolvedValue({ allowed: true }),
}));
jest.mock('../../services/planService', () => ({
  resolveVendorPlan: () => 'explorer',
  getPlan: jest.fn().mockResolvedValue({ commission_percentage: 0 }),
}));
jest.mock('../../services/platformConfig', () => ({
  getConfig: jest.fn().mockResolvedValue({ platformFee: 10, gstRate: 0.18 }),
}));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue() }));
jest.mock('../../utils/sendEmail', () => jest.fn().mockResolvedValue());
jest.mock('../../lib/pricingEngine', () => ({
  computeBreakdown: () => ({ platformFee: 10, commission: 0, vendorPayout: 100, gst: 1.8, customerTotal: 111.8 }),
}));

const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

const { createCalendarEvent } = require('../../config/google');
const { createBooking } = require('../../controllers/bookingController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };

const wireSupabase = ({ service, host, avail }) => {
  mockFrom.mockImplementation((table) => {
    const chain = {
      select: jest.fn(() => chain), eq: jest.fn(() => chain), neq: jest.fn(() => chain),
      insert: jest.fn(() => chain),
      single: jest.fn().mockResolvedValue(
        table === 'services' ? { data: service } :
        table === 'profiles' ? { data: host } :
        { data: { id: 'bkg-1', ...service }, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: avail }),
    };
    return chain;
  });
};

beforeEach(() => jest.clearAllMocks());

test('paid online service does NOT create a calendar event at booking time', async () => {
  wireSupabase({
    service: { id: 's1', title: 'SEO', duration: 30, price: 500, meeting_mode: 'online' },
    host: { id: 'h1', email: 'h@x.com', google_calendar_connected: true, google_refresh_token: 'r', google_access_token: 'a' },
    avail: { timezone: 'Asia/Kolkata' },
  });
  const req = { body: { service_id: 's1', host_id: 'h1', guest_name: 'G', guest_email: 'g@x.com', scheduled_at: '2099-01-01T05:00:00.000Z' } };
  await createBooking(req, res());
  expect(createCalendarEvent).not.toHaveBeenCalled();
});

test('free online service STILL creates a calendar event at booking time', async () => {
  wireSupabase({
    service: { id: 's1', title: 'Intro', duration: 30, price: 0, meeting_mode: 'online' },
    host: { id: 'h1', email: 'h@x.com', google_calendar_connected: true, google_refresh_token: 'r', google_access_token: 'a' },
    avail: { timezone: 'Asia/Kolkata' },
  });
  const req = { body: { service_id: 's1', host_id: 'h1', guest_name: 'G', guest_email: 'g@x.com', scheduled_at: '2099-01-01T05:00:00.000Z' } };
  await createBooking(req, res());
  expect(createCalendarEvent).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/bookingCalendarDeferral.test.js -t "paid online service does NOT"`
Expected: FAIL — `createCalendarEvent` called 1 time (current code creates it for paid too).

- [ ] **Step 3: Implement the deferral**

In `server/controllers/bookingController.js`, change the calendar block (~L234-266). Add `service.price === 0` to the guard so paid services skip event creation:

```javascript
    // Google Calendar — created at booking time ONLY for FREE services.
    // PAID services defer event creation to paymentController.verifyPayment so a
    // pending/unpaid booking does not place a placeholder event that would then
    // collide with itself during pre-payment slot re-validation (the "slot no
    // longer available" bug) and to avoid orphan events from abandoned checkouts.
    let meetingLink = "";
    const isOnline = service.meeting_mode !== "offline";
    if (
      isOnline &&
      service.price === 0 &&
      host.google_calendar_connected &&
      host.google_refresh_token
    ) {
      try {
        const startTime = new Date(scheduled_at);
        const endTime = new Date(startTime.getTime() + service.duration * 60000);
        const event = await createCalendarEvent(
          decryptToken(host.google_access_token),
          decryptToken(host.google_refresh_token),
          {
            title: `${service.title} — ${guest_name || "Guest"}`,
            description: `Booked via Book A Sloth\n${notes || ""}`,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            timezone: hostTimezone,
            attendees: [
              { email: host.email },
              ...(guest_email ? [{ email: guest_email }] : []),
            ],
          },
        );
        meetingLink = event.meetLink || "";
      } catch (calError) {
        console.error("Google Calendar error:", calError.message);
      }
    }
```

- [ ] **Step 4: Run both tests to verify they pass**

Run: `cd server && npx jest tests/unit/bookingCalendarDeferral.test.js`
Expected: PASS (2 tests) — paid skips, free still creates.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/bookingController.js server/tests/unit/bookingCalendarDeferral.test.js
git commit -m "fix(booking): defer calendar event to post-payment for paid services"
```

---

### Task 2: Create the calendar event in `verifyPayment` and persist `meeting_link`

**Files:**
- Modify: `server/controllers/paymentController.js` (top imports + `verifyPayment` ~L156-186)

- [ ] **Step 1: Add imports at top of `paymentController.js`**

After the existing `require` block (~L1-10), add:

```javascript
const { createCalendarEvent } = require("../config/google");
const { decrypt: decryptToken } = require("../utils/cryptoTokens");
```

- [ ] **Step 2: Fetch host + service fields needed for the event in `verifyPayment`**

In `verifyPayment`, widen the initial booking fetch (~L140-143) so we have what the calendar event needs:

```javascript
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("razorpay_order_id, payment_status, commission_applied, meeting_link, scheduled_at, guest_name, guest_email, notes, host_id, service_id, services(price, title, duration, meeting_mode)")
      .eq("id", booking_id).single();
```

- [ ] **Step 3: After the row is marked paid/confirmed, create the calendar event**

Immediately AFTER the `if (error) return res.status(500)...` line that follows the `fullUpdate` (~L185), and BEFORE `auditLog('PAYMENT_VERIFIED'...)`, insert:

```javascript
    // Payment captured → now create the Google Calendar event (deferred from
    // booking time for paid services). A calendar failure must NOT fail an
    // already-charged payment — log and continue with an empty meeting link.
    let meetingLink = booking.meeting_link || "";
    try {
      const svc = booking.services || {};
      const isOnline = svc.meeting_mode !== "offline";
      if (isOnline && !meetingLink) {
        const { data: host } = await supabaseAdmin
          .from("profiles")
          .select("id, email, google_calendar_connected, google_access_token, google_refresh_token")
          .eq("id", booking.host_id).single();
        const { data: avail } = await supabaseAdmin
          .from("availability").select("timezone").eq("host_id", booking.host_id).maybeSingle();
        if (host?.google_calendar_connected && host?.google_refresh_token) {
          const startTime = new Date(booking.scheduled_at);
          const endTime = new Date(startTime.getTime() + (svc.duration || 30) * 60000);
          const event = await createCalendarEvent(
            decryptToken(host.google_access_token),
            decryptToken(host.google_refresh_token),
            {
              title: `${svc.title || "Service"} — ${booking.guest_name || "Guest"}`,
              description: `Booked via Book A Sloth\n${booking.notes || ""}`,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              timezone: avail?.timezone || "Asia/Kolkata",
              attendees: [
                { email: host.email },
                ...(booking.guest_email ? [{ email: booking.guest_email }] : []),
              ],
            },
          );
          meetingLink = event.meetLink || "";
          if (meetingLink) {
            const { data: relinked } = await supabaseAdmin
              .from("bookings").update({ meeting_link: meetingLink }).eq("id", booking_id).select().single();
            if (relinked) updated = relinked;
          }
        }
      }
    } catch (calErr) {
      console.error("Post-payment calendar event error (non-fatal):", calErr.message);
    }
```

- [ ] **Step 4: Verify the full server suite still passes (no regressions)**

Run: `cd server && npx jest`
Expected: PASS — existing suites green, plus the 2 new deferral tests. If `verifyPayment` has an existing test that asserts no extra `from('profiles')` calls, update its mock to tolerate the new fetch.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/paymentController.js
git commit -m "fix(payment): create calendar event + meeting link after payment capture"
```

---

### Task 3: Client reads `meeting_link` from the verify response

**Files:**
- Modify: `client/src/pages/ServiceBooking.jsx:446-459` (verify handler inside `handlePayment`)

- [ ] **Step 1: Update the verify handler to merge the returned meeting link**

Replace the `handler` body (~L446-459) so the confirmed screen gets the freshly-created link:

```javascript
        handler: async (response) => {
          try {
            const { data: verifyData } = await verifyPayment({
              booking_id: confirmation.id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            // Post-payment the server creates the calendar event; pick up the link.
            if (verifyData?.booking) {
              setConfirmation((prev) => ({ ...prev, ...verifyData.booking }));
            }
            setStep("confirmed");
            toast.success("Payment successful! Booking confirmed.");
          } catch {
            toast.error("Payment verification failed. Contact support.");
          }
        },
```

- [ ] **Step 2: Verify end-to-end in the preview**

Start the app (`preview_start`), open `/<vendor>/booking/<service>` for a PAID online service whose host has Google connected. Complete a test payment.
Expected: no "slot no longer available" 409 at checkout; success screen shows "Join Google Meet". Confirm via `preview_console_logs` (no 409) and `preview_snapshot` (Join link present).

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ServiceBooking.jsx
git commit -m "fix(booking): show post-payment meeting link on confirmation"
```

---

## PHASE B — UI Redesign (Sections 1-4, 6) + Global Rules

> All Phase B edits are in `client/src/pages/ServiceBooking.jsx`. Verify each task with the preview tools at 1280px (desktop), 768px (tablet), 375px (mobile).

### Task 4: Add shared helpers (iCal, Google Calendar URL, collapse state)

**Files:**
- Modify: `client/src/pages/ServiceBooking.jsx` (top-level helpers near L40, and component state near L73)

- [ ] **Step 1: Add calendar-export helpers above the component (after `loadRazorpay`, ~L48)**

```javascript
// Build a Google Calendar "add event" URL from a UTC start ISO + duration (min).
const googleCalUrl = ({ title, details, location, startISO, durationMin }) => {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMin * 60000);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "Booking",
    dates: `${fmt(start)}/${fmt(end)}`,
    details: details || "",
    location: location || "",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
};

// Generate a downloadable .ics blob URL for a single event.
const buildICS = ({ title, details, location, startISO, durationMin, uid }) => {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMin * 60000);
  const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Book A Sloth//Booking//EN",
    "BEGIN:VEVENT", `UID:${uid || fmt(start)}@bookasloth`, `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(details)}`, `LOCATION:${esc(location)}`, "END:VEVENT", "END:VCALENDAR",
  ];
  return URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
};
```

- [ ] **Step 2: Add collapse state for the profile card (near L73, with the other `useState`)**

```javascript
  const [profileOpen, setProfileOpen] = useState(false); // Section 1: collapsed by default
```

- [ ] **Step 3: Verify it compiles**

Reload preview; `preview_console_logs` shows no build/syntax errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ServiceBooking.jsx
git commit -m "feat(booking): add calendar-export helpers and profile collapse state"
```

---

### Task 5: Collapsible "Profile Information" card (Section 1)

**Files:**
- Modify: `client/src/pages/ServiceBooking.jsx:528-595` (replace the left sidebar card)

- [ ] **Step 1: Replace the LEFT sidebar block (~L528-595) with the collapsible card**

```jsx
        {/* ── LEFT: Collapsible Profile Card ── */}
        <div className="lg:w-[300px] flex-shrink-0">
          <div className="bg-white border rounded overflow-hidden lg:sticky lg:top-24">
            {/* Header toggle */}
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: tc }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile Information
              </span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {profileOpen && (
              <div className="border-t">
                {/* Section 1: Vendor Profile */}
                <div className="h-20 relative overflow-hidden"
                  style={{ background: host.cover_image ? undefined : `linear-gradient(135deg, ${tc}26, ${tc}55)` }}>
                  {host.cover_image && <img src={host.cover_image} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex justify-center -mt-7">
                  <div className="w-14 h-14 rounded border-2 overflow-hidden bg-white" style={{ borderColor }}>
                    {host.profile_image
                      ? <img src={host.profile_image} alt={host.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ color: tc }}>
                          {host.name?.charAt(0)?.toUpperCase()}
                        </div>}
                  </div>
                </div>
                <div className="px-4 pt-2 pb-4 text-center">
                  <h2 className="text-base font-bold text-gray-900">{host.name}</h2>
                </div>

                {/* Divider + Section 2: Service Information */}
                <div className="px-4 py-4 border-t text-left">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">Service</p>
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{service.title}</p>
                  {service.description && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {service.description.slice(0, 140)}{service.description.length > 140 ? "…" : ""}
                    </p>
                  )}
                  {host.review_count > 0 && (
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" style={{ fill: tc }}>
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                      <span className="font-semibold text-gray-700">{host.review_avg}</span>
                      <span className="text-gray-400">({host.review_count})</span>
                    </p>
                  )}
                </div>

                {/* Divider + Section 3: Pricing & Duration */}
                <div className="px-4 py-4 border-t text-left">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">Pricing & Duration</p>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold" style={{ color: tc }}>
                      {service.price === 0 ? "Free" : `₹${service.price}`}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                      </svg>
                      {service.duration} min
                    </span>
                  </div>
                </div>

                {/* View full profile — kept exactly as before */}
                <div className="px-4 pb-4">
                  <Link to={`/${profileSlug}`}
                    className="block text-xs font-medium hover:opacity-75 transition-opacity"
                    style={{ color: tc }}>
                    View full profile →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
```

- [ ] **Step 2: Provide `review_avg` / `review_count` to the card**

The host object must carry rating data. Check whether `getServiceBySlug` returns it; if not, fetch host reviews on load. Add near the service-load `useEffect` (~L102-120), inside `fetchService` after `setHost(data.host)`:

```javascript
        // Section 1: host-level rating for the profile card (hidden when 0)
        try {
          const username = data.host?.username || profileSlug;
          const { data: rv } = await getHostReviews(username);
          setHost((h) => h ? { ...h, review_avg: rv?.avg ?? 0, review_count: rv?.count ?? 0 } : h);
        } catch { /* no reviews → row stays hidden */ }
```

Add `getHostReviews` to the import from `../services/api` (L3-12). If `api.js` lacks it, add:

```javascript
// in client/src/services/api.js
export const getHostReviews = (username) => api.get(`/reviews/${username}`);
```

- [ ] **Step 3: Verify in preview (all breakpoints)**

Reload. Confirm: card shows only the `Profile Information` header collapsed by default; clicking expands the three divider-separated sections; clicking again collapses. Rating row absent when the vendor has no reviews. `preview_resize` to 768 and 375 — card remains usable and 4px-cornered.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ServiceBooking.jsx client/src/services/api.js
git commit -m "feat(booking): collapsible Profile Information card (Section 1)"
```

---

### Task 6: Theme-color sweep + radius standardization (Sections 2 & 3)

**Files:**
- Modify: `client/src/pages/ServiceBooking.jsx` (whole file)

- [ ] **Step 1: Replace hardcoded accent colors with the vendor theme (`tc`)**

Make these exact replacements:
- Booking Summary total (~L913): `className="text-green-600"` → remove the class, add `style={{ color: tc }}`.
- Checkout total (~L1068): `className="text-indigo-600"` → `style={{ color: tc }}`.
- 12h/24h toggle active state (~L735-746): replace `bg-gray-900 text-white` with inline style on the active button:

```jsx
                          <button
                            onClick={() => setTimeFormat("12h")}
                            className="min-h-9 px-3 py-1"
                            style={timeFormat === "12h" ? { background: tc, color: textOnTheme } : { color: "#6b7280" }}
                          >
                            12h
                          </button>
                          <button
                            onClick={() => setTimeFormat("24h")}
                            className="min-h-9 px-3 py-1"
                            style={timeFormat === "24h" ? { background: tc, color: textOnTheme } : { color: "#6b7280" }}
                          >
                            24h
                          </button>
```

- "Back to … profile" link in confirmed view (~L1159-1163): `text-green-600` → `style={{ color: tc }}`.
- Meeting link anchors (`text-blue-600`, ~L1132, L1141): leave Google Meet brand-blue OR switch to `tc` — switch to `style={{ color: tc }}` for full theme consistency per spec.

- [ ] **Step 2: Standardize radii to 4px**

In `ServiceBooking.jsx`, replace every `rounded-2xl`, `rounded-xl`, and `rounded-lg` with `rounded`. KEEP `rounded-full` on: progress dots (~L606), the green status dot (~L539), the tz chip (~L645), the OTP/payment/confirmed circular icon badges, and the 12h/24h toggle wrapper (pill). Use find-and-confirm, not blind replace-all, so true pills are preserved.

- [ ] **Step 3: Verify in preview**

Reload. `preview_screenshot` the time step and details step. Confirm: selected date, selected time, Continue button, progress bar all render in the vendor color; corners are 4px; no green/indigo/gray accents remain. `preview_inspect` a card to confirm `border-radius: 4px`.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ServiceBooking.jsx
git commit -m "style(booking): vendor theme color sweep + 4px radius (Sections 2-3)"
```

---

### Task 7: Two-column Booking Details (Section 4)

**Files:**
- Modify: `client/src/pages/ServiceBooking.jsx:795-934` (the `details` step)

- [ ] **Step 1: Replace the details step body with a two-column layout**

Keep the existing back button + `handleSendOtp` button logic; restructure the middle into left summary / right form:

```jsx
          {/* STEP: details */}
          {step === "details" && (
            <div className="bg-white border rounded p-5 sm:p-7">
              <button onClick={() => setStep("time")}
                className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg> Back
              </button>
              <h2 className="text-xl font-bold mb-5">Enter Details</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT: Booking Summary */}
                <div className="order-2 lg:order-1">
                  <h3 className="font-semibold mb-3 text-sm text-gray-700">Booking Summary</h3>
                  <div className="border rounded p-4 text-sm space-y-3">
                    <div className="flex justify-between"><span className="text-gray-500">Service</span>
                      <span className="font-medium text-right">{service.title}</span></div>
                    <div className="flex justify-between border-t pt-3"><span className="text-gray-500">Date</span>
                      <span>{selectedDate?.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</span></div>
                    <div className="flex justify-between border-t pt-3"><span className="text-gray-500">Time</span>
                      <span>{formatTime(selectedTime)} – {formatTime(getEndTime(selectedTime))} <span className="text-gray-400 text-xs">({tzAbbr})</span></span></div>
                    {isPaid && (
                      <div className="flex justify-between border-t pt-3">
                        <span className="text-gray-500 flex items-center gap-1">
                          Platform Fee (₹10 + GST)
                          <span className="relative group inline-flex">
                            <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                            </svg>
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded bg-gray-900 text-white text-xs p-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                              This helps us to keep your booking authenticated and send you timely reminders.
                            </span>
                          </span>
                        </span>
                        <span>₹{Math.round((10 + 10 * 0.18) * 100) / 100}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-3 font-semibold text-base">
                      <span>Total Amount</span>
                      <span style={{ color: tc }}>
                        {service.price === 0 ? "Free" : `₹${Math.round((service.price + 10 + 10 * 0.18) * 100) / 100}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Customer Information */}
                <div className="order-1 lg:order-2 space-y-4">
                  <h3 className="font-semibold mb-3 text-sm text-gray-700">Customer Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">First Name</label>
                      <input type="text" required className="fb-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Last Name</label>
                      <input type="text" className="fb-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email Address</label>
                    <input type="email" required className="fb-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Mobile Number</label>
                    <input type="tel" required placeholder="+91 98765 43210" className="fb-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    <p className="text-xs text-gray-400 mt-1">Your verification code arrives on WhatsApp (and email as backup).</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <textarea rows={3} placeholder="Any specific requirements..." className="fb-input resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Full-width Continue */}
              <button
                onClick={handleSendOtp}
                disabled={otpSending || !firstName || !email || (!user && !isPhoneValid)}
                className="mt-6 w-full py-3 rounded font-bold text-sm transition-opacity hover:opacity-85 disabled:opacity-50"
                style={{ background: tc, color: textOnTheme }}
              >
                {otpSending || verifying ? "Please wait..." : user ? (isPaid ? "Continue to Payment" : "Confirm Booking") : "Send Verification Code"}
              </button>
            </div>
          )}
```

- [ ] **Step 2: Verify in preview (responsive)**

Reload, navigate to the details step. At 1280px: two columns (summary left, form right). At 375px: form stacks above summary is acceptable per `order-*`; confirm Continue is full-width. Hover the "i" icon → tooltip text appears. `preview_screenshot` desktop + mobile.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ServiceBooking.jsx
git commit -m "feat(booking): two-column booking details with platform-fee tooltip (Section 4)"
```

---

### Task 8: Premium Success screen with calendar export (Section 6)

**Files:**
- Modify: `client/src/pages/ServiceBooking.jsx:1090-1167` (the `confirmed` step)

- [ ] **Step 1: Replace the confirmed step with the themed export-enabled version**

```jsx
          {/* STEP: confirmed */}
          {step === "confirmed" && confirmation && (() => {
            const scheduledISO = wallClockToUTC(
              selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
              ...selectedTime.split(":").map(Number), hostTz
            );
            const calTitle = `${service.title} with ${host.name}`;
            const calDetails = confirmation.meeting_link ? `Join: ${confirmation.meeting_link}` : "";
            const gUrl = googleCalUrl({ title: calTitle, details: calDetails, location: confirmation.meeting_link || "Online", startISO: scheduledISO, durationMin: service.duration || 30 });
            const icsUrl = buildICS({ title: calTitle, details: calDetails, location: confirmation.meeting_link || "Online", startISO: scheduledISO, durationMin: service.duration || 30, uid: confirmation.id });
            return (
            <div className="bg-white border rounded p-5 sm:p-7">
              <div className="max-w-md mx-auto text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: `${tc}18` }}>
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: tc }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: tc }}>Booking Confirmed</h2>
                <p className="text-sm text-gray-500 mb-6">
                  {selectedDate?.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at {formatTime(selectedTime)} ({tzAbbr})
                </p>
                <div className="border rounded p-4 text-sm text-left space-y-3 mb-6">
                  <div className="flex justify-between"><span className="text-gray-500">Service</span><span className="font-medium">{service.title}</span></div>
                  <div className="flex justify-between border-t pt-3"><span className="text-gray-500">Date</span><span>{selectedDate?.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span></div>
                  <div className="flex justify-between border-t pt-3"><span className="text-gray-500">Time</span><span>{formatTime(selectedTime)} ({tzAbbr})</span></div>
                  <div className="flex justify-between border-t pt-3"><span className="text-gray-500">Customer</span><span>{`${firstName} ${lastName}`.trim()}</span></div>
                  {confirmation.meeting_link && (
                    <div className="flex justify-between border-t pt-3 items-center"><span className="text-gray-500">Meeting</span>
                      <a href={confirmation.meeting_link} target="_blank" rel="noreferrer" className="font-medium hover:underline" style={{ color: tc }}>Join Link</a></div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a href={gUrl} target="_blank" rel="noreferrer"
                    className="py-2.5 rounded font-semibold text-sm border transition-opacity hover:opacity-85"
                    style={{ borderColor: tc, color: tc }}>
                    Add to Google Calendar
                  </a>
                  <a href={icsUrl} download={`${service.title.replace(/\s+/g, "-")}.ics`}
                    className="py-2.5 rounded font-semibold text-sm transition-opacity hover:opacity-85"
                    style={{ background: tc, color: textOnTheme }}>
                    Download iCal (.ics)
                  </a>
                </div>
                <p className="text-xs text-gray-400 mt-4">Confirmation email sent to {email}</p>
                <Link to={`/${profileSlug}`} className="block mt-3 text-sm hover:underline" style={{ color: tc }}>
                  Back to {host.name}'s profile
                </Link>
              </div>
            </div>
            );
          })()}
```

- [ ] **Step 2: Verify in preview**

Complete a free booking (no payment) to reach the confirmed screen quickly. Confirm: heading + buttons in theme color; "Add to Google Calendar" opens a prefilled Google event in a new tab; "Download iCal" downloads a `.ics` whose `DTSTART` matches the booked UTC time. `preview_screenshot` desktop + 375px.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ServiceBooking.jsx
git commit -m "feat(booking): premium themed success screen with Google/iCal export (Section 6)"
```

---

### Task 9: Final cross-flow regression sweep

**Files:** none (verification only)

- [ ] **Step 1: Walk the full guest journey in preview**

For a PAID online service (Google-connected host): time → details → (OTP as guest) → payment → confirmed. Confirm no 409, themed throughout, 4px corners, calendar export works, Join link present.

- [ ] **Step 2: Walk a FREE service journey**

time → details → confirmed (no payment step). Confirm event created at booking time (free path unchanged), export buttons present.

- [ ] **Step 3: Logged-in user path**

Confirm OTP step is skipped (STEPS array), details button reads "Continue to Payment"/"Confirm Booking".

- [ ] **Step 4: Run server suite once more**

Run: `cd server && npx jest`
Expected: PASS.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "test(booking): verify guest flow end-to-end (no regressions)"
```

---

## Self-Review Notes (spec coverage)
- Section 1 (collapsible card) → Task 5. Section 2 (theme) → Task 6. Section 3 (date/time radius+theme) → Task 6. Section 4 (two-column details + fee tooltip) → Task 7. Section 5 (payment bug) → Tasks 1-3. Section 6 (success + exports) → Task 8. Global rules (4px, theme, responsive, no regressions) → Tasks 6 + 9.
- Rating decision (host-level, hidden at 0) → Task 5 Step 2.
- Platform fee value (₹10 + 18% GST = ₹11.8) shown in summary; final total uses the same arithmetic the server snapshot uses (`computeBreakdown`), so the displayed estimate matches the Razorpay charge for the default config. If a vendor/platform overrides the fee, the authoritative number still comes from `confirmation.platform_fee_amount` on the payment step (unchanged).
