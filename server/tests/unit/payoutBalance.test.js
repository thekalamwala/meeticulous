'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
const { supabaseAdmin } = require('../../config/supabase');
const platformConfig = require('../../services/platformConfig');
const ctrl = require('../../controllers/vendorController');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const chain = (result) => {
  const c = {};
  for (const m of ['select', 'eq', 'order']) c[m] = jest.fn(() => c);
  c.then = (resolve) => resolve(result);
  // kyc_submissions is read via .maybeSingle(); a single row (non-array data) resolves
  // as-is, anything else resolves to no row.
  c.maybeSingle = () => Promise.resolve(result.data && !Array.isArray(result.data) ? result : { data: null });
  return c;
};
const KYC_APPROVED = { data: { status: 'approved' } };

const NOW = Date.now();
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  platformConfig.getConfig.mockResolvedValue({ clearingDays: 7 });
});

test('getPayoutBalance gates available on completion + clearing window', async () => {
  supabaseAdmin.from.mockImplementation((t) => {
    if (t === 'bookings') return chain({ data: [
      { vendor_amount: 1000, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid' },
      { vendor_amount: 300, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(2), payment_status: 'paid' },
      { vendor_amount: 200, settlement_status: 'pending_completion', completed_at: null, payment_status: 'paid' },
    ] });
    if (t === 'payout_requests') return chain({ data: [{ amount: 100, status: 'paid' }] });
    if (t === 'kyc_submissions') return chain(KYC_APPROVED);
    return chain({ data: [] });
  });
  const res = mockRes();
  await ctrl.getPayoutBalance({ user: { id: 'h1' } }, res);
  const body = res.json.mock.calls[0][0];
  expect(body.available).toBe(900);
  expect(body.clearing).toBe(300);
  expect(body.pendingCompletion).toBe(200);
  expect(body.paidOut).toBe(100);
  expect(body.heldForKyc).toBe(0);
  expect(body.payoutsBlocked).toBe(false);
});

test('non-KYC host: matured funds are HELD (available→0, heldForKyc set, payouts blocked)', async () => {
  supabaseAdmin.from.mockImplementation((t) => {
    if (t === 'bookings') return chain({ data: [
      { vendor_amount: 1000, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid' },
    ] });
    if (t === 'payout_requests') return chain({ data: [] });
    if (t === 'kyc_submissions') return chain({ data: null }); // no KYC on file
    return chain({ data: [] });
  });
  const res = mockRes();
  await ctrl.getPayoutBalance({ user: { id: 'h1' } }, res);
  const body = res.json.mock.calls[0][0];
  expect(body.available).toBe(0);        // not offered for withdrawal
  expect(body.heldForKyc).toBe(1000);    // held, waiting on verification
  expect(body.payoutsBlocked).toBe(true);
});

test('pending KYC (not yet approved) still holds matured funds', async () => {
  supabaseAdmin.from.mockImplementation((t) => {
    if (t === 'bookings') return chain({ data: [
      { vendor_amount: 500, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid' },
    ] });
    if (t === 'payout_requests') return chain({ data: [] });
    if (t === 'kyc_submissions') return chain({ data: { status: 'pending' } });
    return chain({ data: [] });
  });
  const res = mockRes();
  await ctrl.getPayoutBalance({ user: { id: 'h1' } }, res);
  const body = res.json.mock.calls[0][0];
  expect(body.available).toBe(0);
  expect(body.heldForKyc).toBe(500);
  expect(body.payoutsBlocked).toBe(true);
});
