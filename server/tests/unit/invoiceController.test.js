'use strict';
const mockSingle = jest.fn();
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockSingle }) }) }) },
}));
const { getInvoice } = require('../../controllers/invoiceController');

const mkRes = () => { const r = {}; r.status = (c) => { r.code = c; return r; };
  r.set = () => r; r.send = (b) => { r.body = b; return r; }; r.json = (j) => { r.body = j; return r; }; return r; };

beforeEach(() => mockSingle.mockReset());

test('403 when token does not match', async () => {
  mockSingle.mockResolvedValue({ data: { id: 'i1', access_token: 'good' }, error: null });
  const res = mkRes();
  await getInvoice({ params: { id: 'i1' }, query: { token: 'bad' } }, res);
  expect(res.code).toBe(403);
});

test('404 when not found', async () => {
  mockSingle.mockResolvedValue({ data: null, error: null });
  const res = mkRes();
  await getInvoice({ params: { id: 'x' }, query: { token: 't' } }, res);
  expect(res.code).toBe(404);
});

test('200 HTML when token matches', async () => {
  mockSingle.mockResolvedValue({ data: {
    id: 'i1', access_token: 'good', invoice_number: 'BAS-SUB/26/00001', source_type: 'subscription',
    buyer_name: 'X', taxable_value: 1499, igst: 269.82, cgst: 0, sgst: 0, total: 1768.82,
    issued_at: '2026-06-02T00:00:00Z', sac_code: '998314', place_of_supply: '27', seller_snapshot: {},
  }, error: null });
  const res = mkRes();
  await getInvoice({ params: { id: 'i1' }, query: { token: 'good' } }, res);
  expect(res.body).toContain('BAS-SUB/26/00001');
});
