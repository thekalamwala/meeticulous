/**
 * createVendorSubscription.test.js — money-safety test for the re-click
 * idempotency guard.
 *
 * PROBLEM (🟠 money): when a host already has a PENDING Razorpay subscription
 * mandate and clicks the SAME paid plan + cadence again (e.g. during webhook lag
 * in onboarding), the handler used to cancel that mandate and create a NEW one.
 * If Razorpay already captured the first mandate's authorization charge, the host
 * is charged twice.
 *
 * FIX: before creating, fetch the existing subscription. If it's still in a
 * pre-authorization state and its notes (vendor_id/plan/cadence) match the
 * request, return the EXISTING subscription_id instead of cancel+create. This
 * test asserts no second subscription is created on the re-click, and that a
 * genuine switch (different cadence) still recreates.
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
  getKeyId: jest.fn(() => Promise.resolve('rzp_key_test')),
  getKeySecret: jest.fn(),
  getClient: jest.fn(),
}));
jest.mock('../../services/planService', () => ({
  // premium plan, has both monthly + annual prices
  FREE_PLAN: 'free',
  normalizeSlug: (s) => {
    const v = (s || 'free').toLowerCase().trim();
    return v === 'explorer' || v === 'starter' ? 'free' : v;
  },
  isFreeSlug: (s) => ['free', 'starter', 'explorer', 'starter_legacy'].includes((s || '').toLowerCase().trim()),
  // Archived rows are never self-serve purchasable (v3.165).
  isSelfServable: (p) => !!p && p.active !== false,
  getPlan: jest.fn(() =>
    Promise.resolve({ slug: 'premium', name: 'Sloth Active', monthly_price: 338.13, annual_price: 3050, active: true })
  ),
}));
jest.mock('../../services/platformConfig', () => ({
  getConfig: jest.fn(() => Promise.resolve({ gstRate: 0.18, platformFee: 0 })),
}));
jest.mock('../../services/razorpaySubscriptions', () => ({
  fetchSubscription: jest.fn(),
  cancelSubscription: jest.fn(() => Promise.resolve()),
  ensureRazorpayPlan: jest.fn(() => Promise.resolve('plan_xyz')),
  createSubscription: jest.fn(() => Promise.resolve({ id: 'sub_NEW' })),
}));
jest.mock('../../services/subscriptionService', () => ({
  activateFromSubscription: jest.fn(),
  ACTIVE_STATES: ['active', 'authenticated'],
}));
jest.mock('../../services/ledger/journalTemplates', () => ({}));
jest.mock('../../services/ledger/postingService', () => ({ postSafe: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/sendEmail', () => jest.fn());
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn() }));
jest.mock('../../config/google', () => ({ createCalendarEvent: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: jest.fn((v) => v) }));

// ── Imports (after mocks) ────────────────────────────────────────────────────
const { supabaseAdmin } = require('../../config/supabase');
const razorpaySubscriptions = require('../../services/razorpaySubscriptions');
const planService = require('../../services/planService');
const { auditLog } = require('../../utils/logger');
const ctrl = require('../../controllers/paymentController');

// ── Helpers ──────────────────────────────────────────────────────────────────
const mockRes = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};

const makeReq = ({ plan = 'creator', cadence = 'annual', userId = 'vendor-1', billing } = {}) => ({
  user: { id: userId },
  body: { plan, cadence, ...(billing ? { billing } : {}) },
  ip: '127.0.0.1',
});

// A valid billing snapshot for the create/switch paths (GST state now required
// before a mandate is created). The idempotent re-click test omits it on purpose.
const BILLING = { name: 'Acme LLP', state_code: '27', state: 'Maharashtra' };

/**
 * Wire supabaseAdmin.from('profiles') so the initial state read returns `prof`.
 * Any profiles.update (cancel+create path) resolves successfully. Captures the
 * update payloads so a test can assert whether the create path was taken.
 */
const wireProfiles = (prof, updateSpy) => {
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'profiles') {
      const c = {};
      c.select = jest.fn(() => c);
      c.eq = jest.fn(() => c);
      c.single = jest.fn(() => Promise.resolve({ data: prof, error: null }));
      c.maybeSingle = jest.fn(() => Promise.resolve({ data: prof, error: null }));
      c.update = updateSpy || jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) }));
      return c;
    }
    // subscription_payments / plan_purchases (switch path proration reads) → empty
    const c = {};
    c.select = jest.fn(() => c);
    c.eq = jest.fn(() => c);
    c.order = jest.fn(() => c);
    c.limit = jest.fn(() => c);
    c.maybeSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
    c.single = jest.fn(() => Promise.resolve({ data: null, error: null }));
    c.insert = jest.fn(() => Promise.resolve({ error: null }));
    return c;
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('createVendorSubscription — pending re-click idempotency (double-charge guard)', () => {
  test('re-click of the SAME plan+cadence while PENDING returns the existing subscription_id and does NOT create a second mandate', async () => {
    // Host already has a pending mandate from the first click. Fresh free→paid
    // upgrade: profiles.plan is still the free tier; the target lives in Razorpay notes.
    const prof = {
      plan: 'starter',
      subscription_status: 'pending',
      current_period_end: null,
      plan_expires_at: null,
      plan_activated_at: null,
      razorpay_subscription_id: 'sub_EXISTING',
      billing_cadence: null,
    };
    wireProfiles(prof);

    // The existing Razorpay subscription is still pre-authorization and its notes
    // match this exact request (premium / annual / vendor-1).
    razorpaySubscriptions.fetchSubscription.mockResolvedValue({
      id: 'sub_EXISTING',
      status: 'created',
      notes: { vendor_id: 'vendor-1', plan: 'premium', cadence: 'annual' },
    });

    const res = mockRes();
    await ctrl.createVendorSubscription(makeReq({ plan: 'premium', cadence: 'annual' }), res);

    // It must look up the existing mandate…
    expect(razorpaySubscriptions.fetchSubscription).toHaveBeenCalledWith('sub_EXISTING');
    // …and must NOT cancel or create a new one (that is the double-charge path).
    expect(razorpaySubscriptions.cancelSubscription).not.toHaveBeenCalled();
    expect(razorpaySubscriptions.createSubscription).not.toHaveBeenCalled();

    // Response returns the EXISTING subscription id so the client re-syncs it.
    const body = res.json.mock.calls[0][0];
    expect(body.subscription_id).toBe('sub_EXISTING');
    expect(body.plan).toBe('premium');
    expect(body.cadence).toBe('annual');

    // Idempotency was audit-logged.
    expect(auditLog).toHaveBeenCalledWith(
      'SUBSCRIPTION_CREATE_IDEMPOTENT',
      'vendor-1',
      expect.objectContaining({ subscription_id: 'sub_EXISTING', plan: 'premium', cadence: 'annual' })
    );
  });

  test('re-click with a DIFFERENT cadence while PENDING falls through to cancel+create (legitimate change, not idempotent)', async () => {
    const prof = {
      plan: 'starter',
      subscription_status: 'pending',
      current_period_end: null,
      plan_expires_at: null,
      plan_activated_at: null,
      razorpay_subscription_id: 'sub_EXISTING',
      billing_cadence: null,
    };
    wireProfiles(prof);

    // Existing mandate is annual, but the host now picks monthly.
    razorpaySubscriptions.fetchSubscription.mockResolvedValue({
      id: 'sub_EXISTING',
      status: 'created',
      notes: { vendor_id: 'vendor-1', plan: 'premium', cadence: 'annual' },
    });

    const res = mockRes();
    await ctrl.createVendorSubscription(makeReq({ plan: 'premium', cadence: 'monthly', billing: BILLING }), res);

    // Different cadence → not idempotent → old mandate cancelled, new one created.
    expect(razorpaySubscriptions.cancelSubscription).toHaveBeenCalledWith('sub_EXISTING', false);
    expect(razorpaySubscriptions.createSubscription).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].subscription_id).toBe('sub_NEW');
  });

  test('no prior subscription → creates a fresh mandate (no idempotency lookup)', async () => {
    const prof = {
      plan: 'starter',
      subscription_status: null,
      current_period_end: null,
      plan_expires_at: null,
      plan_activated_at: null,
      razorpay_subscription_id: null,
      billing_cadence: null,
    };
    wireProfiles(prof);

    const res = mockRes();
    await ctrl.createVendorSubscription(makeReq({ plan: 'premium', cadence: 'annual', billing: BILLING }), res);

    expect(razorpaySubscriptions.fetchSubscription).not.toHaveBeenCalled();
    expect(razorpaySubscriptions.cancelSubscription).not.toHaveBeenCalled();
    expect(razorpaySubscriptions.createSubscription).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].subscription_id).toBe('sub_NEW');
  });
});

// v3.165: the legacy partner price (`creator`, ₹229) and the internal Supreme
// tier live on as archived rows so their existing subscribers keep renewing.
// Both endpoints previously accepted ANY priced slug, so anyone who guessed one
// could buy at its price. Self-serve checkout must refuse them.
describe('createVendorSubscription — archived plans are not self-serve purchasable', () => {
  test('an archived plan 404s instead of selling at its old price', async () => {
    wireProfiles({
      plan: 'free', subscription_status: null, current_period_end: null,
      plan_expires_at: null, plan_activated_at: null,
      razorpay_subscription_id: null, billing_cadence: null,
    });
    planService.getPlan.mockResolvedValueOnce({
      slug: 'creator', name: 'Sloth Active (Partner)',
      monthly_price: 229, annual_price: 1499, active: false,
    });

    const res = mockRes();
    await ctrl.createVendorSubscription(makeReq({ plan: 'creator', cadence: 'annual', billing: BILLING }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(razorpaySubscriptions.createSubscription).not.toHaveBeenCalled();
  });
});
