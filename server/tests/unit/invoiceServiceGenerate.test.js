'use strict';

// Mock supabaseAdmin.rpc BEFORE requiring the service.
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { rpc: jest.fn() },
}));

const { supabaseAdmin } = require('../../config/supabase');
const { generateInvoice } = require('../../services/invoiceService');

beforeEach(() => jest.clearAllMocks());

describe('generateInvoice', () => {
  test('booking: inter-state buyer -> IGST, correct RPC args', async () => {
    const row = { id: 'inv1', invoice_number: 'BAS-BKG/26/00001' };
    supabaseAdmin.rpc.mockResolvedValue({ data: row, error: null });
    const out = await generateInvoice({
      sourceType: 'booking', sourceId: 'bk1', paymentId: 'pay_1',
      issuedAt: '2026-06-02T00:00:00Z',
      buyer: { name: 'Acme', stateCode: '27', gstin: '27ABCDE1234F1Z5' },
      taxableValue: 10, gstAmount: 1.8,
    });
    expect(out).toBe(row);
    const args = supabaseAdmin.rpc.mock.calls[0][1];
    expect(args.p_number_prefix).toBe('BAS-BKG');
    expect(args.p_fiscal_year).toBe('26');
    expect(args.p_igst).toBe(1.8);
    expect(args.p_cgst).toBe(0);
    expect(args.p_total).toBe(11.8);
    expect(args.p_place_of_supply).toBe('27');
  });

  test('subscription: Odisha buyer -> CGST+SGST', async () => {
    supabaseAdmin.rpc.mockResolvedValue({ data: { id: 'inv2' }, error: null });
    await generateInvoice({
      sourceType: 'subscription', sourceId: 'sp1', paymentId: 'pay_2',
      issuedAt: '2026-06-02T00:00:00Z',
      buyer: { name: 'Host', stateCode: '21' },
      taxableValue: 1499, gstAmount: 269.82,
    });
    const args = supabaseAdmin.rpc.mock.calls[0][1];
    expect(args.p_number_prefix).toBe('BAS-SUB');
    expect(args.p_cgst).toBe(134.91);
    expect(args.p_sgst).toBe(134.91);
    expect(args.p_igst).toBe(0);
    expect(args.p_total).toBe(1768.82);
  });

  test('returns null and never throws on RPC error', async () => {
    supabaseAdmin.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(generateInvoice({
      sourceType: 'booking', sourceId: 'bk9', buyer: { name: 'X', stateCode: '21' },
      taxableValue: 10, gstAmount: 1.8,
    })).resolves.toBeNull();
  });
});
