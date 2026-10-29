/**
 * verifySubscription.test.js — security tests for the subscription tier-escalation fix.
 *
 * Attack vector: a vendor pays for "creator", then calls verify with plan="professional"
 * and the same valid Razorpay tokens. The HMAC signature only covers order_id|payment_id
 * — it does NOT bind to which plan was purchased. The fix fetches the Razorpay order and
 * asserts notes.vendor_id + notes.plan match the request before activating any plan.
 */
'use strict';

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn(), auditLog: jest.fn() }));
jest.mock('../../utils/httpError', () => ({
  safeError: (res, e) => res.status(500).json({ message: String(e?.message || e) }),
}));
jest.mock('../../utils/razorpaySignature', () => ({ verifySignature: jest.fn() }));
jest.mock('../../services/razorpayConfig', () => ({
  getKeySecret: jest.fn(),
  getClient: jest.fn(),
}));
jest.mock('../../services/planService', () => ({
  normalizeSlug: (s) => (s || '').toLowerCase(),
  isFreeSlug: (s) => ['starter', 'explorer', 'free', 'starter_legacy'].includes((s || '').toLowerCase().trim()),
  getPlan: jest.fn(),
}));
jest.mock('../../services/platformConfig', () => ({
  getConfig: jest.fn(),
}));
jest.mock('../../services/razorpaySubscriptions', () => ({
  getClient: jest.fn(),
}));
jest.mock('../../services/subscriptionService', () => ({
  activateFromSubscription: jest.fn(),
}));
jest.mock('../../services/ledger/journalTemplates', () => ({
  subscriptionPaymentEntry: jest.fn(() => ({ lines: [] })),
}));
jest.mock('../../services/ledger/postingService', () => ({
  postSafe: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../utils/sendEmail', () => jest.fn());
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn() }));
jest.mock('../../config/google', () => ({ createCalendarEvent: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: jest.fn((v) => v) }));

// ── Imports (after mocks) ────────────────────────────────────────────────────
const { supabaseAdmin } = require('../../config/supabase');
const { verifySignature } = require('../../utils/razorpaySignature');
const razorpayConfig = require('../../services/razorpayConfig');
const { securityLog } = require('../../utils/logger');
const ctrl = require('../../controllers/paymentController');

// ── Helpers ──────────────────────────────────────────────────────────────────
const mockRes = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};

/** Build a minimal req object for verifySubscription */
const makeReq = ({ plan = 'professional', userId = 'vendor-1' } = {}) => ({
  user: { id: userId },
  body: {
    plan,
    razorpay_payment_id: 'pay_test123',
    razorpay_order_id: 'order_test456',
    razorpay_signature: 'sig_valid',
  },
  ip: '127.0.0.1',
});

/**
 * Build a mock Razorpay client whose orders.fetch returns the given notes.
 * Lazily also stubs payments.fetch so the happy-path ledger code doesn't throw.
 */
const mockRzpClient = ({ notes }) => ({
  orders: {
    fetch: jest.fn(() => Promise.resolve({ id: 'order_test456', amount: 118000, notes })),
  },
  payments: {
    fetch: jest.fn(() => Promise.resolve({ fee: 2360, tax: 360 })),
  },
});

/**
 * Wire supabaseAdmin.from() so:
 *  - subscription_payments → no prior payment (idempotency guard passes)
 *  - profiles.update → success
 *  - plan_purchases.insert → success
 *  - everything else → empty success
 */
const wireSupabaseHappyPath = (profileUpdateSpy) => {
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'subscription_payments') {
      const c = {};
      c.select = jest.fn(() => c);
      c.eq = jest.fn(() => c);
      c.maybeSingle = jest.fn(() => Promise.resolve({ data: null, error: null })); // no prior
      c.insert = jest.fn(() => ({
        select: () => ({ single: () => Promise.resolve({ data: { id: 'subpay-1' }, error: null }) }),
      }));
      return c;
    }
    if (table === 'profiles') {
      const c = {};
      c.update = profileUpdateSpy || jest.fn(() => c);
      c.select = jest.fn(() => c);
      c.eq = jest.fn(() => c);
      c.single = jest.fn(() =>
        Promise.resolve({ data: { id: 'vendor-1', name: 'V', email: 'v@x.com', plan: 'professional', plan_expires_at: '2027-01-01' }, error: null })
      );
      return c;
    }
    if (table === 'plan_purchases') {
      return { insert: jest.fn(() => Promise.resolve({ error: null })) };
    }
    return {
      select: jest.fn(() => ({ eq: jest.fn(() => ({ single: () => Promise.resolve({ data: null, error: null }) })) })),
      insert: jest.fn(() => Promise.resolve({ error: null })),
    };
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: signature is valid
  verifySignature.mockReturnValue(true);
  razorpayConfig.getKeySecret.mockResolvedValue('test-secret');
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('verifySubscription — order binding security check', () => {
  // ── FAILING TEST (before fix) ─────────────────────────────────────────────
  test('SECURITY: rejects when order notes.plan does not match claimed plan (tier escalation)', async () => {
    // Order was created for "creator" plan but request claims "professional"
    const rzpClient = mockRzpClient({ notes: { vendor_id: 'vendor-1', plan: 'creator' } });
    razorpayConfig.getClient.mockResolvedValue(rzpClient);

    // Wire supabase — profile update spy lets us assert it was NEVER called
    const profileUpdateSpy = jest.fn(() => ({ select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) })) }));
    wireSupabaseHappyPath(profileUpdateSpy);

    const res = mockRes();
    await ctrl.verifySubscription(makeReq({ plan: 'professional', userId: 'vendor-1' }), res);

    // Must reject with 400
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/payment does not match this plan/i);

    // Profile must NOT be upgraded to the expensive plan
    expect(profileUpdateSpy).not.toHaveBeenCalled();

    // Security event must be logged
    expect(securityLog).toHaveBeenCalledWith(
      'SUBSCRIPTION_ORDER_MISMATCH',
      expect.objectContaining({ userId: 'vendor-1', order_id: 'order_test456', claimedPlan: 'professional' })
    );
  });

  // ── PASSING TEST (after fix) — vendor_id mismatch ─────────────────────────
  test('SECURITY: rejects when order notes.vendor_id does not match authenticated user', async () => {
    // Order belongs to a different vendor
    const rzpClient = mockRzpClient({ notes: { vendor_id: 'other-vendor-99', plan: 'professional' } });
    razorpayConfig.getClient.mockResolvedValue(rzpClient);

    const profileUpdateSpy = jest.fn(() => ({ select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) })) }));
    wireSupabaseHappyPath(profileUpdateSpy);

    const res = mockRes();
    await ctrl.verifySubscription(makeReq({ plan: 'professional', userId: 'vendor-1' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/payment does not match this plan/i);
    expect(profileUpdateSpy).not.toHaveBeenCalled();
  });

  // ── HAPPY PATH TEST — matching notes pass the binding check ──────────────
  test('proceeds past binding check when notes.vendor_id and notes.plan match', async () => {
    // Order notes match the request exactly
    const rzpClient = mockRzpClient({ notes: { vendor_id: 'vendor-1', plan: 'professional' } });
    razorpayConfig.getClient.mockResolvedValue(rzpClient);

    const profileUpdateSpy = jest.fn(() => {
      const c = {};
      c.eq = jest.fn(() => c);
      c.select = jest.fn(() => c);
      c.single = jest.fn(() =>
        Promise.resolve({ data: { id: 'vendor-1', name: 'V', email: 'v@x.com', plan: 'professional', plan_expires_at: '2027-01-01' }, error: null })
      );
      return c;
    });
    wireSupabaseHappyPath(profileUpdateSpy);

    const res = mockRes();
    await ctrl.verifySubscription(makeReq({ plan: 'professional', userId: 'vendor-1' }), res);

    // Must NOT be a binding-check 400
    const statusCalls = res.status.mock.calls.map((c) => c[0]);
    expect(statusCalls).not.toContain(400);

    // Profile update should have been called (plan activation proceeded)
    expect(profileUpdateSpy).toHaveBeenCalled();

    // No SUBSCRIPTION_ORDER_MISMATCH security log
    const mismatchCalls = securityLog.mock.calls.filter(([event]) => event === 'SUBSCRIPTION_ORDER_MISMATCH');
    expect(mismatchCalls).toHaveLength(0);
  });

  // ── Edge case: order fetch fails → 400 ───────────────────────────────────
  test('returns 400 when Razorpay order fetch throws', async () => {
    razorpayConfig.getClient.mockResolvedValue({
      orders: { fetch: jest.fn(() => Promise.reject(new Error('Network error'))) },
    });

    // Supabase: no prior payment so we reach the order-fetch step
    supabaseAdmin.from.mockImplementation(() => {
      const c = {};
      c.select = jest.fn(() => c);
      c.eq = jest.fn(() => c);
      c.maybeSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
      return c;
    });

    const res = mockRes();
    await ctrl.verifySubscription(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/order not found/i);
  });
});
