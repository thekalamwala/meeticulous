'use strict';
// Tier moves on /subscribe. Before this, ANY existing membership with a host 409'd,
// so a member could never move off the tier they first picked.
//   same tier      -> 409
//   dearer paid    -> an upgrade order for the prorated difference (no subscription yet)
//   free -> paid   -> an ordinary subscription (a free row holds no money)
//   cheaper / equal-> 400, pointing at cancel
// And /upgrade/verify only moves the row for a genuine, matching, not-already-applied order.

let mockTier = null;        // tier being joined (the /subscribe lookup)
let mockCurrent = null;     // caller's live membership with this host
let mockTierById = null;    // tier lookup inside verifyUpgrade

jest.mock('../../../config/supabase', () => {
  const builder = (table) => {
    const q = {
      _t: table,
      select: () => q, eq: () => q, in: () => q, update: () => q, insert: () => q,
      maybeSingle: async () => {
        if (q._t === 'community_membership_subscriptions') return { data: mockCurrent, error: null };
        if (q._t === 'community_membership_tiers') return { data: mockTierById ?? mockTier, error: null };
        return { data: null, error: null };
      },
    };
    q.then = (res, rej) => Promise.resolve({ data: null, error: null }).then(res, rej);
    return q;
  };
  return { supabaseAdmin: { from: (t) => builder(t) } };
});
jest.mock('../../../services/community/store', () => ({}));
jest.mock('../../../utils/logger', () => ({ auditLog: jest.fn(), securityLog: jest.fn() }));

const mockOrder = { id: 'order_up1', amount: 124950, currency: 'INR', notes: {} };
jest.mock('../../../services/membershipBillingService', () => ({
  startPaidSubscription: jest.fn(async () => ({ id: 'sub_new' })),
  createUpgradeOrder: jest.fn(async ({ quote }) => ({ ...mockOrder, amount: Math.round(quote.dueNowInr * 100) })),
  applyUpgrade: jest.fn(async () => ({ upgraded: true, subscription_id: 'sub_up' })),
}));
const mockRzp = { orders: { fetch: jest.fn() } };
jest.mock('../../../services/razorpayConfig', () => ({
  getKeyId: async () => 'rzp_test_key',
  getKeySecret: async () => 'secret',
  getClient: async () => mockRzp,
}));
let mockSigOk = true;
jest.mock('../../../utils/razorpaySignature', () => ({ verifySignature: () => mockSigOk }));

const billing = require('../../../services/membershipBillingService');
const ctl = require('../../../controllers/membershipController');

const mkRes = () => { const r = {}; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const req = (body) => ({ user: { id: 'm1' }, body, ip: '127.0.0.1' });
const inDays = (n) => new Date(Date.now() + n * 24 * 3600 * 1000).toISOString();

const premium = { id: 't_premium', name: 'Premium', type: 'paid', status: 'live', price_inr: 499, program: { host_id: 'h1', status: 'live' } };
const founding = { id: 't_founding', name: 'Founding', type: 'paid', status: 'live', price_inr: 1499, program: { host_id: 'h1', status: 'live' } };

beforeEach(() => {
  mockTier = founding; mockCurrent = null; mockTierById = null; mockSigOk = true;
  jest.clearAllMocks();
});

describe('createPaidSubscription — tier moves', () => {
  test('no membership yet: ordinary subscription', async () => {
    const res = mkRes();
    await ctl.createPaidSubscription(req({ tier_id: 't_founding' }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.subscription_id).toBe('sub_new');
    expect(billing.createUpgradeOrder).not.toHaveBeenCalled();
  });

  test('already on this tier: 409', async () => {
    mockCurrent = { id: 's1', tier_id: 't_founding', razorpay_subscription_id: 'sub_old', tier: { price_inr: 1499 } };
    const res = mkRes();
    await ctl.createPaidSubscription(req({ tier_id: 't_founding' }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/already on this tier/i);
  });

  test('paid -> dearer paid: prorated upgrade order, no subscription yet', async () => {
    mockCurrent = {
      id: 's1', tier_id: 't_premium', razorpay_subscription_id: 'sub_old',
      current_period_end: inDays(15), tier: { id: 't_premium', name: 'Premium', price_inr: 499 },
    };
    const res = mkRes();
    await ctl.createPaidSubscription(req({ tier_id: 't_founding' }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.upgrade).toBe(true);
    expect(res.body.credit_inr).toBe(249.5);      // half of 499
    expect(res.body.due_now_inr).toBe(1249.5);    // 1499 - 249.5
    expect(res.body.amount).toBe(124950);         // paise, matches the quote
    expect(res.body.from_tier.name).toBe('Premium');
    expect(billing.startPaidSubscription).not.toHaveBeenCalled();
  });

  test('free -> paid: ordinary subscription, no credit, no order', async () => {
    mockCurrent = { id: 's1', tier_id: 't_sub', razorpay_subscription_id: null, tier: { id: 't_sub', name: 'Subscriber', type: 'free', price_inr: null } };
    const res = mkRes();
    await ctl.createPaidSubscription(req({ tier_id: 't_founding' }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.subscription_id).toBe('sub_new');
    expect(billing.createUpgradeOrder).not.toHaveBeenCalled();
  });

  test('paid -> cheaper paid: refused, points at cancel', async () => {
    mockTier = premium;
    mockCurrent = {
      id: 's1', tier_id: 't_founding', razorpay_subscription_id: 'sub_old',
      current_period_end: inDays(10), tier: { id: 't_founding', name: 'Founding', price_inr: 1499 },
    };
    const res = mkRes();
    await ctl.createPaidSubscription(req({ tier_id: 't_premium' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.downgrade).toBe(true);
    expect(res.body.message).toMatch(/cancel/i);
    expect(billing.createUpgradeOrder).not.toHaveBeenCalled();
  });
});

describe('verifyUpgrade', () => {
  const goodNotes = {
    kind: 'membership_upgrade', member_id: 'm1', host_id: 'h1',
    tier_id: 't_founding', from_tier_id: 't_premium', due_now_inr: 1249.5, credit_inr: 249.5,
  };
  const body = { razorpay_order_id: 'order_up1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' };

  beforeEach(() => {
    mockRzp.orders.fetch.mockResolvedValue({ id: 'order_up1', amount: 124950, notes: goodNotes });
    mockCurrent = {
      id: 's1', tier_id: 't_premium', razorpay_subscription_id: 'sub_old',
      current_period_end: inDays(15), tier: { id: 't_premium', price_inr: 499 },
    };
    mockTierById = { id: 't_founding', name: 'Founding', type: 'paid', status: 'live', price_inr: 1499 };
  });

  test('moves the member on a genuine, matching order', async () => {
    const res = mkRes();
    await ctl.verifyUpgrade(req(body), res);
    expect(billing.applyUpgrade).toHaveBeenCalled();
    expect(res.body.upgraded).toBe(true);
    expect(res.body.tier_id).toBe('t_founding');
  });

  test('a bad signature moves nothing', async () => {
    mockSigOk = false;
    const res = mkRes();
    await ctl.verifyUpgrade(req(body), res);
    expect(res.statusCode).toBe(400);
    expect(billing.applyUpgrade).not.toHaveBeenCalled();
  });

  test('someone else’s order moves nothing', async () => {
    mockRzp.orders.fetch.mockResolvedValue({ id: 'order_up1', amount: 124950, notes: { ...goodNotes, member_id: 'someone_else' } });
    const res = mkRes();
    await ctl.verifyUpgrade(req(body), res);
    expect(res.statusCode).toBe(400);
    expect(billing.applyUpgrade).not.toHaveBeenCalled();
  });

  test('an amount that does not match the quoted difference moves nothing', async () => {
    mockRzp.orders.fetch.mockResolvedValue({ id: 'order_up1', amount: 100, notes: goodNotes });
    const res = mkRes();
    await ctl.verifyUpgrade(req(body), res);
    expect(res.statusCode).toBe(400);
    expect(billing.applyUpgrade).not.toHaveBeenCalled();
  });

  test('an order for a booking or product is not an upgrade', async () => {
    mockRzp.orders.fetch.mockResolvedValue({ id: 'order_up1', amount: 124950, notes: { ...goodNotes, kind: 'course' } });
    const res = mkRes();
    await ctl.verifyUpgrade(req(body), res);
    expect(res.statusCode).toBe(400);
    expect(billing.applyUpgrade).not.toHaveBeenCalled();
  });

  test('a retry after the move already landed is a no-op, not a second charge', async () => {
    mockCurrent = { id: 's1', tier_id: 't_founding', razorpay_subscription_id: 'sub_up', tier: { price_inr: 1499 } };
    const res = mkRes();
    await ctl.verifyUpgrade(req(body), res);
    expect(res.body).toEqual({ upgraded: true, reused: true, tier_id: 't_founding' });
    expect(billing.applyUpgrade).not.toHaveBeenCalled();
  });

  test('no live membership to move: 409', async () => {
    mockCurrent = null;
    const res = mkRes();
    await ctl.verifyUpgrade(req(body), res);
    expect(res.statusCode).toBe(409);
    expect(billing.applyUpgrade).not.toHaveBeenCalled();
  });
});
