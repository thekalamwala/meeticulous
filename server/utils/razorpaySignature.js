/**
 * razorpaySignature.js — shared Razorpay payment signature verification.
 *
 * Razorpay signs `${order_id}|${payment_id}` with HMAC-SHA256 using the
 * key secret. Verification is a timing-safe compare against that digest.
 * Extracted from paymentController so any flow (booking / subscription /
 * product / reschedule fee) verifies payments through one implementation.
 */
'use strict';

const crypto = require('crypto');

// keySecret is injected by callers (from razorpayConfig, DB-driven). Defaults to
// the env var for back-compat and for tests that mock this module entirely.
function verifySignature(orderId, paymentId, signature, keySecret = process.env.RAZORPAY_KEY_SECRET) {
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(String(signature || ''));
  // Length-guard: timingSafeEqual throws on unequal-length buffers; a
  // mismatched/forged signature must return false, not throw.
  return expectedBuf.length === sigBuf.length && crypto.timingSafeEqual(expectedBuf, sigBuf);
}

module.exports = { verifySignature };
