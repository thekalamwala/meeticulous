'use strict';
/**
 * Product purchase security trio:
 *   - createProductOrder verifies the OTP before any money moves and bakes the
 *     verified buyer + the price-at-order into the Razorpay order notes.
 *   - verifyProductPayment trusts those notes (not the request body) for the
 *     buyer + amount, so the email is authoritative and a mid-checkout price
 *     edit can't change what's recorded. Idempotent on razorpay_order_id.
 *
 * Mock preamble mirrors verifyPaymentLoadStub.test.js so paymentController imports.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn(), auditLog: jest.fn() }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: String((e && e.message) || e) }) }));
jest.mock('../../utils/hostOf', () => ({ hostOf: jest.fn() }));
jest.mock('../../utils/razorpaySignature', () => ({ verifySignature: jest.fn() }));
jest.mock('../../services/razorpayConfig', () => ({ getKeySecret: jest.fn(), getKeyId: jest.fn(), getClient: jest.fn(), getWebhookSecret: jest.fn() }));
jest.mock('../../services/planService', () => ({ normalizeSlug: (s) => (s || '').toLowerCase(), isFreeSlug: (s) => ['starter','explorer','free','starter_legacy'].includes((s || '').toLowerCase().trim()), getPlan: jest.fn() }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../services/razorpaySubscriptions', () => ({ getClient: jest.fn() }));
jest.mock('../../services/subscriptionService', () => ({ activateFromSubscription: jest.fn() }));
jest.mock('../../services/bookingCapture', () => ({ finalizeBookingCapture: jest.fn() }));
jest.mock('../../utils/sendEmail', () => jest.fn());
jest.mock('../../utils/adminAlert', () => ({ adminAlert: jest.fn() }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn() }));
jest.mock('../../config/google', () => ({ createCalendarEvent: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: jest.fn((v) => v) }));
jest.mock('../../utils/profileSecrets', () => ({}));
jest.mock('../../utils/posthog', () => ({ capture: jest.fn(), resolveGuestId: jest.fn(() => 'guest') }));
jest.mock('../../utils/trackServer', () => ({ trackServer: jest.fn() }));
// Run the deferred task inline so the email path is exercised in-test.
jest.mock('../../utils/background', () => ({ runInBackground: (label, fn) => { fn(); } }));
jest.mock('../../utils/otpStore', () => ({ verify: jest.fn() }));
jest.mock('../../utils/productEmail', () => ({ sendProductDownloadEmail: jest.fn() }));
jest.mock('../../services/ledger/postingService', () => ({ postSafe: jest.fn() }));
jest.mock('../../lib/subscriptionPricing', () => ({
  cadencePrice: jest.fn(), cadenceGross: jest.fn(), cadencePeriodDays: jest.fn(),
  computeSwitch: jest.fn(), normCadence: jest.fn(),
}));

const { supabaseAdmin } = require('../../config/supabase');
const platformConfig = require('../../services/platformConfig');
const otpStore = require('../../utils/otpStore');
const razorpayConfig = require('../../services/razorpayConfig');
const { verifySignature } = require('../../utils/razorpaySignature');
const { sendProductDownloadEmail } = require('../../utils/productEmail');
const { postSafe } = require('../../services/ledger/postingService');
const { createProductOrder, verifyProductPayment } = require('../../controllers/paymentController');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

beforeEach(() => {
  jest.clearAllMocks();
  razorpayConfig.getKeyId.mockResolvedValue('key_x');
  razorpayConfig.getKeySecret.mockResolvedValue('secret');
  platformConfig.getConfig.mockResolvedValue({ platformFee: 10, gstRate: 0.18 });
  supabaseAdmin.rpc.mockResolvedValue({});
});

// ── createProductOrder ────────────────────────────────────────
describe('createProductOrder — OTP gate + order notes', () => {
  const product = { id: 'prod_1', title: 'Guide', price: 199, host_id: 'h1', is_active: true };
  const ordersCreate = jest.fn().mockResolvedValue({ id: 'order_1', amount: 20900, currency: 'INR' });

  const wireProduct = () => {
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'products') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: product }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    });
    razorpayConfig.getClient.mockResolvedValue({ orders: { create: ordersCreate } });
  };

  test('rejects when the OTP is invalid — no order, no charge', async () => {
    otpStore.verify.mockResolvedValue({ valid: false, reason: 'Invalid or expired code' });
    wireProduct();
    const r = res();
    await createProductOrder({ body: { product_id: 'prod_1', buyer_email: 'b@x.com', otp: '000000' }, ip: '1.1.1.1' }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(ordersCreate).not.toHaveBeenCalled();
  });

  test('rejects a malformed email before touching the OTP store', async () => {
    wireProduct();
    const r = res();
    await createProductOrder({ body: { product_id: 'prod_1', buyer_email: 'not-an-email', otp: '123456' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(otpStore.verify).not.toHaveBeenCalled();
  });

  test('valid OTP bakes the verified buyer + price snapshot into the order notes', async () => {
    otpStore.verify.mockResolvedValue({ valid: true });
    wireProduct();
    const r = res();
    await createProductOrder({
      body: { product_id: 'prod_1', buyer_email: 'B@X.com', buyer_name: 'Bee', buyer_phone: '+91', otp: '123456' },
    }, r);

    expect(otpStore.verify).toHaveBeenCalledWith('b@x.com', '123456');
    expect(ordersCreate).toHaveBeenCalledTimes(1);
    const notes = ordersCreate.mock.calls[0][0].notes;
    expect(notes).toMatchObject({
      product_id: 'prod_1', product_price: 199, platform_fee: 10,
      buyer_email: 'b@x.com', buyer_name: 'Bee', buyer_phone: '+91',
    });
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ razorpay_order_id: 'order_1' }));
  });

  test('free products are rejected (paid path only)', async () => {
    otpStore.verify.mockResolvedValue({ valid: true });
    supabaseAdmin.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { ...product, price: 0 } }) }) }),
    }));
    razorpayConfig.getClient.mockResolvedValue({ orders: { create: ordersCreate } });
    const r = res();
    await createProductOrder({ body: { product_id: 'prod_1', buyer_email: 'b@x.com', otp: '123456' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(ordersCreate).not.toHaveBeenCalled();
  });
});

// ── verifyProductPayment ──────────────────────────────────────
describe('verifyProductPayment — trusts order notes', () => {
  // Live price is 50, but the order was created at 199. The recorded amount must
  // follow the order (what was charged), not the current price.
  const liveProduct = {
    id: 'prod_1', price: 50, host_id: 'h1', title: 'Guide',
    profiles: { username: 'john', name: 'John' },
  };
  const goodNotes = {
    product_id: 'prod_1', product_price: 199, platform_fee: 10,
    buyer_email: 'buyer@x.com', buyer_name: 'Bee', buyer_phone: '+91',
  };

  const wire = ({ notes = goodNotes, amount = 20900, existing = null, fee = null, tax = 0 } = {}) => {
    let inserted;
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'products') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: liveProduct }) }) }) };
      }
      if (table === 'product_purchases') {
        return {
          select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: existing }) }) }) }),
          insert: (p) => { inserted = p; return { select: () => ({ single: () => Promise.resolve({ data: { id: 'pp1', ...p } }) }) }; },
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    const client = { orders: { fetch: jest.fn().mockResolvedValue({ id: 'order_1', amount, notes }) } };
    // Add payments.fetch only when a fee is supplied — otherwise materialize's
    // best-effort fetch fails and records a 0 gateway fee (the default path).
    if (fee != null) client.payments = { fetch: jest.fn().mockResolvedValue({ fee, tax }) };
    razorpayConfig.getClient.mockResolvedValue(client);
    verifySignature.mockReturnValue(true);
    return () => inserted;
  };

  const reqBody = {
    product_id: 'prod_1',
    razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig',
  };

  test('records amount_paid from the order snapshot, not the live price', async () => {
    const getInserted = wire();
    const r = res();
    await verifyProductPayment({ body: reqBody, ip: '1.1.1.1' }, r);

    const inserted = getInserted();
    expect(inserted.amount_paid).toBe(199);   // snapshot, not the live 50
    expect(inserted.platform_fee).toBe(10);
    expect(inserted.buyer_email).toBe('buyer@x.com'); // from notes, not body
    expect(inserted.payment_status).toBe('paid');
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Payment verified' }));
  });

  test('emails the secure download link on a fresh purchase', async () => {
    wire();
    const r = res();
    await verifyProductPayment({ body: reqBody }, r);
    expect(sendProductDownloadEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'buyer@x.com', productId: 'prod_1', username: 'john',
    }));
  });

  test('rejects when the order was created for a different product', async () => {
    wire({ notes: { ...goodNotes, product_id: 'OTHER' } });
    const r = res();
    await verifyProductPayment({ body: reqBody }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('rejects when the captured amount does not match the snapshot', async () => {
    wire({ amount: 9900 }); // expected 20900
    const r = res();
    await verifyProductPayment({ body: reqBody }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('idempotent: an existing purchase for the order returns its token, no re-insert', async () => {
    const getInserted = wire({ existing: { id: 'pp0', download_token: 'tok-existing' } });
    const r = res();
    await verifyProductPayment({ body: reqBody }, r);
    expect(getInserted()).toBeUndefined();
    expect(sendProductDownloadEmail).not.toHaveBeenCalled();
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ download_token: 'tok-existing' }));
  });

  test('bad signature is rejected before any DB work', async () => {
    wire();
    verifySignature.mockReturnValue(false);
    const r = res();
    await verifyProductPayment({ body: reqBody }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('snapshots vendor-borne gateway fee and posts PRODUCT_PAYMENT to the ledger', async () => {
    // Razorpay returns fee 1204 paise (incl 184 tax) = ₹12.04 gateway.
    const getInserted = wire({ fee: 1204, tax: 184 });
    const r = res();
    await verifyProductPayment({ body: reqBody }, r);

    const inserted = getInserted();
    expect(inserted.razorpay_fee_actual).toBe(10.2);   // fee excl tax
    expect(inserted.razorpay_tax_actual).toBe(1.84);
    expect(inserted.customer_total).toBe(209);          // price 199 + fee 10
    expect(inserted.vendor_amount).toBe(186.96);        // 199 − 12.04 (vendor bears gateway)
    expect(postSafe).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: 'PRODUCT_PAYMENT', sourceId: 'pp1',
    }));
  });
});
