# Design Spec — Booking Reschedule + Feature Flags + Reschedule Fee

_Date: 2026-06-14 · Status: approved design, pre-plan · Scope: "Group D — Booking Actions" (subset)_

## 1. Summary

Add guest-facing **reschedule**, **leave review**, and **rebook** to the customer
`My Bookings` page, plus the backend to make reschedule safe and revenue-aware:

1. **Feature Flags infra** — a generic admin "Feature Status" kill-switch system,
   seeded with two flags that gate this feature.
2. **Reschedule (guest)** — modal slot-picker reusing existing availability API,
   with a **Google Calendar event move** (currently missing).
3. **Reschedule fee** — full charging path built now, but defaults to **₹0** so the
   free path runs in production; flip per-vendor to ₹10 later.

Reschedule fee policy (all locked):
- **Owner:** platform keeps the fee (no vendor payout).
- **First reschedule free**, fee from the 2nd onward.
- **Refund:** never, regardless of who cancels.
- **Count:** unlimited reschedules; count is tracked for an admin abuse signal.

This is the only group being built this pass. Groups A (nav hygiene), B (content
pages), C (guest profile/settings), E (messages/saved), and the notification bell
are explicitly deferred.

## 2. Decisions (locked)

| Question | Decision |
|---|---|
| Action UI surface | Modal overlay |
| Reschedule guardrails | No time cutoff / no hard count cap |
| Kill-switch scope | `reschedule` flag disables **all** reschedule (guest + vendor) |
| Fee depth | Build full charging path; vendor `reschedule_fee` defaults to **₹0** |
| Fee owner | **Platform** keeps it (ledger → platform revenue, no payout) |
| Fee refund on cancel | **Never** (any party, any time) |
| Reschedule count | **Unlimited**, but `reschedule_count` tracked + admin alert at threshold |
| Fee timing | **First reschedule free**, charged from 2nd onward |
| Fee kill-switch | Separate `reschedule_fee` flag — off ⇒ all reschedules free platform-wide |
| Admin placement | New **top-level** "Feature Status" nav entry → `/admin/features` |

## 3. Architecture

Three coupled subsystems. Server-side enforcement is authoritative; client checks
only drive UI visibility.

### 3.1 Subsystem 1 — Feature Flags ("Feature Status")

**DB — new table `feature_flags`**
| column | type | notes |
|---|---|---|
| `key` | text PK | e.g. `reschedule`, `reschedule_fee` |
| `label` | text | "Booking Reschedule" |
| `description` | text | shown in admin |
| `enabled` | boolean | default `true` |
| `category` | text null | optional grouping |
| `updated_at` | timestamptz | |
| `updated_by` | uuid null | admin staff id |

Seed rows: `reschedule` (enabled true), `reschedule_fee` (enabled true).

**Server — `server/controllers/featureFlagController.js`**
- `GET  /api/admin/features` — list all (admin auth, perm `features.manage`)
- `PATCH /api/admin/features/:key` — `{ enabled }` (admin auth, perm `features.manage`)
- `GET  /api/feature-flags` — public; returns client-visible map `{ reschedule: true, reschedule_fee: true }`
- helper `isFeatureEnabled(key): Promise<boolean>` — short-TTL in-memory cache; used by
  other controllers. Fail-open default = `true` if the table/row is missing (so a
  missing migration never bricks reschedule).

**Admin UI — `client/src/pages/admin/AdminFeatureStatus.jsx`**
- Route `/admin/features` (via `AdminWrapper`).
- New **top-level** nav entry in `client/src/components/common/AdminLayout.jsx`
  (`{ label:'Feature Status', icon:<pick>, to:'/admin/features', perm:'features.manage' }`).
- Renders flag rows with a toggle switch; toggle → `PATCH` + optimistic update + toast.

**Client consumers — `client/src/hooks/useFeatureFlags.js`** (or a small context)
- Fetches `/api/feature-flags` once, exposes `flags.reschedule`, `flags.reschedule_fee`.
- Guest `My Bookings` and vendor `Bookings` hide reschedule UI when `reschedule` off.

**RBAC** — add `features.manage` permission to the admin role system
(`server/migrations/v2.4_admin_rbac.sql` lineage; grant to super admin).

### 3.2 Subsystem 2 — Reschedule (guest) + Calendar move

**Frontend (My Bookings — `client/src/pages/CustomerBookings.jsx`)**
- `client/src/components/booking/Modal.jsx` — NEW shared overlay (none exists):
  backdrop, centered panel, ESC + click-outside close, body scroll lock.
- `client/src/components/booking/RescheduleModal.jsx` — NEW:
  - shows current scheduled time
  - date picker (min today; mirrors `ServiceBooking.jsx` blocked/weekly handling)
  - on date → `getAvailableSlots(host_id, service_id, dateStr)` → slot grid
  - confirm → fee branch (§3.3) → `rescheduleBooking(id, { scheduled_at })`
  - handles `409` ("slot taken") → toast + refetch slots
- `client/src/components/booking/ReviewModal.jsx` — NEW: 1–5 star widget + optional
  comment → `createReview({ booking_id, rating, comment })`.
- Card buttons by status:
  - **Upcoming** (not cancelled): `Reschedule` (only if `flags.reschedule`) · `Cancel` (exists) · `Join Meet` (exists)
  - **Completed**: `Leave review` ↔ `Your review ★★★★☆` (once reviewed) · `Rebook`
  - **Cancelled / other past**: `Rebook`
- Rebook = `<Link to={`/${host.username}/booking/${services.slug}`}>` — both fields
  already present in the `getGuestBookings` payload (`services(*)`, `profiles(*)`).
- Review state: after load, for each **completed** booking call `getBookingReview(id)`
  in parallel → map `id → review|null` → drives button vs stars.

**Backend (`server/controllers/bookingController.js`, `server/config/google.js`)**
- Migration: `bookings.google_event_id text`.
- Store `eventId` on calendar-event creation in **both** create paths:
  - `bookingController.js` (~line 272, free/online path)
  - `paymentController.js` (~line 258, post-payment path)
  - (today the returned `eventId` is discarded; only `meeting_link` is stored)
- `server/config/google.js` — NEW `updateCalendarEvent(accessToken, refreshToken, eventId, { startTime, endTime, timezone })`
  → `calendar.events.patch({ calendarId:'primary', eventId, resource:{ start, end }, sendUpdates:'all' })`.
  Keeps the same Meet link; notifies attendees.
- `rescheduleBooking`:
  1. `if (!await isFeatureEnabled('reschedule')) → 403`
  2. existing auth + past-time + conflict/no-overlap checks (unchanged)
  3. fee branch (§3.3)
  4. update booking time (existing logic)
  5. if `google_event_id` present **and** host calendar connected →
     `updateCalendarEvent(...)` in a non-fatal try/catch; missing id → skip (old bookings)
  6. increment `reschedule_count` for **guest-initiated** reschedules
  7. existing notification emails (unchanged)
- **Vendor reschedule** is also gated by the `reschedule` flag (step 1 applies to all
  callers) but: no fee, keeps the existing `awaiting_guest_ack` → `confirmReschedule`
  flow, and does **not** increment the guest `reschedule_count`.

### 3.3 Subsystem 3 — Reschedule fee (built, default ₹0)

**DB**
- `profiles.reschedule_fee int default 0` — allowed values 0 or 10 (vendor-level).
- `bookings.reschedule_count int default 0` — guest-initiated reschedule count.

**Vendor UI** — toggle in vendor settings (`ProfileSetup.jsx` or `Availability.jsx`,
decide in plan): "Charge guests a reschedule fee" → ₹0 / ₹10. Persists via existing
`updateProfile`.

**Fee logic (server `rescheduleBooking`, guest-initiated only):**
```
count       = booking.reschedule_count
feeApplies  = count >= 1
              && await isFeatureEnabled('reschedule_fee')
              && vendor.reschedule_fee > 0
if feeApplies:
    require a verified Razorpay payment for vendor.reschedule_fee
      (client: POST /api/payment/reschedule-fee/create-order → checkout → verify)
    server re-validates the payment is captured before moving the booking
    post a RESCHEDULE_FEE journal entry → platform revenue (GST split per money-model v3)
else:
    proceed free  (covers: 1st reschedule, fee flag off, or vendor fee = 0)
move booking ; reschedule_count += 1
refund: NEVER
```

**Payments** — new endpoints in `server/controllers/paymentController.js`:
- `POST /api/payment/reschedule-fee/create-order` — Razorpay order for `vendor.reschedule_fee`
- verify step reuses the standard verify pattern; on success the client calls
  reschedule with the payment reference, and the server confirms capture before moving.
- Ledger: post via the existing posting service / journal templates
  (`post_journal_entry` RPC, money-model v3). New template `RESCHEDULE_FEE`
  (all platform revenue; no vendor payable line). Idempotent on `source_type+source_id`.

**Because `reschedule_fee` defaults to 0**, no live charge or posting happens today;
the paid path is exercised by tests with a mocked Razorpay + fee = 10.

### 3.4 Admin abuse signal
- Surface `reschedule_count` in the admin bookings view; flag/badge bookings where
  `reschedule_count >= 3` (constant `RESCHEDULE_ALERT_THRESHOLD`, adjustable).
- Lightweight: a column + visual flag (optionally a filter). No notification send.

## 4. Data flow (guest reschedule, happy path)

1. Guest opens `My Bookings` → `getGuestBookings()` + `/api/feature-flags`.
2. Clicks `Reschedule` (visible only if `flags.reschedule`) → `RescheduleModal`.
3. Picks date → `getAvailableSlots` → picks slot → Confirm.
4. Client resolves fee: if `feeApplies` → Razorpay order/checkout/verify first.
5. `PUT /api/bookings/:id/reschedule { scheduled_at, [paymentRef] }`.
6. Server: flag check → validations → fee check → move booking → patch Calendar →
   `reschedule_count++` → emails.
7. Client patches the booking in the list + toast.

## 5. Migrations (confirm exact next numbers against `server/migrations/` at build)
- `v3.2_feature_flags.sql` — `feature_flags` table + seed (`reschedule`, `reschedule_fee`) + `features.manage` perm grant.
- `v3.3_booking_reschedule.sql` — `bookings.google_event_id`, `bookings.reschedule_count`.
- `v3.4_reschedule_fee.sql` — `profiles.reschedule_fee`.
- DO NOT apply `v2.9_explore.sql` (unrelated landmine — Explore deferred).
- Code must fall back gracefully until applied (match existing schema-cache fallback pattern).

## 6. Testing

**Jest (server)**
- `feature_flags`: toggle persists; `getPublicFlags` returns expected map; `isFeatureEnabled` cache + fail-open.
- reschedule returns `403` when `reschedule` flag off.
- 1st reschedule free; 2nd reschedule with vendor fee=10 + flag on → requires verified payment (mock Razorpay); free when flag off or fee=0.
- calendar `events.patch` called when `google_event_id` present; skipped when absent (mock `google.js`).
- `RESCHEDULE_FEE` ledger entry posted on paid reschedule (mock posting RPC); none when free.
- `reschedule_count` increments on guest reschedule, not on vendor reschedule.

**Vitest (client)**
- `RescheduleModal`: date → slot fetch; free path calls `rescheduleBooking`; paid path triggers checkout (mock).
- `ReviewModal`: star select + submit calls `createReview`; error toast.
- `CustomerBookings`: button visibility per status + `flags.reschedule`; review button ↔ stars swap.
- `AdminFeatureStatus`: toggle calls PATCH + optimistic update.

## 7. Out of scope / deferred
- Notification bell (its own mini-project: needs a guest notification feed table + read/mark-read API).
- Groups A (nav hygiene), B (content pages), C (guest profile/settings), E (messages/saved).
- Fee refund flow, hard reschedule cap, "free within cooling-off" timing.
- Reschedule fee refund on cancel (decision: never refund).

## 8. Open items to confirm during writing-plans
- Exact migration version numbers (verify against applied-live list).
- Vendor fee toggle placement (`ProfileSetup` vs `Availability`).
- Ledger `RESCHEDULE_FEE` GST treatment detail (inclusive vs added) — align with money-model v3.
- Admin bookings flag UI placement + whether a filter is added.
- Icon choice for the Feature Status nav entry.
