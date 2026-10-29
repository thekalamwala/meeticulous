const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
jest.mock('../../services/responseCache', () => ({
  getOrSet: (_k, _ttl, fn) => fn(), bust: jest.fn(),
}));
jest.mock('../../utils/httpCache', () => ({ setPublicCache: jest.fn() }));
jest.mock('../../utils/sitemapCache', () => ({ bustSitemapCache: jest.fn() }));

const { listPublic } = require('../../controllers/serviceCategoryController');
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('listPublic filters status=active and returns allow_suggestions', async () => {
  const scChain = {
    select: jest.fn(() => scChain), eq: jest.fn(() => scChain), order: jest.fn(() => scChain),
    then: undefined,
  };
  scChain.order.mockImplementation(function () { return scChain; });
  const scResult = { data: [{ id: 's1', name: 'Web Dev', slug: 'web-dev', primary_category: 'x' }], error: null };
  Object.assign(scChain, { then: (resolve) => resolve(scResult) });

  const catChain = {
    select: jest.fn(() => catChain), eq: jest.fn(() => catChain),
    maybeSingle: jest.fn().mockResolvedValue({ data: { allow_subcategory_suggestions: true }, error: null }),
  };

  mockFrom.mockImplementation((table) => (table === 'categories' ? catChain : scChain));

  const r = res();
  await listPublic({ query: { primary: 'x' } }, r);

  expect(scChain.eq).toHaveBeenCalledWith('status', 'active');
  const payload = r.json.mock.calls[0][0];
  expect(payload.allow_suggestions).toBe(true);
  expect(payload.categories).toHaveLength(1);
});
