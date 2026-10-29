'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));
jest.mock('../../services/ledger/postingService', () => ({ post: jest.fn(() => Promise.resolve('entry-uuid')) }));

const { supabaseAdmin } = require('../../config/supabase');
const { audit } = require('../../services/auditService');
const { post } = require('../../services/ledger/postingService');
const ctrl = require('../../controllers/payoutAdminController');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
// fetchPayout: .select().eq().maybeSingle(); updates: .update().eq().eq().select().single()
const fetchChain = (row) => {
  const c = {};
  c.select = jest.fn(() => c); c.eq = jest.fn(() => c);
  c.maybeSingle = jest.fn(() => Promise.resolve({ data: row }));
  c.update = jest.fn(() => c);
  c.single = jest.fn(() => Promise.resolve({ data: { ...row, _updated: true }, error: null }));
  return c;
};
const admin = { id: 'adm1', email: 'a@x.com', role: 'finance' };
beforeEach(() => jest.clearAllMocks());

test('approve: pending -> approved, audits', async () => {
  supabaseAdmin.from.mockReturnValue(fetchChain({ id: 'p1', status: 'pending', host_id: 'h1', amount: 500 }));
  const res = mockRes();
  await ctrl.approvePayout({ params: { id: 'p1' }, admin }, res);
  expect(res.json).toHaveBeenCalled();
  expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'payout.approve' }));
});

test('approve: non-pending -> 409', async () => {
  supabaseAdmin.from.mockReturnValue(fetchChain({ id: 'p1', status: 'approved', host_id: 'h1', amount: 500 }));
  const res = mockRes();
  await ctrl.approvePayout({ params: { id: 'p1' }, admin }, res);
  expect(res.status).toHaveBeenCalledWith(409);
});

test('reject: requires a reason', async () => {
  const res = mockRes();
  await ctrl.rejectPayout({ params: { id: 'p1' }, admin, body: {} }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('pay: requires a payment reference', async () => {
  const res = mockRes();
  await ctrl.markPayoutPaid({ params: { id: 'p1' }, admin, body: {} }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(post).not.toHaveBeenCalled();
});

test('pay: approved -> posts SETTLEMENT once then marks paid', async () => {
  supabaseAdmin.from.mockReturnValue(fetchChain({ id: 'p1', status: 'approved', host_id: 'h1', amount: 500 }));
  const res = mockRes();
  await ctrl.markPayoutPaid({ params: { id: 'p1' }, admin, body: { payment_reference: 'UTR9' } }, res);
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'SETTLEMENT', sourceId: 'p1', createdBy: 'adm1' }));
  expect(res.json).toHaveBeenCalled();
});

test('pay: non-approved -> 409, no ledger post', async () => {
  supabaseAdmin.from.mockReturnValue(fetchChain({ id: 'p1', status: 'pending', host_id: 'h1', amount: 500 }));
  const res = mockRes();
  await ctrl.markPayoutPaid({ params: { id: 'p1' }, admin, body: { payment_reference: 'UTR9' } }, res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(post).not.toHaveBeenCalled();
});

// Security audit M-3: segregation of duties on payouts.
test('pay: the admin who approved cannot also release (SoD) -> 403, no post', async () => {
  supabaseAdmin.from.mockReturnValue(fetchChain({ id: 'p1', status: 'approved', host_id: 'h1', amount: 500, approved_by: 'adm1' }));
  const res = mockRes();
  await ctrl.markPayoutPaid({ params: { id: 'p1' }, admin, body: { payment_reference: 'UTR9' } }, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(post).not.toHaveBeenCalled();
});

test('pay: a different admin may release a payout approved by someone else', async () => {
  supabaseAdmin.from.mockReturnValue(fetchChain({ id: 'p1', status: 'approved', host_id: 'h1', amount: 500, approved_by: 'adm2' }));
  const res = mockRes();
  await ctrl.markPayoutPaid({ params: { id: 'p1' }, admin, body: { payment_reference: 'UTR9' } }, res);
  expect(post).toHaveBeenCalledTimes(1);
  expect(res.json).toHaveBeenCalled();
});
