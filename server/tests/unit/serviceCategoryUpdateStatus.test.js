const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
jest.mock('../../services/responseCache', () => ({ getOrSet: (_k,_t,fn)=>fn(), bust: jest.fn() }));
jest.mock('../../utils/httpCache', () => ({ setPublicCache: jest.fn() }));
jest.mock('../../utils/sitemapCache', () => ({ bustSitemapCache: jest.fn() }));

const { update } = require('../../controllers/serviceCategoryController');
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('approve sets status=active and is_active=true', async () => {
  let applied = null;
  const c = {
    update: jest.fn((row) => { applied = row; return c; }),
    eq: jest.fn(() => c), select: jest.fn(() => c),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'sc1', status: 'active', is_active: true }, error: null }),
  };
  mockFrom.mockReturnValue(c);
  const r = res();
  await update({ params: { id: 'sc1' }, body: { status: 'active' } }, r);
  expect(applied).toMatchObject({ status: 'active', is_active: true });
});

test('reject sets status=rejected and is_active=false', async () => {
  let applied = null;
  const c = {
    update: jest.fn((row) => { applied = row; return c; }),
    eq: jest.fn(() => c), select: jest.fn(() => c),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'sc1', status: 'rejected', is_active: false }, error: null }),
  };
  mockFrom.mockReturnValue(c);
  const r = res();
  await update({ params: { id: 'sc1' }, body: { status: 'rejected' } }, r);
  expect(applied).toMatchObject({ status: 'rejected', is_active: false });
});

test('invalid status returns 400', async () => {
  const r = res();
  await update({ params: { id: 'sc1' }, body: { status: 'reject-typo' } }, r);
  expect(r.status).toHaveBeenCalledWith(400);
});

test('blocks activating a pending row via plain is_active toggle (409)', async () => {
  const c = {
    update: jest.fn(() => c), eq: jest.fn(() => c), select: jest.fn(() => c),
    maybeSingle: jest.fn().mockResolvedValue({ data: { status: 'pending' }, error: null }),
  };
  mockFrom.mockReturnValue(c);
  const r = res();
  await update({ params: { id: 'sc1' }, body: { is_active: true } }, r);
  expect(r.status).toHaveBeenCalledWith(409);
  expect(c.update).not.toHaveBeenCalled();
});
