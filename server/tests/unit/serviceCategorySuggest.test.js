const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
jest.mock('../../services/responseCache', () => ({ getOrSet: (_k,_t,fn)=>fn(), bust: jest.fn() }));
jest.mock('../../utils/httpCache', () => ({ setPublicCache: jest.fn() }));
jest.mock('../../utils/sitemapCache', () => ({ bustSitemapCache: jest.fn() }));

const { suggest } = require('../../controllers/serviceCategoryController');
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

// Helper: build a from() router keyed by table with per-table stubs.
const wire = ({ category, profile, dupe = null, maxOrder = null, inserted, count = 0 }) => {
  mockFrom.mockImplementation((table) => {
    if (table === 'categories') {
      const c = { select: () => c, eq: () => c, maybeSingle: () => Promise.resolve({ data: category, error: null }) };
      return c;
    }
    if (table === 'profiles') {
      const c = { select: () => c, eq: () => c, maybeSingle: () => Promise.resolve({ data: profile, error: null }) };
      return c;
    }
    // service_categories: used for count, dupe check, max order, insert
    // The count query chains .eq() after .select(..., {head:true}) and is
    // awaited directly (no maybeSingle/single) — so the chain itself must be
    // thenable, resolving to { count }, while still supporting further .eq().
    const countChain = {
      eq: () => countChain,
      then: (resolve) => resolve({ count, error: null }),
    };
    const c = {
      select: jest.fn((..._args) => {
        const opts = _args[1];
        if (opts && opts.head) return countChain;
        return c;
      }),
      eq: jest.fn(() => c), order: jest.fn(() => c), limit: jest.fn(() => c),
      maybeSingle: jest.fn()
        .mockResolvedValueOnce({ data: dupe, error: null })       // dupe check
        .mockResolvedValueOnce({ data: maxOrder, error: null }),  // max order
      insert: jest.fn(() => c),
      single: jest.fn().mockResolvedValue({ data: inserted, error: null }),
    };
    c.then = undefined;
    return c;
  });
};

test('rejects when profession is not opted in', async () => {
  wire({ category: { slug: 'x', allow_subcategory_suggestions: false }, profile: { primary_category: 'x' } });
  const r = res();
  await suggest({ user: { id: 'h1' }, body: { primary_category: 'x', name: 'New Thing' } }, r);
  expect(r.status).toHaveBeenCalledWith(403);
});

test('rejects when host is not in the profession', async () => {
  wire({ category: { slug: 'x', allow_subcategory_suggestions: true }, profile: { primary_category: 'y' } });
  const r = res();
  await suggest({ user: { id: 'h1' }, body: { primary_category: 'x', name: 'New Thing' } }, r);
  expect(r.status).toHaveBeenCalledWith(403);
});

test('creates a pending suggestion (201) when opted in and host matches', async () => {
  const inserted = {
    id: 'sc1', primary_category: 'x', name: 'New Thing', slug: 'new-thing',
    display_order: 0, is_active: false, status: 'pending', suggested_by: 'h1',
  };
  wire({
    category: { slug: 'x', allow_subcategory_suggestions: true },
    profile: { primary_category: 'x' },
    dupe: null,
    maxOrder: null,
    inserted,
    count: 0,
  });
  const r = res();
  await suggest({ user: { id: 'h1' }, body: { primary_category: 'x', name: 'New Thing' } }, r);
  expect(r.status).toHaveBeenCalledWith(201);
  expect(r.json).toHaveBeenCalledWith(inserted);
});
