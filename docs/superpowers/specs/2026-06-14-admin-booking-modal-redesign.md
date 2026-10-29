# Admin Booking Detail Modal — Redesign Spec

**Date:** 2026-06-14
**Status:** Approved design (pending user review)
**Scope:** Frontend only. Single file: `client/src/pages/admin/AdminBookings.jsx` (`BookingDetailModal` + helpers). No DB migration, no API change, no new npm dependencies.

---

## 1. Goal

Refine the existing 3-column admin booking detail modal so an operator instantly understands:

1. **"How much did the vendor net from this booking?"** — a prominent earnings card.
2. The booking's **live operational state** (Upcoming → Live → Completed) without anyone clicking anything.
3. Customer vs Vendor at a glance, financial split, meeting access, and the action set — with the clutter removed.

This is a UX / layout / information-hierarchy pass. All data comes from fields already returned by `GET /admin/bookings`; all mutations reuse existing `adminUpdateBooking` / `adminDeleteBooking`.

## 2. Non-goals

- No backend status-automation cron. Live state is **client-derived** via the existing `deriveState()` — zero DB writes, zero revenue/payout side effects.
- No admin reschedule (current reschedule API is vendor-owner-only; out of scope).
- No dispute backend (no table/column exists). "Open Dispute" stays a `notImplemented()` stub.
- No real Google Maps integration (vendor profile has no location field yet). Placeholder only.
- Does not touch the unmerged paid-only visibility work (PR #4) or any server file.

## 3. Preserved structure

Keep the existing modal shell: sticky header · left aside · center tabbed `main` · right aside; collapses to single vertical scroll below `lg`. Keep the tab set: **Overview · Timeline · Meeting · Financials · Logs**. Keep keyboard handling (ESC stack, focus trap, Cmd/Ctrl+C copies booking ID), body-scroll lock, and the Danger-Zone confirm dialogs.

## 4. Changes by region

### 4.1 Header (slim)
Reduce the header center block to: **Service name · Date · Time · Duration · Booking ID** + the State pill. Keep back/copy on the left and the ⋯ menu + close on the right. The ⋯ menu retains Edit Booking, Copy Booking ID, Copy Meeting Link, View Vendor Profile. Remove the redundant price/IST sub-line clutter (price now lives in the earnings card and snapshot).

### 4.2 Left column — Earnings card + actions
Replace the current snapshot aside content with:

**A. "Net Earnings From This Booking" card** (full-width, the visual anchor). Itemized, top-to-bottom, all from existing booking fields:

| Line | Source field | Sign |
|---|---|---|
| Booking Amount | `customer_total` ?? `services.price` | + |
| Razorpay Fees | `razorpay_fee_actual` | − |
| Platform Commission | `commission_applied` | − |
| GST on Commission | `commission_gst` | − |
| Platform Fee | `platform_fee_amount` | − |
| **Final Net Earnings** | `vendor_amount` | **=** (large, bold) |

- Render `—` for any null field; never show `NaN`/`₹0` from missing data.
- Keep the existing snapshot essentials (date, time range, duration, timezone, booking ID, payment pill, payout pill) below or beside the earnings card in condensed form.

**B. Action buttons** (directly below the earnings card), 4 buttons:
- **Edit Booking** → opens existing `EditModal` (status + payment_status).
- **Mark Completed** → `adminUpdateBooking(id, { status: 'completed' })`. Shown only when derived state is `live` or the slot end has passed and status is not already completed/cancelled. (Reuses current admin status-set behavior; no revenue-recognition side effect — identical to setting status via Edit today.)
- **Cancel Booking** → opens the existing cancel confirm dialog → `handleCancel` (`status: 'cancelled'`). Hidden when already cancelled/completed.
- **Open Dispute** → `notImplemented('Open Dispute')` stub.

### 4.3 Right column — de-dupe
Remove the **General** PanelGroup (its actions moved left). Keep **Financial** (Issue/Force Refund stubs), **Meeting** (Regenerate stub + Open Meeting). In **Danger Zone**, remove **Force Cancel** (Cancel now lives in the left action group — eliminates the duplicate per brief); keep **Delete Permanently** with its type-to-confirm dialog.

### 4.4 Overview tab — Customer ↔ Vendor comparison
Render the two contact cards as a side-by-side grid (`grid-cols-1 md:grid-cols-2`):
- **Left = Customer**: blue accent (icon tint + header rule/ring in blue). Existing fields: name, email (mail/copy), phone (call/copy).
- **Right = Vendor**: crimson/pink accent. Existing fields: name, email, view-profile; phone stays `—` (not selected by the list endpoint — unchanged).
Keep the existing **Booking Information** card below, unchanged.

### 4.5 Timeline tab — fix "not updating"
Root cause: nothing auto-updates persisted status, and the current lifecycle shows fake "Session Started/Ended (pending)" rows that read as broken.
Fix (presentational, client-derived):
- Drive the headline state from `deriveState(b)` (already time-aware) so it reflects Upcoming/Live/Completed live on open.
- Rebuild `lifecycle(b)` to **real timestamps only**: Booking Created (`created_at`) → Payment Received (`paid_at` / `payment_status==='paid'`) → Vendor Confirmed (status in confirmed/completed) → Completed (`completed_at` / derived completed) — plus a Cancelled node when `status==='cancelled'`. Drop the two `pending: true` session rows.
- Keep the horizontal (md+) / vertical (mobile) rendering.

### 4.6 Meeting tab — simplify + Maps placeholder
- Meeting card occupies ~50% width on `lg` (left); the Google Maps placeholder sits beside it.
- One **primary action: Join Meeting** (when `meeting_link` exists). Secondary actions (Copy Link, Regenerate Meeting Link) collapse into a compact "⋯ / More" dropdown — not a row of equal buttons.
- Empty state unchanged when no link.
- **Google Maps placeholder card** (always inactive): map-pin icon, muted "Vendor location — coming soon. Once vendors add a business address to their profile, an Open in Google Maps button appears here." A disabled "Open in Google Maps" button. No network calls, no API key.

### 4.7 Financials tab — pie + summary
- Keep **Payment Summary** card (left).
- Add a **dependency-free SVG donut/pie** (right or below). Segments from existing fields, only those `> 0`:
  - Vendor Earnings (`vendor_amount`)
  - Platform Commission (`commission_applied`)
  - Razorpay Fees (`razorpay_fee_actual`)
  - GST (`commission_gst` + `platform_fee_gst`)
  - Taxes (`razorpay_tax_actual`)
- Legend with label, ₹ amount, and %. Reuse the existing color palette (emerald / `#FE5100` / amber / etc.). If sum is 0, show the existing "Breakdown unavailable" message.
- **Replace** the existing horizontal `BreakdownBar` with the pie (no two redundant visualizations); the pie's legend carries the per-segment amounts the bar used to show.

## 5. Components / boundaries

New small, self-contained presentational pieces inside `AdminBookings.jsx` (matching the file's existing atom style):
- `EarningsCard({ b })` — itemized net-earnings breakdown.
- `PieChart({ segments })` — pure-SVG donut + legend (stroke-dasharray arcs or conic via SVG paths).
- `MapsPlaceholder()` — static inactive card.
- Restyle `ContactCard` to accept an `accent` prop (`blue` | `crimson`).
- Adjust `lifecycle()` and the left/right `aside` contents; relocate the General actions.

Each is render-only, fed by the already-fetched booking object — no new data dependencies.

## 6. Data availability (verified)

All earnings/financial fields exist on the booking row from `GET /admin/bookings`: `customer_total`, `services.price`, `razorpay_fee_actual`, `commission_applied`, `commission_gst`, `platform_fee_amount`, `platform_fee_gst`, `razorpay_tax_actual`, `vendor_amount`, `paid_at`, `completed_at`, `settled_at`, `payment_status`, `status`, `scheduled_at`, `services.duration`. Pre-capture, `razorpay_fee_actual`/`razorpay_tax_actual` may be 0 — render gracefully.

## 7. Engineering requirements / verification

- **Responsive:** verify `sm` (mobile sheet), `md`, and `lg` (3-column) breakpoints; left/right asides stack correctly below `lg`; Meeting 50% only applies at `lg`.
- **Access control:** unchanged — modal lives under already-gated admin routes; no new endpoints. Confirm no vendor-only field is newly exposed (it's admin view).
- **Status automation / timezone:** document that no cron is added; `deriveState` compares absolute epoch (tz-safe); display stays Asia/Kolkata.
- **Payment states:** render paid / unpaid / refunded pills and null-field fallbacks without errors.
- **Regression:** `cd client && npm run build` must pass; `npm test` (Vitest) green. Add light unit tests for the pure helpers (earnings line math, pie segment filtering, `deriveState` boundaries) if a test harness fits the file.
- **No breaking changes:** existing list/search/tabs/edit/delete/cancel flows must behave exactly as before.

## 8. Open contradiction (flagged)

Target was confirmed as the **Admin** modal, but the earnings card and action set are vendor-first-person. Reconciliation used here: **admin viewing a booking**, where the earnings card surfaces *that vendor's* net earnings for oversight, and the actions operate on the booking on the vendor's behalf. If the real intent was the vendor's own `client/src/pages/Bookings.jsx` modal, this spec must be re-scoped before implementation.
