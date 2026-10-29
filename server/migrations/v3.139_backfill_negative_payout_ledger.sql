-- v3.139 — backfill fee-only bookings whose payout went NEGATIVE (F1).
--
-- On a ₹0 fee-only service the Razorpay gateway fee was still subtracted from a
-- zero payout, producing vendor_amount < 0. That made the ORDER_PAYMENT journal
-- entry carry a negative line, which post_journal_entry rejects outright
-- ("line amounts cannot be negative"), so the entry NEVER posted and the hourly
-- ledger reconciler re-failed on the same rows every run — captured revenue that
-- never reached the books.
--
-- The code fix (pricingEngine.calculateVendorPayout floors at 0;
-- orderPaymentEntry books the gateway fee as a BAS-borne expense when the host is
-- owed nothing) makes NEW fee-only bookings post correctly.
--
-- This heals the historical rows: reset their payout to 0. That is the correct
-- value (a host who sold nothing is owed nothing), and it clears the negative
-- line. Once the payout is 0 and the fixed template is deployed, the hourly
-- ledgerReconciler posts the real, balanced ORDER_PAYMENT entry for each row on
-- its next run — no manual ADJUSTMENT needed, the primary entry finally lands.
--
-- ORDER OF OPERATIONS: deploy the code fix FIRST. Running this before the fixed
-- template is live would let the reconciler retry with the old (still-rejecting)
-- template. Apply on BOTH DBs after the fix deploys.
--
-- Idempotent + condition-scoped (no hardcoded ids): a second run matches nothing.

UPDATE bookings
   SET vendor_amount = 0,
       updated_at    = now()
 WHERE payment_status = 'paid'
   AND vendor_amount  < 0;
