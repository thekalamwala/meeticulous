/**
 * tests/unit/catalogOrder.test.js — host-set catalog order (v3.227) and the
 * guest price shown on the Kept Catalog.
 *
 * Fixture amounts are deliberately non-statutory (fee 40, GST rate 0.25) — the
 * real fee/GST config is asserted elsewhere; this only proves guestPrice feeds
 * the same pricingEngine calls checkout uses, with the same inputs.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../services/paidMode', () => ({ feeOnlyForHost: jest.fn() }));
jest.mock('../../services/planService', () => ({ getPlan: jest.fn(), resolveVendorPlan: jest.fn((p) => p.plan || 'free') }));

const { supabaseAdmin } = require('../../config/supabase');
const platformConfig = require('../../services/platformConfig');
const { feeOnlyForHost } = require('../../services/paidMode');
const {
  compareHostOrder, sortHostOrder, applyHostOrder, parseReorder, makeReorderHandler, MAX_IDS,
} = require('../../services/catalogOrder');
const planService = require('../../services/planService');
const { guestPrice, serviceGuestPrice, serviceHostEarnings, withGuestPrices } = require('../../services/guestPrice');
const { computeBreakdown } = require('../../lib/pricingEngine');

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

beforeEach(() => jest.clearAllMocks());

describe('host order', () => {
  test('placed rows first by sort_order, unplaced after them newest first', () => {
    const rows = [
      { id: 'a', sort_order: null, created_at: '2026-01-01' },
      { id: 'b', sort_order: 2, created_at: '2026-01-02' },
      { id: 'c', sort_order: null, created_at: '2026-03-01' },
      { id: 'd', sort_order: 1, created_at: '2025-12-01' },
    ];
    expect(sortHostOrder(rows).map((r) => r.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  test('with nothing placed it is exactly newest-first (today\'s order)', () => {
    const rows = [{ id: 'x', created_at: '2026-01-01' }, { id: 'y', created_at: '2026-02-01' }];
    expect(sortHostOrder(rows).map((r) => r.id)).toEqual(['y', 'x']);
    expect(compareHostOrder({ sort_order: undefined }, { sort_order: undefined })).toBe(0);
  });

  test('applyHostOrder leaves rows as they came when the column is missing', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'column services.sort_order does not exist' } }) }),
    });
    const rows = [{ id: 'p' }, { id: 'q' }];
    expect(await applyHostOrder('services', 'h', rows)).toBe(rows);
  });

  test('applyHostOrder sorts public rows by the host\'s ranks', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [{ id: 'p', sort_order: 2 }, { id: 'q', sort_order: 1 }, { id: 'r', sort_order: null }], error: null }) }),
    });
    const out = await applyHostOrder('products', 'h', [{ id: 'r' }, { id: 'p' }, { id: 'q' }]);
    expect(out.map((r) => r.id)).toEqual(['q', 'p', 'r']);
  });
});

describe('parseReorder', () => {
  test.each([
    [undefined], [{}], [{ ids: [] }], [{ ids: 'x' }], [{ ids: ['not-a-uuid'] }], [{ ids: [U(1), U(1)] }],
    [{ ids: Array.from({ length: MAX_IDS + 1 }, (_, i) => U(i)) }],
  ])('rejects %j', (body) => {
    expect(parseReorder(body).error).toBeTruthy();
  });
  test('accepts unique uuids', () => {
    expect(parseReorder({ ids: [U(1), U(2)] })).toEqual({ ids: [U(1), U(2)] });
  });
});

describe('PUT /reorder handler', () => {
  const mockDb = ({ owned, updateError = null }) => {
    const updates = [];
    supabaseAdmin.from.mockImplementation(() => ({
      select: () => ({ eq: (col, val) => ({ in: () => Promise.resolve({ data: owned.map((id) => ({ id })), error: null, _host: val }) }) }),
      update: (u) => ({ eq: (c1, id) => ({ eq: (c2, host) => { updates.push({ ...u, id, host }); return Promise.resolve({ error: updateError }); } }) }),
    }));
    return updates;
  };

  test('writes 1-based sort_order on the host\'s own rows, scoped by host_id', async () => {
    const updates = mockDb({ owned: [U(1), U(2)] });
    const onSaved = jest.fn();
    const r = res();
    await makeReorderHandler('services', { onSaved })({ body: { ids: [U(2), U(1)] }, user: { id: 'host-1' } }, r);
    expect(updates).toEqual([
      { sort_order: 1, id: U(2), host: 'host-1' },
      { sort_order: 2, id: U(1), host: 'host-1' },
    ]);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(r.json).toHaveBeenCalledWith({ ok: true, ids: [U(2), U(1)] });
  });

  test('writes nothing when any id is not the host\'s', async () => {
    const updates = mockDb({ owned: [U(1)] });
    const r = res();
    await makeReorderHandler('products')({ body: { ids: [U(1), U(9)] }, user: { id: 'host-1' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(updates).toEqual([]);
  });

  test('answers 409 before the migration is applied', async () => {
    mockDb({ owned: [U(1)], updateError: { message: 'Could not find the \'sort_order\' column of \'courses\'' } });
    const r = res();
    await makeReorderHandler('courses')({ body: { ids: [U(1)] }, user: { id: 'host-1' } }, r);
    expect(r.status).toHaveBeenCalledWith(409);
  });

  test('400 on a bad body, without touching the DB', async () => {
    const r = res();
    await makeReorderHandler('services')({ body: { ids: ['x'] }, user: { id: 'host-1' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });
});

describe('guest price (display only, same engine as checkout)', () => {
  const cfg = { platformFee: 40, gstRate: 0.25 };

  test('matches computeBreakdown.customerTotal for a paid service', () => {
    const b = computeBreakdown({ servicePrice: 1000, commissionPercentage: 0, platformFee: 40, gstRate: 0.25 });
    expect(serviceGuestPrice({ price: 1000 }, cfg, false).guest_total).toBe(b.customerTotal);
  });

  test('free service: no fee in paid mode, the fee under fee-only mode', () => {
    expect(serviceGuestPrice({ price: 0 }, cfg, false)).toEqual({ guest_total: 0, booking_fee: 0 });
    const b = computeBreakdown({ servicePrice: 0, commissionPercentage: 0, platformFee: 40, gstRate: 0.25, chargeFeeOnFree: true });
    expect(serviceGuestPrice({ price: 0 }, cfg, true).guest_total).toBe(b.customerTotal);
    expect(serviceGuestPrice({ price: 0 }, cfg, true).booking_fee).toBe(40); // the fee is GST-inclusive (pricing v2)
  });

  test('price on request is a ₹0 enquiry with no fee, even in fee-only mode', () => {
    expect(serviceGuestPrice({ price: 2000, price_on_request: true }, cfg, true)).toEqual({ guest_total: 0, booking_fee: 0 });
  });

  test('guestPrice: price + the GST-inclusive fee; free carries nothing', () => {
    expect(guestPrice(300, cfg)).toEqual({ guest_total: 340, booking_fee: 40 });
    expect(guestPrice(0, cfg)).toEqual({ guest_total: 0, booking_fee: 0 });
  });

  test('products/courses carry no platform fee — the guest pays the listed price (pricing v2)', async () => {
    platformConfig.getConfig.mockResolvedValue(cfg);
    for (const kind of ['product', 'course']) {
      const [row] = await withGuestPrices([{ id: 'p', price: 300 }], kind, 'h');
      expect(row).toMatchObject({ guest_total: 300, booking_fee: 0 });
    }
  });

  test('withGuestPrices adds the fields, and leaves rows alone if config fails', async () => {
    platformConfig.getConfig.mockResolvedValue(cfg);
    feeOnlyForHost.mockResolvedValue(true);
    const out = await withGuestPrices([{ id: 's', price: 0 }], 'service', 'h');
    expect(out[0]).toMatchObject({ id: 's', guest_total: 40, booking_fee: 40 });

    platformConfig.getConfig.mockRejectedValue(new Error('down'));
    const rows = [{ id: 'p', price: 10 }];
    expect(await withGuestPrices(rows, 'product', 'h')).toBe(rows);
  });

  // "You'll get" — price less commission only. Rates here are made up (7%, 0%);
  // the real ones come from subscription_plans.commission_percentage.
  test('host earnings: price less commission at the plan rate, nothing else', () => {
    expect(serviceHostEarnings({ price: 1000 }, 7)).toEqual({ host_earnings: 930 });
    expect(serviceHostEarnings({ price: 1000 }, 0)).toEqual({ host_earnings: 1000 });
    expect(serviceHostEarnings({ price: 0 }, 7)).toEqual({ host_earnings: 0 });
    expect(serviceHostEarnings({ price: 999, price_on_request: true }, 7)).toEqual({ host_earnings: null });
  });

  test('withGuestPrices reads the commission from the host plan row; a failed read drops only host_earnings', async () => {
    platformConfig.getConfig.mockResolvedValue(cfg);
    feeOnlyForHost.mockResolvedValue(false);
    const maybeSingle = jest.fn().mockResolvedValue({ data: { plan: 'pro_x', plan_expires_at: null } });
    supabaseAdmin.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) });
    planService.getPlan.mockResolvedValue({ commission_percentage: 7 });
    const [row] = await withGuestPrices([{ id: 's', price: 1000 }], 'service', 'h');
    expect(planService.getPlan).toHaveBeenCalledWith('pro_x');
    expect(row).toMatchObject({ host_earnings: 930, guest_total: 1040 });

    planService.getPlan.mockRejectedValue(new Error('down'));
    const [row2] = await withGuestPrices([{ id: 's', price: 1000 }], 'service', 'h');
    expect(row2.guest_total).toBe(1040);
    expect(row2).not.toHaveProperty('host_earnings');

    const [prod] = await withGuestPrices([{ id: 'p', price: 300 }], 'product', 'h');
    expect(prod).not.toHaveProperty('host_earnings');
  });
});
