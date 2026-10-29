const express = require('express');
const router = express.Router();
const {
  createOrder, verifyPayment,
  subscribePlan, verifySubscription,
  createVendorSubscription, syncVendorSubscription, cancelVendorSubscription,
  createProductOrder, verifyProductPayment,
  createRescheduleFeeOrder,
  handleWebhook,
} = require('../controllers/paymentController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { paymentLimiter } = require('../middleware/security');
const { requireFeature } = require('../middleware/requireFeature');

// Razorpay server-side webhook — authoritative payment confirmation.
// Uses the raw body parser registered in server.js (must precede express.json).
// Verified by HMAC signature inside the handler; no app rate limiter so genuine
// Razorpay retries are never dropped.
router.post('/webhook', handleWebhook);

// Booking payments — guard the entry point only; never the verify step, so a
// flag flipped off mid-transaction can't strand an already-captured payment.
router.post('/create-order', paymentLimiter, requireFeature('razorpay_payment'), createOrder);
router.post('/verify', paymentLimiter, verifyPayment);

// Plan subscriptions (vendor must be logged in)
// Legacy one-time order flow (retained as a fallback for vendors who decline a mandate)
router.post('/subscribe', paymentLimiter, protect, requireFeature('plan_upgrade'), subscribePlan);
router.post('/verify-subscription', paymentLimiter, protect, verifySubscription);

// Auto-renewing subscriptions (Razorpay Subscriptions API)
router.post('/subscription/create', paymentLimiter, protect, requireFeature('plan_upgrade'), createVendorSubscription);
router.post('/subscription/sync', paymentLimiter, protect, syncVendorSubscription);
router.post('/subscription/cancel', paymentLimiter, protect, cancelVendorSubscription);

// Reschedule fee (guest must be logged in — the guest who owns the booking)
router.post('/reschedule-fee/create-order', paymentLimiter, protect, requireFeature('reschedule_fee'), createRescheduleFeeOrder);

// Product purchases
router.post('/create-product-order', paymentLimiter, requireFeature('product_purchase'), createProductOrder);
// optionalProtect: links the purchase to the logged-in buyer; buyer_id is
// never taken from the request body.
router.post('/verify-product', paymentLimiter, optionalProtect, verifyProductPayment);

module.exports = router;
