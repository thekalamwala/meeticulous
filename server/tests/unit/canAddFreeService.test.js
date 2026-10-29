/**
 * tests/unit/canAddFreeService.test.js
 *
 * v3.54 free-service sub-cap: a host may list at most `limits.free_services`
 * ACTIVE price-0 services (Starter 2; paid tiers -1 = unlimited). canAddFreeService
 * is the shared gate for the create / activate / paid→free-edit paths.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/planService', () => ({ resolveVendorPlan: jest.fn(), getPlan: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const planService = require('../../services/planService');
const { canAddFreeService } = require('../../middleware/planMiddleware');

// The count query chains select → eq(host) → eq(is_active) → eq(price) and may
// add neq(id) when excludeId is passed. Return a thenable chain resolving {count}.
const countChain = (count, throwErr) => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    then: (resolve, reject) => (throwErr ? reject(new Error('db down')) : resolve({ count })),
  };
  return chain;
};

const wire = ({ profile = { plan: 'starter' }, count = 0, throwOnCount = false } = {}) => {
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'profiles')
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: profile }) }) }) };
    return countChain(count, throwOnCount);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  planService.resolveVendorPlan.mockReturnValue('starter');
});

test('allows a free service under the cap', async () => {
  planService.getPlan.mockResolvedValue({ name: 'Starter', limits: { free_services: 2 } });
  wire({ count: 1 });
  expect(await canAddFreeService('h1')).toEqual({ ok: true });
});

test('blocks at the free cap (403)', async () => {
  planService.getPlan.mockResolvedValue({ name: 'Starter', limits: { free_services: 2 } });
  wire({ count: 2 });
  const r = await canAddFreeService('h1');
  expect(r.ok).toBe(false);
  expect(r.status).toBe(403);
  expect(r.message).toMatch(/free service/i);
});

test('limit 0 → free services not allowed at all (403)', async () => {
  planService.getPlan.mockResolvedValue({ name: 'Starter', limits: { free_services: 0 } });
  wire({ count: 0 });
  const r = await canAddFreeService('h1');
  expect(r.ok).toBe(false);
  expect(r.status).toBe(403);
  expect(r.message).toMatch(/aren't available|upgrade|set a price/i);
});

test('paid tier (limit -1) is unlimited without counting', async () => {
  planService.resolveVendorPlan.mockReturnValue('professional');
  planService.getPlan.mockResolvedValue({ name: 'Studio', limits: { free_services: -1 } });
  wire({ count: 999 });
  expect(await canAddFreeService('h1')).toEqual({ ok: true });
});

test('absent free_services key defaults to unlimited (permissive)', async () => {
  planService.getPlan.mockResolvedValue({ name: 'Legacy', limits: {} });
  wire({ count: 999 });
  expect(await canAddFreeService('h1')).toEqual({ ok: true });
});

test('excludeId path (activate/edit) still resolves', async () => {
  planService.getPlan.mockResolvedValue({ name: 'Starter', limits: { free_services: 2 } });
  wire({ count: 1 });
  expect(await canAddFreeService('h1', { excludeId: 's1' })).toEqual({ ok: true });
});

test('fails CLOSED on a DB error (503)', async () => {
  planService.getPlan.mockResolvedValue({ name: 'Starter', limits: { free_services: 2 } });
  wire({ throwOnCount: true });
  const r = await canAddFreeService('h1');
  expect(r.ok).toBe(false);
  expect(r.status).toBe(503);
});
