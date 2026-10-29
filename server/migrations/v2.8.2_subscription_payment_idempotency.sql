-- v2.8.2 — idempotency backstop for subscription payments.
-- A replayed verify-subscription must not double-insert / double-post revenue.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_subpay_payment_id
  ON subscription_payments (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
