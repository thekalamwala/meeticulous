/**
 * Pricing v2 / acceptance test 13 (founder ruling 2026-11-27: Starter = 1 category).
 * PUT /api/host/categories is capped by limits.categories, primary included. Going
 * over the cap is a 403 the client can turn into an upgrade prompt.
 */
jest.mock('../../services/responseCache', () => ({ getOrSet: (_k, _t, p) => p(), bust: () => 0, clear: () => 0, _size: () => 0 }));
jest.mock('../../services/planService', () => ({
  FREE_PLAN: 'free',
  getLimit: jest.fn(async (plan) => (plan === 'free' ? 1 : -1)),
}));
let mockUpdated;
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn((table) => {
      if (table === 'categories') {
        return { select: () => ({ eq: async () => ({ data: [{ slug: 'yoga' }, { slug: 'fitness' }, { slug: 'nutrition' }], error: null }) }) };
      }
      const chain = {
        update: (u) => { mockUpdated = u; return chain; },
        select: () => chain, eq: () => chain,
        // Same primary before and after → no service-category clearing in these tests.
        single: async () => ({ data: { primary_category: 'yoga', ...mockUpdated }, error: null }),
        then: (res) => res({ data: null, error: null }),
      };
      return chain;
    }),
  },
}));

const { updateCategories } = require('../../controllers/hostController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const call = (vendorPlan, categories) => {
  const r = res();
  return updateCategories({ user: { id: 'h1' }, vendorPlan, body: { primary_category: categories[0], categories } }, r).then(() => r);
};

beforeEach(() => { mockUpdated = undefined; });

test('Starter: a 2nd category → 403 upgrade_required, nothing saved', async () => {
  const r = await call('free', ['yoga', 'fitness']);
  expect(r.status).toHaveBeenCalledWith(403);
  expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ upgrade_required: true }));
  expect(mockUpdated).toBeUndefined();
});

test('Starter: the primary category alone is saved', async () => {
  const r = await call('free', ['yoga']);
  expect(r.status).not.toHaveBeenCalled();
  expect(mockUpdated.categories).toEqual(['yoga']);
});

test('Pro: unlimited categories are saved', async () => {
  const r = await call('premium', ['yoga', 'fitness', 'nutrition']);
  expect(r.status).not.toHaveBeenCalled();
  expect(mockUpdated.categories).toEqual(['yoga', 'fitness', 'nutrition']);
  expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ services_cleared: 0 }));
});
