-- v3.47 — DB-level payment idempotency on bookings + plan_purchases (audit P2-5/P2-6)
--
-- product_purchases, subscription_payments and reschedule_payments each have a
-- unique index on their razorpay payment/order id; bookings and plan_purchases
-- did NOT. Their idempotency rested solely on application-level conditional
-- updates / SELECT-then-insert (TOCTOU-prone, and unguarded by any future write
-- path). Add partial unique indexes to match the other payment tables so the same
-- razorpay_payment_id can never be recorded twice. (Verified 0 existing dups.)

CREATE UNIQUE INDEX IF NOT EXISTS bookings_razorpay_payment_id_uniq
  ON public.bookings (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS plan_purchases_razorpay_payment_id_uniq
  ON public.plan_purchases (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
