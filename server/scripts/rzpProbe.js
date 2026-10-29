/**
 * rzpProbe.js — READ-ONLY Razorpay probe using the server's own live merchant keys.
 *
 * Exists so we never depend on the flaky claude.ai Razorpay MCP connector for
 * verification. It ONLY fetches — it never creates a payment, refund, transfer, or
 * payout. Uses RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET from server/.env.
 *
 *   node -r dotenv/config scripts/rzpProbe.js payment   pay_xxx
 *   node -r dotenv/config scripts/rzpProbe.js refunds   pay_xxx
 *   node -r dotenv/config scripts/rzpProbe.js transfer  trf_xxx
 *   node -r dotenv/config scripts/rzpProbe.js transfers            (recent 25)
 *   node -r dotenv/config scripts/rzpProbe.js payment-transfers pay_xxx  (transfers of a payment)
 */
'use strict';
const Razorpay = require('razorpay');

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
if (!keyId || !keySecret) { console.error('RAZORPAY_KEY_ID / _KEY_SECRET missing from env'); process.exit(1); }
const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

const [, , cmd, arg] = process.argv;

(async () => {
  let out;
  switch (cmd) {
    case 'payment': out = await rzp.payments.fetch(arg); break;
    case 'refunds': out = await rzp.payments.fetchMultipleRefund(arg); break;
    case 'transfer': out = await rzp.transfers.fetch(arg); break;
    case 'transfers': out = await rzp.transfers.all({ count: 25 }); break;
    case 'payment-transfers': out = await rzp.payments.fetchTransfers(arg); break;
    default:
      console.error('usage: payment | refunds | transfer | transfers | payment-transfers <id>');
      process.exit(1);
  }
  console.log(`[${keyId.slice(0, 12)}...] ${cmd} ${arg || ''}`);
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error('RZP ERROR', e.statusCode || '', e.error?.description || e.message);
  process.exit(1);
});
