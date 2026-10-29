'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../services/settlementService', () => ({ computeSettlementBalance: jest.fn() }));
const { supabaseAdmin } = require('../../config/supabase');
const platformConfig = require('../../services/platformConfig');
const { computeSettlementBalance } = require('../../services/settlementService');
const ctrl = require('../../controllers/vendorController');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const insertChain = (result) => {
  const c = {};
  c.insert = jest.fn(() => c); c.select = jest.fn(() => c); c.single = () => Promise.resolve(result);
  return c;
};
// KYC read: from('kyc_submissions').select('status').eq('user_id', id).maybeSingle()
const kycChain = (status) => {
  const c = {};
  c.select = jest.fn(() => c); c.eq = jest.fn(() => c);
  c.maybeSingle = () => Promise.resolve({ data: status ? { status } : null });
  return c;
};
// Payout requests now also read KYC first — dispatch by table so both are stubbed.
const dispatch = (kyc, payoutResult) => (t) =>
  (t === 'kyc_submissions' ? kycChain(kyc) : insertChain(payoutResult));

beforeEach(() => {
  jest.clearAllMocks();
  platformConfig.getConfig.mockResolvedValue({ clearingDays: 7 });
  // Default: KYC approved, so pre-KYC tests exercise the balance/insert logic.
  supabaseAdmin.from.mockImplementation(dispatch('approved', { data: null, error: null }));
});

test('rejects amount above available', async () => {
  computeSettlementBalance.mockResolvedValue({ available: 100 });
  const res = mockRes();
  await ctrl.requestPayout({ user: { id: 'h1' }, body: { amount: 500 } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json.mock.calls[0][0].message).toMatch(/exceed/i);
});

test('rejects amount below minimum 1', async () => {
  computeSettlementBalance.mockResolvedValue({ available: 1000 });
  const res = mockRes();
  await ctrl.requestPayout({ user: { id: 'h1' }, body: { amount: 0.5 } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('blocks withdrawal when KYC is not approved (server-side gate)', async () => {
  computeSettlementBalance.mockResolvedValue({ available: 1000 });
  supabaseAdmin.from.mockImplementation(dispatch(null, { data: null, error: null })); // no KYC row
  const res = mockRes();
  await ctrl.requestPayout({ user: { id: 'h1' }, body: { amount: 500 } }, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json.mock.calls[0][0].message).toMatch(/KYC/i);
});

test('accepts valid amount within available', async () => {
  computeSettlementBalance.mockResolvedValue({ available: 1000 });
  supabaseAdmin.from.mockImplementation(dispatch('approved', { data: { id: 'p1', amount: 500 }, error: null }));
  const res = mockRes();
  await ctrl.requestPayout({ user: { id: 'h1' }, body: { amount: 500, notes: 'upi' } }, res);
  expect(res.status).toHaveBeenCalledWith(201);
});

test('TOCTOU: a concurrent second request (unique-index 23505) is rejected with 409, not double-created', async () => {
  computeSettlementBalance.mockResolvedValue({ available: 1000 });
  supabaseAdmin.from.mockImplementation(dispatch('approved', { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "payout_requests_one_open_per_host"' } }));
  const res = mockRes();
  await ctrl.requestPayout({ user: { id: 'h1' }, body: { amount: 500 } }, res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json.mock.calls[0][0].message).toMatch(/already have a payout request/i);
});

test('a non-unique DB error still surfaces as a 500 (not masked as 409)', async () => {
  computeSettlementBalance.mockResolvedValue({ available: 1000 });
  supabaseAdmin.from.mockImplementation(dispatch('approved', { data: null, error: { code: '42P01', message: 'relation does not exist' } }));
  const res = mockRes();
  await ctrl.requestPayout({ user: { id: 'h1' }, body: { amount: 500 } }, res);
  expect(res.status).toHaveBeenCalledWith(500);
});
