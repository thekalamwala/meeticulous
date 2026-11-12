'use strict';
const { buildTaxInvoiceHTML } = require('../../services/invoiceHtml');

const base = {
  invoice_number: 'BAS-SUB/26/00001', issued_at: '2026-06-02T00:00:00Z',
  source_type: 'subscription', buyer_name: 'Mehta Wellness LLP',
  buyer_address: 'Mumbai', buyer_gstin: '27ABCDE1234F1Z5', buyer_state_code: '27',
  taxable_value: 1499, cgst: 0, sgst: 0, igst: 269.82, total: 1768.82,
  place_of_supply: '27', sac_code: '998314', payment_id: 'pay_1',
  seller_snapshot: { legalName: 'Timewheel Internet Private Limited', gstin: '21AAMCT8270C1ZF' },
};

describe('buildTaxInvoiceHTML', () => {
  test('renders number, seller + buyer GSTIN, IGST line, total', () => {
    const h = buildTaxInvoiceHTML(base);
    expect(h).toContain('BAS-SUB/26/00001');
    expect(h).toContain('21AAMCT8270C1ZF');       // seller
    expect(h).toContain('27ABCDE1234F1Z5');       // buyer
    expect(h).toContain('IGST');
    expect(h).toContain('1,768.82');
    expect(h).toContain('Poppins');
    expect(h).toMatch(/Tax Invoice/i);
  });
  test('intra-state invoice shows CGST + SGST, not IGST', () => {
    const h = buildTaxInvoiceHTML({ ...base, cgst: 0.9, sgst: 0.9, igst: 0, buyer_state_code: '21', place_of_supply: '21' });
    expect(h).toContain('CGST @');
    expect(h).toContain('SGST @');
    // The tax-summary column header "IGST" (with a ₹0.00 cell) is fine; there must
    // be no IGST *tax line* in the totals for an intra-state supply.
    expect(h).not.toContain('IGST @');
  });
  test('escapes buyer name (no HTML injection)', () => {
    const h = buildTaxInvoiceHTML({ ...base, buyer_name: '<script>x</script>' });
    expect(h).not.toContain('<script>x</script>');
    expect(h).toContain('&lt;script&gt;');
  });
  test('new design: brand header, product band, embedded signature, config-driven legal entity', () => {
    const h = buildTaxInvoiceHTML(base);
    expect(h).toContain('TAX INVOICE');
    expect(h).toContain('Baloo');                 // display font loaded
    expect(h).toContain('data:image/png;base64'); // brand marks + signature embedded, not external
    expect(h).toContain('Authorised Signatory');
    expect(h).toContain('Supplied by');
    expect(h).toContain('Billed From');
    // Legal entity is the one from config/snapshot — NOT a hard-coded brand name.
    expect(h).toContain('Timewheel Internet Private Limited');
  });
  test('bank details render a placeholder until configured', () => {
    const h = buildTaxInvoiceHTML(base);
    expect(h).toContain('Bank Details');
    expect(h).toContain('to be provided');
  });
});
