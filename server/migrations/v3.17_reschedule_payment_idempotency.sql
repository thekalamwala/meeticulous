-- v3.17_reschedule_payment_idempotency.sql
-- Each Razorpay reschedule-fee payment can back exactly ONE reschedule. Hard
-- backstop against replaying the same fee tokens. Idempotent. (Live-verified: no
-- existing duplicates.)
CREATE UNIQUE INDEX IF NOT EXISTS reschedule_payments_payment_id_unique
  ON reschedule_payments (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
