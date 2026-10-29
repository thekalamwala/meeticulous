# GST Invoicing & Billing-Details Layer — Design

**Date:** 2026-07-06
**Branch:** `feat/gst-invoicing`
**Status:** Approved design → implementation plan next

## Problem

Today, both purchase flows jump straight to Razorpay with only name/email/contact.
Meeticulous (legal entity **Timewheel Internet Pvt. Ltd.**) needs to (a) collect the
buyer's billing details before charging and (b) issue a compliant **GST tax invoice**
for its own taxable supply.

Two flows in scope for v1:
- **Host subscriptions** — plan upgrades (`UpgradePlan.jsx` → `paymentController.createVendorSubscription`). Taxable supply = subscription price. Hosts want the invoice to claim input-tax-credit.
- **Guest bookings** — each paid booking (`ServiceBooking.jsx` → `paymentController.createOrder/verifyPayment`). Taxable supply = the **platform fee only** (₹10 + GST), NOT the host's service value.

Out of scope (YAGNI, add later): digital-product invoices, e-invoicing IRN/QR, credit notes for refunds, amount-in-words.

## Legal frame

Meeticulous is an e-commerce operator. It tax-invoices **only its own revenue**:
- Subscription: the whole plan price is BAS's SaaS supply → invoice full plan price.
- Booking: only the platform fee is BAS's supply → invoice the fee, not the service.

The host's service value is the host's own supply (host invoices the guest separately if registered). BAS does not invoice it. This keeps BAS clear of deemed-supplier/aggregator liability.

## Seller identity (fixed)

| Field | Value |
|---|---|
| Legal name | Timewheel Internet Pvt. Ltd. |
| CIN | U62012OD2026PTC052654 |
| GSTIN | 21AAMCT8270C1ZF |
| PAN | AAMCT8270C |
| State | Odisha (code **21**) |
| Address | C/O Balbir Singh, Natapada, Vyasanagar, Jajpur, Odisha 755019 |
| Email / Phone | team@timewheel.co.in · +91 8637758344 |
| SAC code | subscriptions → SaaS/hosting; platform fee → online-platform facilitation. Exact codes (e.g. 998315 / 998599) to be confirmed with the CA before go-live; stored as two constants in `sellerIdentity.js` so they're one-line editable |

Stored as a **server config module** `server/config/sellerIdentity.js` — hardcoded values above with `process.env` overrides (mirrors the `razorpayConfig.js` env-fallback pattern). No admin UI in v1: this is one company's fixed legal identity that changes ~never.
`// ponytail: config module, promote to admin-editable DB row only if they need to change GSTIN/address without a deploy`

## Architecture — 6 pieces

### 1. `invoices` table (new) — the immutable legal record

```
id            uuid pk default gen_random_uuid()
invoice_number text unique not null      -- 'BAS/25-26/00123'
fiscal_year   text not null              -- '25-26' (Indian FY, Apr–Mar)
serial        int  not null              -- 123, for gap detection
source_type   text not null              -- 'subscription' | 'booking'
source_id     uuid not null
payment_id    text                       -- razorpay payment id
buyer_name    text not null
buyer_address text
buyer_state   text
buyer_state_code text
buyer_gstin   text
buyer_pan     text
seller_snapshot jsonb not null           -- freeze seller identity at issue
taxable_value numeric not null           -- pre-tax
cgst          numeric not null default 0
sgst          numeric not null default 0
igst          numeric not null default 0
total         numeric not null           -- taxable + tax (== amount already charged)
place_of_supply  text
sac_code      text
issued_at     timestamptz not null default now()
created_at    timestamptz not null default now()
unique (source_type, source_id)          -- one invoice per payment (idempotency)
```

`seller_snapshot` is frozen at issue so a later address/GSTIN change never mutates old invoices (legal immutability).
`unique(source_type, source_id)` prevents double-invoicing when verify + webhook both fire.

### 2. `invoice_counters` table (new) — atomic gap-free serial

```
fiscal_year text primary key
last_serial int not null default 0
```

Serial allocation and invoice insert happen in **one transaction**: bump counter → insert invoice. On unique-violation the whole txn rolls back (counter bump included) → no gaps, no duplicates. This is the money/legal path; it gets a runnable test (below).

Number format: `BAS/25-26/00123` — prefix + FY + 5-digit zero-padded serial = 15 chars (GST cap is 16, allows `/` and `-`). FY computed from `issued_at`: month ≥ April → `YY-(YY+1)`.

### 3. `invoiceService.js` (new) — shared generator

`server/services/invoiceService.js`:
- `fiscalYearFor(date)` → `'25-26'`
- `computeTaxSplit(taxableValue, gstRate, buyerStateCode, sellerStateCode='21')` → `{cgst, sgst, igst}`.
  Intra-state (buyer code == 21) → cgst = sgst = taxable × gstRate/2. Inter-state → igst = taxable × gstRate. Total tax identical either way; only the split (labels) differ, so **no amount changes vs what was charged**.
- `placeOfSupplyFor(buyerGstin, buyerStateCode)` → registered buyer's state = first 2 digits of GSTIN; else selected state; else seller state.
- `generateInvoice({source_type, source_id, payment_id, buyer, taxableValue, gstAmount, sacCode})` → idempotent: returns existing row for `(source_type, source_id)` if present, else txn { bump counter, insert }. Returns the invoice record.

Taxable value / gst come straight from the already-snapshotted numbers:
- Subscription: `taxable = plan_price`, `gst = gst_amount` (from `subscription_payments`).
- Booking: `taxable = platform_fee_amount`, `gst = platform_fee_gst` (from `bookings`).

We only **re-split** that existing GST into CGST+SGST vs IGST by place of supply. Pricing and the amount charged are untouched.

### 4. Billing-details capture (before Razorpay)

New buyer fields, all validated at the trust boundary:
- Legal / business name (defaults to profile/guest name)
- Billing address
- State (select; drives intra/inter-state)
- GSTIN (optional; regex `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`. If present, its first 2 digits set the state — hide the manual state select)
- PAN (optional)

**Subscriptions** (`UpgradePlan.jsx`): insert a billing step/modal before `handleUpgrade` opens Razorpay. Persist to `profiles.billing_details` (jsonb) so repeat upgrades prefill, and pass into `/subscription/create` so the invoice can read it.

**Bookings** (`ServiceBooking.jsx` Details step): a collapsed **"Need a GST invoice?"** toggle reveals business name / GSTIN / address (most guests skip it). Billing name defaults to guest name. Snapshot into new `bookings.billing_details` (jsonb) at booking creation.

New columns: `profiles.billing_details jsonb`, `bookings.billing_details jsonb`. Keep code-side SELECT/INSERT fallback until the migration is confirmed on both DBs.

### 5. Generation triggers

- **Subscription:** after payment is recorded — in `verifySubscription` (one-time annual) **and** webhook `subscription.charged` (auto-renew) — call `generateInvoice({source_type:'subscription', ...})`. Each renewal charge gets its own invoice. Idempotent per payment.
- **Booking:** in `verifyPayment`, after `finalizeBookingCapture`, call `generateInvoice({source_type:'booking', ...})`.

Generation is best-effort/non-blocking relative to the payment response (like the existing email/analytics background tasks) but must be retry-safe (it is: idempotent, no charge).

### 6. Render + deliver

- Extend `client/src/utils/receipt.js` to render a **"Tax Invoice"** variant when invoice data is present: seller block (name/GSTIN/PAN/address), buyer block (name/GSTIN/address), invoice number + date, place of supply, taxable value, CGST/SGST **or** IGST lines, SAC code, total.
- New `GET /api/invoices/:id` (auth: buyer owns the source booking/subscription) → invoice JSON → client renders + "Save as PDF"/print. `// ponytail: browser print-to-PDF, add server-side PDF (puppeteer) only if buyers demand a real attachment`
- "Download Invoice" button on the booking confirmation screen and in the host dashboard transactions list.
- Confirmation email gets a "Download your GST invoice" link (link, not PDF attachment, in v1).

## Data flow (subscription example)

```
UpgradePlan → billing form (name/address/state/GSTIN?) → persist profiles.billing_details
  → POST /subscription/create (billing passed) → Razorpay subscription opens
  → payment success (verify or webhook subscription.charged)
      → record subscription_payment (existing)
      → generateInvoice({subscription, plan_price, gst_amount, buyer})   [idempotent, txn]
      → email link + dashboard download
```

## Correctness / edge cases

- **No payment → no invoice**: free plans, ₹0 bookings skipped.
- **GSTIN ↔ state mismatch**: if GSTIN given, its state code wins; manual state select is hidden. Reject a GSTIN whose checksum/format fails regex.
- **Idempotency + gap-free serial**: existence check → single txn (bump counter + insert) → rollback-together on conflict. Retry returns the existing invoice.
- **Refunds**: no credit note in v1 (documented gap).
- **Total invariant**: invoice `total` == `taxable_value + cgst + sgst + igst`. For a booking this equals `platform_fee_amount + platform_fee_gst` (a **portion** of `customer_total`, since the service value is the host's supply, not BAS's); for a subscription it equals `total_charged`. Asserted in the generator.

## Migrations (both DBs)

One new migration file **`v3.67_gst_invoicing.sql`** (latest is v3.66): create `invoices`, `invoice_counters`; add `profiles.billing_details`, `bookings.billing_details`. Per CLAUDE.md: run in Supabase SQL editor on **prod (Mumbai)** and **staging (Tokyo)**, keep code-side destructure fallback until confirmed applied everywhere.

## Testing

- **Server (jest, `server/tests/`)**: `invoiceService` — tax split intra vs inter-state; FY boundary (Mar 31 vs Apr 1); serial format; **idempotent double-generate yields one invoice, no serial gap**; total == taxable + tax.
- **Client (vitest, `.getAttribute()` assertions — no jest-dom)**: billing form GSTIN regex accept/reject; state auto-derived from GSTIN.
- Finish gate (CLAUDE.md): `server npm test`, `client npm run build`.

## Files touched

**New:** `server/config/sellerIdentity.js`, `server/services/invoiceService.js`, `server/routes` + controller for `GET /api/invoices/:id`, migration SQL, tests.
**Edited:** `client/src/pages/UpgradePlan.jsx`, `client/src/pages/ServiceBooking.jsx`, `client/src/utils/receipt.js`, `server/controllers/paymentController.js` (verifyPayment, verifySubscription, webhook), booking creation (store `billing_details`), confirmation email template.
