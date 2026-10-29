# Product Purchase → Financial Ledger (PRODUCT_PAYMENT)

_2026-06-25 · builds on Financial Ledger P1 (`sd/adoring-elgamal-625af7`)_

## Problem
Paid digital-product checkout charged `price + platform_fee` and recorded a
`product_purchases` row, but **never posted a double-entry journal entry**.
Bookings (`ORDER_PAYMENT`) and subscriptions (`SUBSCRIPTION_PAYMENT`) post;
products were the gap, so Razorpay Receivable, Vendor Payables and Platform Fee
Revenue were understated for every product sale.

## Money model (decided)
Customer pays `price + platform_fee`. Products carry **no commission** and the
checkout charges **no GST**, so those legs are absent. The Razorpay gateway fee
is **vendor-borne** (mirrors `orderPaymentEntry` for bookings): vendor payout =
`price − gateway`; platform keeps the full `platform_fee`.

Ledger legs (vendor-borne gateway, expense nets to 0):

| Account | Dr | Cr |
|---|---|---|
| 1100 Razorpay Receivable | customer_total | gateway |
| 2000 Vendor Payables | | price − gateway |
| 4000 Platform Fee Revenue | | platform_fee |
| 5000 Razorpay Charges (Orders) | gateway | gateway |

Net: Receivable = net remittance; 5000 nets 0 (vendor bears it); balanced.
Free products (price 0) move no money → **no entry**.

## Components
- **`journalTemplates.productPaymentEntry(snapshot)`** — pure builder. Omits the
  platform-fee leg when fee is 0 and the gateway legs when fee is 0;
  `customer_total`/`vendor_amount` derive from `price`/`platform_fee`/gateway
  when absent (heals pre-migration rows).
- **`materializeProductPurchase`** (paymentController) — single choke point for
  both `verify-product` and the webhook safety-net. Fetches the actual gateway
  fee (`payments.fetch`, fee incl. tax, best-effort → 0 on failure), stores the
  money snapshot, then `postSafe('PRODUCT_PAYMENT', purchase.id, …)`. Idempotent
  on `(source_type, source_id)`; a ledger miss never fails the captured payment.
- **`ledgerReconciler`** — new scan: paid `product_purchases` with
  `amount_paid > 0` and no `PRODUCT_PAYMENT` entry get reposted. Wrapped in its
  own try/catch so a pre-migration DB can't abort the booking/subscription heal.
- **Migration `v3.37`** — adds `PRODUCT_PAYMENT` to the
  `journal_entries_source_type_check` CHECK; adds
  `customer_total, vendor_amount, razorpay_fee_actual, razorpay_tax_actual`
  to `product_purchases` (additive; server has a schema fallback).

## Data flow
`verify-product`/webhook → `materializeProductPurchase` → fee fetch → insert
snapshot → `postSafe` → `post_journal_entry` RPC (atomic, balanced, idempotent).
Hourly reconciler backstops any miss.

## Testing
- `journalTemplates.test.js` — balance, vendor-borne gateway, no commission/GST,
  zero-fee, zero-platform-fee, derived totals.
- `ledgerReconciler.test.js` — reposts a missing product entry; skips an existing.
- `productPurchaseFlow.test.js` — snapshot (`vendor_amount`/fee split) +
  `postSafe('PRODUCT_PAYMENT')`; existing security tests stay green.

## Deferred (not in this change)
- **Settlement engine** still reads bookings only — product vendor-payables
  accrue in account 2000 but won't auto-flow to vendor payouts yet. Separate scope.
- **Historical backfill** — `backfillLedger.js` not extended for products
  (dataset was ~empty while the feature was kill-switched off). The reconciler
  heals any new rows; old rows lack the fee snapshot (gateway = 0 on repost).
