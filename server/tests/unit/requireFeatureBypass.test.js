// requireFeature — Supreme kill-switch bypass.
// A caller whose plan has bypasses_kill_switches=true punches through an
// admin-disabled flag, EXCEPT for the hardcoded SAFETY_KEYS denylist.

const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../services/planService', () => ({
  getPlan: jest.fn(),
  resolveVendorPlan: jest.fn((p) => p?.plan || 'starter'),
}));

const { isFeatureEnabled } = require('../../services/featureFlags');
const planService = require('../../services/planService');
const { requireFeature } = require('../../middleware/requireFeature');
const { SAFETY_KEYS } = require('../../config/featureRegistry');

const run = async (key, req = {}) => {
  const res = { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const next = jest.fn();
  await requireFeature(key)(req, res, next);
  return { res, next };
};

// profiles.plan lookup used by the bypass fallback path
const wireProfile = (plan) =>
  mockFrom.mockImplementation(() => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { plan }, error: null }) }) }),
  }));

beforeEach(() => { jest.clearAllMocks(); });

test('flag ON → next(), plan never consulted', async () => {
  isFeatureEnabled.mockResolvedValue(true);
  const { next } = await run('cover_photo', { user: { id: 'u1' }, vendorPlanData: { bypasses_kill_switches: true } });
  expect(next).toHaveBeenCalled();
  expect(planService.getPlan).not.toHaveBeenCalled();
});

test('flag OFF + anonymous → 503', async () => {
  isFeatureEnabled.mockResolvedValue(false);
  const { res, next } = await run('cover_photo', {});
  expect(next).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(503);
});

test('flag OFF + Supreme (via req.vendorPlanData) + non-safety key → next()', async () => {
  isFeatureEnabled.mockResolvedValue(false);
  const { res, next } = await run('cover_photo', { user: { id: 'u1' }, vendorPlanData: { bypasses_kill_switches: true } });
  expect(next).toHaveBeenCalled();
  expect(res.statusCode).toBeNull();
});

test('flag OFF + Supreme + SAFETY key → still 503', async () => {
  isFeatureEnabled.mockResolvedValue(false);
  const key = SAFETY_KEYS[0];
  const { res, next } = await run(key, { user: { id: 'u1' }, vendorPlanData: { bypasses_kill_switches: true } });
  expect(next).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(503);
});

test('flag OFF + non-Supreme plan → 503', async () => {
  isFeatureEnabled.mockResolvedValue(false);
  const { res, next } = await run('cover_photo', { user: { id: 'u1' }, vendorPlanData: { bypasses_kill_switches: false } });
  expect(next).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(503);
});

test('flag OFF + Supreme via DB lookup (no vendorPlanData) → next()', async () => {
  isFeatureEnabled.mockResolvedValue(false);
  wireProfile('supreme');
  planService.getPlan.mockResolvedValue({ slug: 'supreme', bypasses_kill_switches: true });
  const { next } = await run('cover_photo', { user: { id: 'u1' } });
  expect(next).toHaveBeenCalled();
  expect(planService.getPlan).toHaveBeenCalled();
});

test('SAFETY_KEYS includes the financial + auth kills', () => {
  for (const k of ['razorpay_payment', 'product_purchase', 'guest_login', 'guest_otp', 'guest_booking']) {
    expect(SAFETY_KEYS).toContain(k);
  }
});
