'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const featureFlags = require('../../services/featureFlags');
const ctrl = require('../../controllers/couponHostController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const req = (body) => ({ user: { id: 'h1' }, body });
// insert().select().single() resolves to `result`.
const insertOk = (result) => supabaseAdmin.from.mockReturnValue({
  insert: () => ({ select: () => ({ single: () => Promise.resolve(result) }) }),
});

beforeEach(() => { jest.clearAllMocks(); featureFlags.isFeatureEnabled.mockResolvedValue(true); });

describe('createCoupon', () => {
  it('404 when the coupons flag is OFF', async () => {
    featureFlags.isFeatureEnabled.mockResolvedValue(false);
    const r = res();
    await ctrl.createCoupon(req({ code: 'SAVE20', discount_type: 'percent', discount_value: 20 }), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('400 on a bad code', async () => {
    const r = res();
    await ctrl.createCoupon(req({ code: 'no', discount_type: 'percent', discount_value: 20 }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('400 when percent > 100', async () => {
    const r = res();
    await ctrl.createCoupon(req({ code: 'SAVE', discount_type: 'percent', discount_value: 120 }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('400 on a non-positive value', async () => {
    const r = res();
    await ctrl.createCoupon(req({ code: 'SAVE', discount_type: 'flat', discount_value: 0 }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('201 on a valid coupon', async () => {
    insertOk({ data: { id: 'c1', code: 'SAVE20' }, error: null });
    const r = res();
    await ctrl.createCoupon(req({ code: 'SAVE20', discount_type: 'percent', discount_value: 20 }), r);
    expect(r.status).toHaveBeenCalledWith(201);
  });

  it('409 on a duplicate code', async () => {
    insertOk({ data: null, error: { message: 'duplicate key value violates unique constraint' } });
    const r = res();
    await ctrl.createCoupon(req({ code: 'SAVE20', discount_type: 'flat', discount_value: 50 }), r);
    expect(r.status).toHaveBeenCalledWith(409);
  });
});

describe('updateCoupon', () => {
  it('400 when active is not a boolean', async () => {
    const r = res();
    await ctrl.updateCoupon({ user: { id: 'h1' }, params: { id: 'c1' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});
