-- v1.10 — security hardening constraints (run in Supabase SQL Editor)
--
-- Closes the concurrency race in product-purchase verification: the app-level
-- idempotency check (SELECT ... then INSERT) can be beaten by two simultaneous
-- verify-product calls, double-issuing download tokens. A unique index makes the
-- second insert fail at the DB layer so only one purchase per Razorpay order can
-- ever exist. Code already returns the existing token on a duplicate.

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_purchases_rzp_order
  ON product_purchases (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

-- Bounds free-download row spam to one row per (product, email).
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_purchases_free_dedupe
  ON product_purchases (product_id, buyer_email)
  WHERE razorpay_order_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STILL RECOMMENDED (larger changes — review before applying):
--
-- 1) Payout double-spend (TOCTOU): requestPayout checks the balance in app code
--    then inserts. Enforce atomically instead, e.g. a SECURITY DEFINER RPC that
--    recomputes available balance and inserts the payout_request in one
--    transaction, or a CHECK/trigger that rejects when SUM(pending+approved)
--    exceeds earned. (Needs a function + controller switch to .rpc().)
--
-- 2) otp_codes is keyed by email only, so a booking OTP and a password-reset OTP
--    for the same email overwrite each other (denial-of-OTP). Migrate to a
--    composite key on (email, type) and scope every otp_codes read/write/delete
--    by type. This is a primary-key change — back up and test both OTP flows.
