/**
 * tests/unit/canActivateMore.test.js
 *
 * P1-1: activating an inactive service/product (toggle / is_active false→true)
 * must respect the plan's active-item cap. canActivateMore is the shared gate.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/planService', () => ({ resolveVendorPlan: jest.fn(), getPlan: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const planService = require('../../services/planService');
const { canActivateMore } = require('../../middleware/planMiddleware');

// Wire the two reads canActivateMore makes: profiles (plan), then a count on the
// services/products table.
const wire = ({ profile = { plan: 'creator' }, count = 0, throwOnCount = false } = {}) => {
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'profiles') {
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: profile }) }) }) };
    }
    return {
      select: () => ({
        eq: () => ({
          eq: () => (throwOnCount ? Promise.reject(new Error('db down')) : Promise.resolve({ count })),
        }),
      }),
    };
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  planService.resolveVendorPlan.mockReturnValue('creator');
});

test('allows activation under the cap', async () => {
  planService.getPlan.mockResolvedValue({ name: 'Creator', limits: { services: 2 } });
  wire({ count: 1 });
  expect(await canActivateMore('h1', 'services')).toEqual({ ok: true });
});

test('blocks activation at the cap (403)', async () => {
  planService.getPlan.mockResolvedValue({ name: 'Creator', limits: { services: 2 } });
  wire({ count: 2 });
  const r = await canActivateMore('h1', 'services');
  expect(r.ok).toBe(false);
  expect(r.status).toBe(403);
  expect(r.message).toMatch(/limit/i);
});

test('blocks when the plan does not include the item (limit 0)', async () => {
  planService.getPlan.mockResolvedValue({ name: 'Starter', limits: { digital_products: 0 } });
  wire({ count: 0 });
  const r = await canActivateMore('h1', 'digital_products');
  expect(r.ok).toBe(false);
  expect(r.status).toBe(403);
  expect(r.message).toMatch(/not included|upgrade/i);
});

test('allows unlimited plans (limit -1) without counting', async () => {
  planService.getPlan.mockResolvedValue({ name: 'Pro', limits: { services: -1 } });
  wire({ count: 999 });
  expect(await canActivateMore('h1', 'services')).toEqual({ ok: true });
});

test('fails CLOSED on a DB error (503)', async () => {
  planService.getPlan.mockResolvedValue({ name: 'Creator', limits: { services: 2 } });
  wire({ throwOnCount: true });
  const r = await canActivateMore('h1', 'services');
  expect(r.ok).toBe(false);
  expect(r.status).toBe(503);
});
