/**
 * resendSubscriptionReceipt.js — re-send the receipt email (amount + GST invoice
 * PDF link) for one already-recorded subscription charge. For hosts whose
 * original email predates the receipt/invoice rollout, or a lost delivery.
 *
 * Thin CLI over subscriptionService.resendReceiptForPayment — the same function
 * the admin endpoint uses, so both paths behave identically. Delivery truth is
 * email_logs, not this script's exit code.
 *
 * Run (prod): node -r dotenv/config scripts/resendSubscriptionReceipt.js <razorpay_payment_id> dotenv_config_path=.env.production
 * Run (local/staging): node scripts/resendSubscriptionReceipt.js <razorpay_payment_id>
 */
'use strict';
require('dotenv').config();
const subscriptionService = require('../services/subscriptionService');

async function main() {
  const paymentId = process.argv[2];
  if (!paymentId || paymentId.startsWith('dotenv_config')) {
    console.error('Usage: node scripts/resendSubscriptionReceipt.js <razorpay_payment_id>');
    process.exit(1);
  }

  const r = await subscriptionService.resendReceiptForPayment(paymentId);
  if (!r.ok) { console.error(`Could not resend: ${r.reason}`); process.exit(1); }

  console.log(`Re-sent ${r.event} for ${paymentId} (vendor ${r.vendorId}). Verify delivery in email_logs.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
