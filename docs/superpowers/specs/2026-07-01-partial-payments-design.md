# Partial Payments (Offline Deposits) — Canonical Specification

_Date: 2026-07-01 · Q1 "Prove value" item #2 (Deposits & prepay)_

> **Status: canonical design.** Single source of truth for the offline partial-payment
> feature. Any change to the money model, status model, or a rule below is a change to
> behaviour and must be made here first. The implementation follows this document.

## Problem

Offline services (turfs, studios, salons, clinics, workshops) often can't ask a guest to
prepay 100% — the norm is a deposit online + the rest paid in person. Today Meeticulous
charges the **full** `customer_total` at booking for every paid service (`createOrder`), so an
offline host who wants "deposit now, balance at the venue" has no option and either takes the
full amount (friction) or lists the service free (no commitment → no-shows). Online services do
not have this problem — the whole transaction is digital.

## Decision summary (locked with founder 2026-07-01)

- **Offline services only.** Online services stay 100% prepaid, unchanged. Free (₹0) services
  are never partial.
- **Per-service host toggle:** Full payment (default) or Accept partial payment. If partial,
  host sets a **deposit percentage between 50 and 99** (never below 50).
- **Guest pays the deposit online** (deposit + platform fee + GST) via Razorpay at booking.
  The **balance is collected offline by the host in person.** BAS never auto-charges it.
- **BAS bills only what it processes** (the deposit). Platform fee + commission apply to the
  **deposit only**. The offline balance is entirely the vendor's business — BAS shows the
  amount for information but does **not** track collection or report on it.
- **Payment status is unchanged** (`payment_status='paid'` once the deposit clears). Partial
  bookings are described by new columns, not a new status.
- **Out of scope (v1):** refunds, refundable deposits, cancellation-policy engine, automatic
  balance collection, balance reminders, balance-collection tracking, deposit holds for free
  services.

## Key architectural insight (minimal blast radius)

`createOrder` charges the booking's immutable `customer_total` snapshot, and
`pricingEngine.computeBreakdown({ servicePrice, ... })` derives every downstream figure from a
`servicePrice` input. So a partial booking is modelled by snapshotting the **deposit amount as
the `servicePrice`** at booking creation. The entire existing pipeline — Razorpay charge,
commission, GST, vendor payout, settlement — then operates on the deposit with **no change**.
The only new logic is: (1) computing the deposit at snapshot time, (2) storing the split for
display. Full/online bookings set `depositPortion = P` and are byte-for-byte unchanged.

---

## Data model

### `services` (new columns)

| Column | Type | Notes |
|---|---|---|
| `accept_partial` | boolean, default `false` | Only meaningful when `meeting_mode='offline'`. |
| `deposit_percentage` | integer, nullable, CHECK `50–99` | Required when `accept_partial=true`; NULL otherwise. |

### `bookings` (new columns)

| Column | Type | Notes |
|---|---|---|
| `payment_type` | text, default `'full'` CHECK `in ('full','partial')` | Snapshot at booking creation. |
| `deposit_amount` | numeric(12,2), default `0` | The service-value portion collected online (= `servicePrice` fed to `computeBreakdown`). |
| `balance_due` | numeric(12,2), default `0` | Offline balance the host collects in person (`0` for full bookings). |
| `service_value_snapshot` | numeric(12,2), nullable | **Immutable** final service value `P` at booking time (post any discounts; = `service.price` today). **Analytics/reporting/exports/history only.** Populated for every booking; `= deposit_amount + balance_due`. MUST NEVER enter any money calculation (see Accounting vs Analytics). |

No `payment_status` enum change. No `balance_collected` column (BAS does not track collection).

## Calculation order (canonical)

All **service-level price adjustments** (coupons, discounts, promotions) are applied **first**,
producing the **final service value** `P`. The deposit and balance are **always** computed from
`P` (the final, post-adjustment value), never from the pre-discount list price. This guarantees
the invariant **`deposit_amount + balance_due = P`** for every booking, and
`service_value_snapshot = P`.

> **v1 note:** no coupon/discount/promotion mechanism exists in the codebase today, so
> `P = service.price`. This rule is the ordering contract a future discount feature must slot
> into: adjust the service value → then split into deposit + balance. If a future feature also
> needs the pre-discount list price / discount amount for analytics, that is an additive column
> then — not v1.

## Money model

Let `P` = the **final service value** (post-adjustment; today `= service.price`).
`pct` = `deposit_percentage`.

- **Full / online / offline-full booking:** `depositPortion = P`, `balance_due = 0`,
  `payment_type = 'full'`. Identical to current behaviour.
- **Offline + `accept_partial` booking:**
  - `depositPortion = round(P × pct / 100)` (nearest rupee, 2-dp).
  - `balance_due = P − depositPortion` (so `depositPortion + balance_due = P` exactly).
  - `payment_type = 'partial'`, `deposit_amount = depositPortion`.
- **Every booking (partial and full)** stores `service_value_snapshot = P` — analytics-only,
  never read by any calculation below.
- Feed `depositPortion` into the existing engine:
  `computeBreakdown({ servicePrice: depositPortion, commissionPercentage: pct_plan, platformFee: ₹10, gstRate: 0.18 })` →
  - `customer_total = depositPortion + platform_fee + gst_on_fee` (what the guest pays online).
  - `commission = plan_commission% × depositPortion` (host-borne; **deposit base**).
  - `vendor_amount = depositPortion − commission − commission_gst − razorpay_fee` (from the deposit).
- **Platform fee** is the existing flat ₹10 (admin-configurable), charged **once** on the
  deposit transaction, with 18% GST on the fee. Not scaled to deposit size. The guest pays
  fee + GST **once** (never on the offline balance).
- The offline `balance_due` never enters `customer_total`, commission, GST, `vendor_amount`,
  settlement, or the ledger. It is display-only.

**Worked example:** offline service ₹1000, 60% deposit, Studio host (0% commission).
`depositPortion = 600`, `balance_due = 400`. Online: `customer_total = 600 + 10 + 1.80 = 611.80`
(guest pays now); `vendor_amount = 600 − 0 − 0 − razorpay_fee`. Guest pays ₹400 to the host in
person. BAS books reflect ₹600 processed. `service_value_snapshot = 1000` is stored for
analytics but is **not** part of any figure above.

## Accounting vs Analytics (permanent architectural rule)

Two intentionally different concepts. They must never be mixed:

- **Financial records** (accounting) always represent **money actually processed by BAS** —
  `customer_total`, `deposit_amount`, `vendor_amount`, commission, GST, settlements, payouts,
  and every ledger/journal entry. For a partial booking this is the **deposit**, never the full
  service price.
- **Analytics** may represent **the total value of booked services** — the sum of
  `service_value_snapshot`. This can exceed processed value (it includes offline balances BAS
  never touched).

**Rule:** `service_value_snapshot` (and the offline `balance_due`) are analytics-only. No
accounting, Razorpay, settlement, payout, or ledger path may read them. Any code that computes
money reads the processed figures; any code that reports "value booked" reads the snapshot.

## Reporting metrics (definitions)

Define two distinct metrics — do not collapse them into one ambiguous "GMV":

- **Processed Value** — total online payments BAS processed (sum of `customer_total`, or of
  `deposit_amount` for service-value processed). This is what accounting uses.
- **Service Value** — total booked service value (sum of `service_value_snapshot`). Business
  analytics may use this to show demand/booked volume including offline balances.

These are **definitions for correctness**, not new dashboards. **v1 only populates
`service_value_snapshot`** so the Service Value metric is *possible later*; it does not build a
Service-Value report or alter the existing #7 insights dashboard (which stays Processed-Value
based). Wiring Service Value into a dashboard is future work, explicitly out of this build.

## Immutable booking snapshot (permanent rule)

At creation, a booking **permanently snapshots** all of: `service_value_snapshot` (full price),
`deposit_amount`, `balance_due`, `payment_type`, and the full pricing breakdown
(`customer_total`, `platform_fee_amount`, `platform_fee_gst`, `commission_applied`,
`commission_gst`, `commission_percentage`, `gst_rate`, `vendor_amount`). Later edits to the
service (price, `deposit_percentage`, `accept_partial`, meeting mode, plan, platform fee) MUST
NEVER retroactively alter an existing booking. Every booking is a self-contained financial
record of the moment it was made.

## Service-setup UX (`client/src/pages/services/ServiceForm.jsx`)

- The Payment section renders **only when the service type is Offline** (`meeting_mode==='offline'`).
- Control: radio **Full payment** (default) / **Accept partial payment**. When "Accept partial"
  is selected, reveal a deposit-percentage input (integer 50–99, inline-validated; default e.g.
  50). Helper copy: "Guest pays this % online; you collect the rest in person."
- Switching the service to Online hides + clears the partial setting (sends `accept_partial=false`).
- The two fields flow through **both** service write backends (`serviceController` `/services`
  and `hostController` `/host/services`), create + update, added to their column whitelists
  (the project's dual-write pattern). Server validation: `accept_partial=true` is honoured only
  when `meeting_mode='offline'` (else coerced to `false` + `deposit_percentage=NULL`);
  `deposit_percentage` must be an integer 50–99 when `accept_partial` — else `400`.

## Customer booking + checkout flow

1. Public service page / `ServiceBooking`: `svcGetPublicByProfile` + service-detail reads
   return `accept_partial` + `deposit_percentage`. When offline+partial, the booking UI shows a
   deposit summary before payment.
2. `bookingController.createBooking` computes the deposit snapshot (money model above), stores
   `payment_type`, `deposit_amount`, `balance_due`, and the standard breakdown columns
   (`customer_total`, `vendor_amount`, `platform_fee_amount`, `platform_fee_gst`,
   `commission_applied`, `commission_gst`, etc.) with the existing schema-fallback (drops the
   new columns gracefully until the migration is applied).
3. Checkout (`ServiceBooking`) line items for a partial booking:
   `Deposit (pct% of ₹P) ₹depositPortion · Platform fee ₹10 · GST ₹x` → **Pay now ₹customer_total**,
   plus a distinct line: **"Balance ₹balance_due — pay {host} in person."**
4. `createOrder` charges `customer_total` — **unchanged** (reads the snapshot).
5. Confirmation step + email/receipt show "Deposit paid ₹depositPortion" and
   "Balance due in person ₹balance_due".

## Booking / payment statuses

- `payment_status`: `unpaid → paid` when the deposit payment is verified — same as today. A
  partial booking is `paid` (BAS's transaction is complete) with `payment_type='partial'`.
- Booking `status` lifecycle (`pending → confirmed → completed | no_show | cancelled`) is
  unchanged. A partial booking confirms on deposit payment exactly like a full one.
- Existing `payment_status='paid'` filters (host earnings, transactions, settlement,
  `autoCompleteBookings`) keep working with **no change**, because partial bookings are `paid`.

## Dashboard & reporting (display-only)

- **Host** booking list/detail: a "Partial" badge + info line "Deposit ₹deposit_amount paid ·
  **₹balance_due to collect in person**". No toggle, no collected/outstanding state, no summary
  report — BAS does not track balance collection.
- **Host Earnings / Settlements / Transactions / Payouts** reflect **only money processed
  through BAS** (the deposit's `vendor_amount`), exactly as today. The offline `balance_due` is
  **informational only** and is NEVER counted as BAS revenue, earnings, payout, or settlement.
  Where a balance is shown near these surfaces, it must be visibly labelled as an offline amount
  the host collects directly — not part of BAS figures.
- **Guest** `/user/my-bookings` + receipt: show deposit paid + "₹balance_due payable to the
  host in person".

## Customer communication copy (consistency rule)

Every customer-facing touchpoint for a partial booking — checkout, confirmation step,
confirmation email, receipt, guest bookings page — uses consistent, unambiguous wording:

- **"Deposit Paid"** for the online amount (`deposit_amount`).
- **"Balance Due"** for `balance_due`.
- **"Pay the remaining balance to the host in person."**

Never use wording that implies the booking is fully paid when only a deposit was collected
(e.g. avoid a bare "Paid ✓" / "Payment complete" on a partial booking without the balance
context). Full bookings keep their existing copy unchanged.

## API + DB changes

- **Migration** (`vX_partial_payments.sql`, applied manually both DBs): `services +=
  accept_partial, deposit_percentage`; `bookings += payment_type, deposit_amount, balance_due,
  service_value_snapshot`. Additive; existing rows default to `payment_type='full'`,
  `balance_due=0` (`service_value_snapshot` stays NULL for pre-feature rows — acceptable, it is
  analytics-only and backfill is optional).
- `serviceController` + `hostController`: validate + persist the two service fields (offline
  gate, 50–99), add to SELECT/write whitelists; public service reads expose them.
- `bookingController.createBooking`: deposit snapshot + new columns (schema-fallback).
- `pricingEngine`: **no change** (deposit is passed as `servicePrice`). A small pure helper
  `computeDeposit(price, pct)` returning `{ depositPortion, balanceDue }` (rounding contract)
  lives in `pricingEngine` or `bookingController` and is unit-tested.
- **No new booking endpoint** (balance tracking dropped). `createOrder` / `verifyPayment`
  unchanged.
- Client: `ServiceForm`, `ServiceBooking` (checkout + confirmation), host booking list/detail,
  guest `/user/my-bookings`, receipt/email template.

## Edge cases

| Case | Handling |
|---|---|
| Online service with `accept_partial` set | Server coerces to full (partial is offline-only); no deposit split. |
| Free (₹0) service | `accept_partial` ignored; `depositPortion=0` path never taken; treated as full/free as today. |
| `deposit_percentage` outside 50–99 (or non-integer) | `400` on service save; booking never sees an invalid pct. |
| `accept_partial=true` but `deposit_percentage` NULL | Rejected at service save (`400`). |
| Host flips full↔partial after bookings exist | Existing bookings keep their immutable snapshot; only new bookings use the new setting. |
| Rounding | `depositPortion = round(P×pct/100)`, `balance_due = P − depositPortion` → always sum to P; no ₹0.01 drift. |
| Deposit rounds to ≥ P (e.g. pct=99 on ₹1) | `balance_due` clamped to `≥ 0`; if `balance_due=0` the booking behaves as full (no "pay in person" line). |
| No-show on a partial booking | Host keeps the deposit (already paid; v3.45 settlement-favourable). Balance simply uncollected — BAS does nothing. |
| Reschedule of a partial booking | Snapshot (`deposit_amount`/`balance_due`/`payment_type`) preserved. |
| Cancellation | No refund (out of scope) — deposit non-refundable, consistent with current no-refund behaviour. |
| Legacy/online bookings | `payment_type='full'`, `balance_due=0` by default — no behaviour change. |

## Future extensibility (no overbuild)

`deposit_amount` / `balance_due` / `payment_type` / `service_value_snapshot` generalize to
future models (online partial, installments, balance auto-charge, Service-Value analytics)
without a schema change — but none of those are built now.

**v1 is intentionally small. Explicitly NOT in scope:**
- Offline services only (no online partial payments).
- No balance tracking / no balance-collection state.
- No cash reconciliation.
- No reminders for the remaining balance.
- No refund engine / no refundable deposits.
- No cancellation-policy engine.
- No installment support.
- No deposit holds for free services.
- No new Service-Value dashboard (the metric is defined + the column populated; surfacing it is future).

Goal: minimal implementation complexity, minimal blast radius, accurate financial records,
future-proof analytics.

## Files touched (indicative; pinned in the plan)

- New: `server/migrations/vX_partial_payments.sql`.
- Modify: `server/lib/pricingEngine.js` (add `computeDeposit`), `server/controllers/bookingController.js`
  (deposit snapshot), `server/controllers/serviceController.js` + `server/controllers/hostController.js`
  (validate/persist/expose service fields).
- Client: `client/src/pages/services/ServiceForm.jsx`, `client/src/pages/ServiceBooking.jsx`,
  host booking list/detail components, guest bookings page, receipt/email template.
- Tests: `computeDeposit` rounding; booking snapshot (partial vs full vs online); **`service_value_snapshot = P`
  written for every booking AND `customer_total`/`vendor_amount`/commission are independent of it**
  (accounting-vs-analytics separation); service-field validation (offline gate, 50–99); checkout
  render; edge cases; **invariant `deposit_amount + balance_due == service_value_snapshot` holds for
  partial, full, and online bookings**.

## Deploy notes

- Apply the migration on both prod (Mumbai) + staging (Tokyo); keep the code-side schema
  fallback until confirmed on both.
- No notification-template change is strictly required for v1, but the booking-confirmation /
  receipt copy should mention the balance-due line (email template update, seeded both DBs).
