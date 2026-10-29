// Unit tests for the admin reserved-slug controller (list / create / release /
// check). Supabase + reservedSlugService are mocked; the chain helper makes any
// builder sequence resolve to a configured { data, error }.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({
  safeError: (res, e) => res.status(500).json({ message: e.message || 'error' }),
}));
jest.mock('../../services/reservedSlugService', () => ({
  checkAvailability: jest.fn(),
  bustReservedCache: jest.fn(),
}));

const { supabaseAdmin } = require('../../config/supabase');
const reservedSlugService = require('../../services/reservedSlugService');
const ctrl = require('../../controllers/reservedSlugAdminController');

// Any builder method returns the chain; awaiting it resolves `terminal`.
function makeChain(terminal) {
  const chain = {};
  for (const m of ['select', 'is', 'order', 'insert', 'update', 'eq', 'single']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.then = (resolve) => resolve(terminal);
  return chain;
}

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe('reservedSlugAdminController', () => {
  test('list returns active rows + system categories', async () => {
    supabaseAdmin.from.mockReturnValue(makeChain({ data: [{ id: 'r1', slug: 'acme' }], error: null }));
    const res = mockRes();
    await ctrl.list({}, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.reservations).toEqual([{ id: 'r1', slug: 'acme' }]);
    expect(payload.systemCategories).toHaveProperty('ROUTES');
  });

  test('list reports migrationPending when the table is missing', async () => {
    supabaseAdmin.from.mockReturnValue(makeChain({
      data: null,
      error: { message: 'relation "public.reserved_slugs" does not exist' },
    }));
    const res = mockRes();
    await ctrl.list({}, res);
    expect(res.json.mock.calls[0][0].migrationPending).toBe(true);
  });

  test('create normalizes the slug and inserts with created_by', async () => {
    const chain = makeChain({ data: { id: 'r2', slug: 'future-brand' }, error: null });
    supabaseAdmin.from.mockReturnValue(chain);
    const res = mockRes();
    await ctrl.create({ admin: { id: 'admin-1' }, body: { slug: 'Future_Brand', kind: 'premium', is_prefix: true } }, res);
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'future-brand', kind: 'premium', is_prefix: true, created_by: 'admin-1',
    }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(reservedSlugService.bustReservedCache).toHaveBeenCalled();
  });

  test('create rejects an empty/invalid slug with 400', async () => {
    const res = mockRes();
    await ctrl.create({ body: { slug: '   ' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  test('create maps a unique-violation to 409', async () => {
    supabaseAdmin.from.mockReturnValue(makeChain({ data: null, error: { code: '23505' } }));
    const res = mockRes();
    await ctrl.create({ body: { slug: 'acme' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('release soft-releases by id and busts cache', async () => {
    const chain = makeChain({ error: null });
    supabaseAdmin.from.mockReturnValue(chain);
    const res = mockRes();
    await ctrl.release({ params: { id: 'r3' } }, res);
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ released_at: expect.any(String) }));
    expect(chain.eq).toHaveBeenCalledWith('id', 'r3');
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(reservedSlugService.bustReservedCache).toHaveBeenCalled();
  });

  test('check proxies reservedSlugService and returns the reason/layer', async () => {
    reservedSlugService.checkAvailability.mockResolvedValue({ ok: false, reason: 'reserved_route', normalized: 'admin' });
    const res = mockRes();
    await ctrl.check({ params: { slug: 'Admin' } }, res);
    expect(reservedSlugService.checkAvailability).toHaveBeenCalledWith('Admin');
    expect(res.json).toHaveBeenCalledWith({ available: false, reason: 'reserved_route', normalized: 'admin' });
  });
});
