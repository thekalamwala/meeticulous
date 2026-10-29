/**
 * gstMatrix.test.js — the GST determination matrix for BAS's own supplies.
 * Proves, end to end through generateInvoice, that the place of supply drives
 * CGST/SGST (intra-Odisha) vs IGST (inter-state) correctly across states, that a
 * typed state NAME resolves the same as its code, that a missing state falls back
 * to the seller state (lawful supplier-location default), and that a GSTIN's state
 * overrides a mismatched typed state. Also covers stateService.normalizeBilling
 * (the server-authoritative validator the checkouts call).
 */
'use strict';

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { rpc: jest.fn() } }));

const { supabaseAdmin } = require('../../config/supabase');
const { generateInvoice } = require('../../services/invoiceService');
const stateService = require('../../services/stateService');

beforeEach(() => {
  jest.clearAllMocks();
  supabaseAdmin.rpc.mockResolvedValue({ data: { id: 'inv' }, error: null });
});

// Run one platform-fee invoice (taxable ₹10, GST ₹1.80) for a buyer and return
// the RPC args the invoice would be minted with.
async function mintBookingFor(buyer) {
  await generateInvoice({
    sourceType: 'booking', sourceId: 'bk', paymentId: 'pay',
    issuedAt: '2026-06-02T00:00:00Z', buyer, taxableValue: 10, gstAmount: 1.8,
  });
  return supabaseAdmin.rpc.mock.calls[0][1];
}

describe('platform-fee GST matrix — POS drives the tax heads', () => {
  // seller is Odisha (21): only an Odisha buyer is intra-state (CGST+SGST).
  const INTER = [
    ['Maharashtra', '27'], ['Karnataka', '29'], ['Delhi', '07'],
    ['Tamil Nadu', '33'], ['West Bengal', '19'], ['Ladakh', '38'],
    ['Andhra Pradesh', '37'], ['Gujarat', '24'],
  ];

  test('Odisha buyer → CGST + SGST, no IGST (intra-state)', async () => {
    const args = await mintBookingFor({ name: 'A', stateCode: '21' });
    expect(args.p_place_of_supply).toBe('21');
    expect(args.p_cgst).toBe(0.9);
    expect(args.p_sgst).toBe(0.9);
    expect(args.p_igst).toBe(0);
  });

  test.each(INTER)('%s (%s) buyer → IGST only (inter-state)', async (name, code) => {
    const args = await mintBookingFor({ name: 'A', stateCode: code });
    expect(args.p_place_of_supply).toBe(code);
    expect(args.p_igst).toBe(1.8);
    expect(args.p_cgst).toBe(0);
    expect(args.p_sgst).toBe(0);
  });

  test('typed state NAME resolves identically to its code (booking-flow gap fix)', async () => {
    const args = await mintBookingFor({ name: 'A', stateName: 'Maharashtra' });
    expect(args.p_place_of_supply).toBe('27');
    expect(args.p_igst).toBe(1.8);
  });

  test('missing state → seller state (21), CGST+SGST (lawful supplier default)', async () => {
    const args = await mintBookingFor({ name: 'A' });
    expect(args.p_place_of_supply).toBe('21');
    expect(args.p_cgst).toBe(0.9);
    expect(args.p_igst).toBe(0);
  });

  test('GSTIN state overrides a mismatched typed state', async () => {
    const args = await mintBookingFor({ name: 'A', gstin: '29AAAAA0000A1Z5', stateCode: '21' });
    expect(args.p_place_of_supply).toBe('29'); // Karnataka from GSTIN, not the typed 21
    expect(args.p_igst).toBe(1.8);
  });

  test('every one of the 36 states/UTs is mintable and splits correctly', async () => {
    for (const st of stateService.STATES_FOR_CLIENT) {
      supabaseAdmin.rpc.mockClear();
      const args = await mintBookingFor({ name: 'A', stateCode: st.code });
      expect(args.p_place_of_supply).toBe(st.code);
      if (st.code === '21') {
        expect(args.p_cgst + args.p_sgst).toBeCloseTo(1.8, 2);
        expect(args.p_igst).toBe(0);
      } else {
        expect(args.p_igst).toBe(1.8);
        expect(args.p_cgst).toBe(0);
      }
      // Never both heads for one supply.
      expect(args.p_igst > 0 && (args.p_cgst > 0 || args.p_sgst > 0)).toBe(false);
    }
  });

  test('gst_rate is derived and passed (18%)', async () => {
    const args = await mintBookingFor({ name: 'A', stateCode: '27' });
    expect(args.p_gst_rate).toBeCloseTo(0.18, 4);
  });
});

describe('stateService.normalizeBilling — server-authoritative validator', () => {
  test('requireState + no resolvable state → error', () => {
    const r = stateService.normalizeBilling({ name: 'X' }, { requireState: true });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/billing state/i);
  });

  test('malformed GSTIN → error', () => {
    const r = stateService.normalizeBilling({ gstin: 'NOT-A-GSTIN', state_code: '27' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/gstin/i);
  });

  test('typed state name is rewritten to canonical name + code', () => {
    const r = stateService.normalizeBilling({ state: 'orissa' }, { requireState: true });
    expect(r.ok).toBe(true);
    expect(r.billing.state).toBe('Odisha');
    expect(r.billing.state_code).toBe('21');
  });

  test('GSTIN state overrides typed state_code', () => {
    const r = stateService.normalizeBilling({ gstin: '27AAPFU0939F1ZV', state_code: '21' });
    expect(r.ok).toBe(true);
    expect(r.billing.state_code).toBe('27');
    expect(r.billing.state).toBe('Maharashtra');
    expect(r.billing.gstin).toBe('27AAPFU0939F1ZV');
  });

  test('not required + nothing usable → null billing (POS defaults later)', () => {
    expect(stateService.normalizeBilling({}, { requireState: false }).billing).toBeNull();
  });

  test('not required + identity only (no state) → keeps identity, null state', () => {
    const r = stateService.normalizeBilling({ name: 'Acme', pan: 'aampc1234c' }, { requireState: false });
    expect(r.ok).toBe(true);
    expect(r.billing.name).toBe('Acme');
    expect(r.billing.state_code).toBeNull();
    expect(r.billing.pan).toBe('AAMPC1234C');
  });
});
