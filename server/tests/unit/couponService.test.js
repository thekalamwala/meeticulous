'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn(), rpc: jest.fn() } }));
const { supabaseAdmin } = require('../../config/supabase');
const svc = require('../../services/couponService');

// A chain whose maybeSingle() resolves to `row`.
const coupon = (row) => {
  supabaseAdmin.from.mockReturnValue({
    select: () => ({ eq: () => ({ ilike: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }) }),
  });
};

describe('couponService.computeDiscount', () => {
  it('percent: 20% of ₹1000 = ₹200', () => {
    expect(svc.computeDiscount({ discount_type: 'percent', discount_value: 20 }, 1000)).toBe(200);
  });
  it('flat: ₹150 off ₹1000', () => {
    expect(svc.computeDiscount({ discount_type: 'flat', discount_value: 150 }, 1000)).toBe(150);
  });
  it('never exceeds the price (flat > price)', () => {
    expect(svc.computeDiscount({ discount_type: 'flat', discount_value: 5000 }, 1000)).toBe(1000);
  });
});

describe('couponService.validate', () => {
  const base = { id: 'c1', code: 'SAVE20', discount_type: 'percent', discount_value: 20, active: true, times_redeemed: 0, min_amount: 0 };

  it('ok for a valid active code → discount computed', async () => {
    coupon({ ...base });
    const r = await svc.validate('save20', { hostId: 'h1', servicePrice: 1000 });
    expect(r.ok).toBe(true);
    expect(r.discount).toBe(200);
  });

  it('rejects an unknown code', async () => {
    coupon(null);
    const r = await svc.validate('NOPE', { hostId: 'h1', servicePrice: 1000 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/invalid/i);
  });

  it('rejects an inactive code', async () => {
    coupon({ ...base, active: false });
    expect((await svc.validate('SAVE20', { hostId: 'h1', servicePrice: 1000 })).ok).toBe(false);
  });

  it('rejects an expired code', async () => {
    coupon({ ...base, expires_at: new Date(Date.now() - 86400000).toISOString() });
    const r = await svc.validate('SAVE20', { hostId: 'h1', servicePrice: 1000 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/expired/i);
  });

  it('rejects when the redemption limit is reached', async () => {
    coupon({ ...base, max_redemptions: 5, times_redeemed: 5 });
    expect((await svc.validate('SAVE20', { hostId: 'h1', servicePrice: 1000 })).ok).toBe(false);
  });

  it('rejects below min_amount', async () => {
    coupon({ ...base, min_amount: 2000 });
    const r = await svc.validate('SAVE20', { hostId: 'h1', servicePrice: 1000 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/₹2000 or more/i);
  });

  it('rejects a free (₹0) service', async () => {
    const r = await svc.validate('SAVE20', { hostId: 'h1', servicePrice: 0 });
    expect(r.ok).toBe(false);
  });

  it('rejects an empty code', async () => {
    expect((await svc.validate('', { hostId: 'h1', servicePrice: 1000 })).ok).toBe(false);
  });
});
