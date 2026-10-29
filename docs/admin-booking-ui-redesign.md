# Admin Booking UI Redesign — Decisions & Assumptions

_Last updated: 2026-06-13 — UI/UX restructure only (no backend, schema, or API changes)._

## Scope
Redesigned the admin booking management experience into a support/operations
console. Files touched:
- `client/src/pages/admin/AdminBookings.jsx` — full rewrite (list + state tabs + search + detail modal + edit modal).
- `client/src/components/common/AdminLayout.jsx` — added **Live** to the Bookings sub-nav + breadcrumb label.

Routes are unchanged: `/admin/bookings` and `/admin/bookings/:filter`
(`upcoming | live | completed | cancelled | disputes`) both render `AdminBookings`.
`/admin` still redirects to `/super-dashboard`. `/admin/support/disputes`
(`AdminDisputes`) left as-is — out of the booking scope.

## What changed
| Before | After |
|---|---|
| Generic table-ish rows, raw `<select>` for status + payment inline on every row | Scan-optimized cards; quick actions reduced to **View (eye)** + **Edit (pencil)** |
| Status-only pill filter (pending/confirmed/…) | **Operational state** tabs: All / Upcoming / Live / Completed / Cancelled / Disputes, with live counts |
| No search | **Search by Booking ID / Phone / Email only** (per brief) |
| No detail view | **Booking Detail Modal** as the primary management interface |
| Server pagination over a single status | Client-side state derivation + search + pagination over a generous fetch |

## Operational state model (UI philosophy)
Derived client-side in `deriveState()` from `status` + `scheduled_at` + `services.duration`:
- **Cancelled** — `status === 'cancelled'`
- **Completed** — `status === 'completed'` OR end time is in the past
- **Live** — now is between start and end
- **Upcoming** — start is in the future
- **Disputed** — *no backend field exists.* Never derived; the Disputes tab shows
  an empty state. The modal still ships the full disputed action-set for when the
  backend lands.

## Key assumptions
1. **Search is client-side.** `GET /admin/bookings` only supports `{ status, page, limit }`
   — no search/text param. Per the "no backend work" rule, search + state filtering run
   client-side over a high-limit fetch (`FETCH_LIMIT = 200`, using the existing `limit` param).
   Matching is restricted to **booking id / guest_email / guest_phone** (digits-normalized) — nothing else.
   - **TODO(backend):** add a server `q` search param + state filter, then drop the high-limit fetch. Flagged in code.
2. **Detail modal uses the list payload.** The list endpoint already returns `*` plus
   `services(title, price, duration)` and host `profiles(name, email, username)`, so the
   modal needs **no extra fetch / no new API**.
3. **Timezone** is shown as `Asia/Kolkata (IST)` — bookings have no per-row tz column
   (it lives on `availability`, default IST).
4. **Vendor phone** is not selected by the list endpoint, so the modal shows `—` and
   "Call Vendor" is a placeholder. Vendor email + profile link are real.
5. **Meeting provider/ID** are derived from `meeting_link` (Google Meet / Zoom / Online;
   ID = last URL path segment).
6. **Payout Information** (status/date/txn id) — P2 settlement engine is not built.
   Section shows `settlement_status` + `payment_id` and is otherwise placeholder.

## Detail Modal structure (per brief)
Header → Customer Info → Vendor Info → Booking Info → Payment Summary →
Payout Information → Meeting Information → Timeline → Actions → **Admin Actions** (collapsible, collapsed by default, dark, visually separated).

- **Customer:** name/email/phone + Email, Call, Copy-email, Copy-phone.
- **Vendor:** name/email/phone + Email, Call (placeholder), View Profile.
- **Payment Summary:** Total, Platform Fee, Vendor Earnings, Taxes (`commission_gst` + `razorpay_tax_actual`), Payment Method (Razorpay if `payment_id`), Payment Status.
- **Meeting visibility (state-aware):** Upcoming → link + copy; Live → **Join Meeting**; Completed/Cancelled → Join hidden.
- **Timeline:** first-class; real timestamps where available (`created_at`, `paid_at`, confirmed via status, reminder flags, `completed_at`). Session Started/Ended are marked `(pending)` — no backend timestamps yet.

## State-driven Actions (placeholders kept visible + active-styled)
- **Upcoming:** Reschedule*, Cancel Booking, Message Customer*, Message Vendor*
- **Live:** Join Meeting, Message Customer*, Message Vendor*
- **Completed:** Issue Refund*, Open Dispute*
- **Cancelled:** Rebook*, Refund*
- **Disputed:** Refund Customer*, Release Vendor Payment*, Partial Refund*, Close Dispute*
- **Admin Actions:** Force Cancel, Force Refund*, Edit Booking, Change Vendor*, Regenerate Meeting Link*, Add Internal Note*, Delete Permanently

`*` = not yet implemented → wired to `notImplemented()` (toast "coming soon") with a TODO.
**Real, preserved functionality:** status change + payment change (Edit modal), Cancel,
Delete, and Join/Meet link. Nothing was removed.

## Design notes
- Tailwind tokens only: brand `#FE5100` (`primary`), global 4px radius scale, Poppins.
- Icons are inline SVG (1.75 stroke) — no emoji.
- Mobile-first: cards stack, modal is a bottom sheet on small screens; tabs scroll horizontally; touch targets ≥ 32–44px.
- Skeleton loading rows; empty states per tab; accessible labels on icon-only buttons.
