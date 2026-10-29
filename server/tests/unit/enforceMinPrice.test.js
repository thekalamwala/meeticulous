// Unit tests for planMiddleware.enforceMinPrice — the ₹100 minimum-price gate for
// paid services on the self-serve plans (Supreme exempt; ₹0 free always allowed).

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/planService', () => ({
  resolveVendorPlan: jest.fn(),
  getPlan: jest.fn(),
  FREE_PLAN: 'free',
  // enforceMinPrice exempts the comped internal tiers (Supreme) via this helper.
  isCompedSlug: (s) => s === 'supreme',
}));

const { enforceMinPrice, MIN_SERVICE_PRICE } = require('../../middleware/planMiddleware');

const run = (vendorPlan, price) => {
  const req = { vendorPlan, body: price === undefined ? {} : { price } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  enforceMinPrice(req, res, next);
  return { res, next };
};

test('MIN_SERVICE_PRICE is ₹100', () => {
  expect(MIN_SERVICE_PRICE).toBe(100);
});

test.each(['starter', 'creator', 'professional'])('blocks a sub-₹100 paid price on %s', (plan) => {
  const { res, next } = run(plan, 50);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ min_price: 100 }));
  expect(next).not.toHaveBeenCalled();
});

test('allows exactly ₹100', () => {
  const { res, next } = run('starter', 100);
  expect(next).toHaveBeenCalled();
  expect(res.status).not.toHaveBeenCalled();
});

test('allows a price above ₹100', () => {
  const { next } = run('creator', 1999);
  expect(next).toHaveBeenCalled();
});

test('allows a free (₹0) service on a non-Supreme plan', () => {
  const { res, next } = run('starter', 0);
  expect(next).toHaveBeenCalled();
  expect(res.status).not.toHaveBeenCalled();
});

test('Supreme is exempt — a ₹1 paid service passes', () => {
  const { res, next } = run('supreme', 1);
  expect(next).toHaveBeenCalled();
  expect(res.status).not.toHaveBeenCalled();
});

test('skips when the body carries no price (partial update)', () => {
  const { res, next } = run('starter', undefined);
  expect(next).toHaveBeenCalled();
  expect(res.status).not.toHaveBeenCalled();
});

test('defaults to the restrictive path when vendorPlan is missing', () => {
  const { res, next } = run(undefined, 50);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(next).not.toHaveBeenCalled();
});
