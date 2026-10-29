/**
 * Reschedule fee — tax invoice ⇄ ledger parity.
 *
 * The fee is BAS's own revenue: rescheduleFeeEntry credits Platform Fee Revenue
 * (ex-GST) + GST Payable, treating the charged amount as GST-INCLUSIVE. No tax
 * invoice was ever minted against it, so GST was collected and booked as a
 * liability with no document behind it — and gstReconcile() saw the ledger
 * permanently exceed invoices, which is the exact drift its own error message
 * describes ("a posted transaction with no invoice row").
 *
 * The invoice split is computed in bookingController with the SAME two lines the
 * journal uses (taxable = gross / (1+rate), GST = the remainder). These tests
 * pin that they cannot drift: if someone "tidies" either side into
 * round2(gross * rate / (1+rate)), the paisa disagreements show up here.
 */

const { rescheduleFeeEntry } = require('../../services/ledger/journalTemplates');
const { ACCOUNTS } = require('../../lib/ledgerAccounts');
const { round2 } = require('../../lib/pricingEngine');

const creditFor = (lines, code) => {
  const l = lines.find((x) => x.account_code === code && Number(x.credit) > 0);
  return l ? Number(l.credit) : 0;
};

// Exactly what bookingController feeds generateInvoice().
const invoiceSplit = (fee, gstRate) => {
  const gross = round2(fee);
  const taxable = round2(gross / (1 + gstRate));
  return { taxableValue: taxable, gstAmount: round2(gross - taxable) };
};

describe('reschedule fee — invoice matches the journal', () => {
  // ₹10 is the only fee the host UI permits today (hostController: 0 or 10).
  test('₹10 @ 18% splits to ₹8.47 taxable + ₹1.53 GST on both sides', () => {
    const { lines } = rescheduleFeeEntry({ booking_id: 'b1', host_id: 'h1', fee: 10, gstRate: 0.18 });
    expect(creditFor(lines, ACCOUNTS.PLATFORM_FEE_REVENUE)).toBe(8.47);
    expect(creditFor(lines, ACCOUNTS.GST_PAYABLE)).toBe(1.53);

    const inv = invoiceSplit(10, 0.18);
    expect(inv.taxableValue).toBe(8.47);
    expect(inv.gstAmount).toBe(1.53);
  });

  test.each([
    [10, 0.18], [12, 0.18], [25, 0.18], [99, 0.18],
    [10, 0.05], [10, 0.12], [10, 0.28], [1, 0.18], [7.5, 0.18],
  ])('fee ₹%s @ %s — journal and invoice agree to the paisa', (fee, rate) => {
    const { lines } = rescheduleFeeEntry({ booking_id: 'b1', host_id: 'h1', fee, gstRate: rate });
    const inv = invoiceSplit(fee, rate);

    expect(inv.taxableValue).toBe(creditFor(lines, ACCOUNTS.PLATFORM_FEE_REVENUE));
    expect(inv.gstAmount).toBe(creditFor(lines, ACCOUNTS.GST_PAYABLE));
  });

  test.each([[10, 0.18], [12, 0.18], [25, 0.28], [7.5, 0.05]])(
    'fee ₹%s @ %s — taxable + GST equals the amount actually charged',
    (fee, rate) => {
      const inv = invoiceSplit(fee, rate);
      // The guest is charged `fee`, nothing more. This is what keeps the invoice
      // inside invoices_tax_reconcile_chk (|total − taxable − tax| ≤ 0.05).
      expect(round2(inv.taxableValue + inv.gstAmount)).toBe(round2(fee));
    },
  );

  test('the fee is never grossed up — receivable equals the charged amount', () => {
    const { lines } = rescheduleFeeEntry({ booking_id: 'b1', host_id: 'h1', fee: 10, gstRate: 0.18 });
    const debit = lines.find((l) => l.account_code === ACCOUNTS.RAZORPAY_RECEIVABLE && Number(l.debit) > 0);
    expect(Number(debit.debit)).toBe(10);
  });
});

describe('reschedule invoices are wired into the GST stack', () => {
  test('the series is its own, so one booking never mints two BAS-BKG numbers', () => {
    const { SERIES } = require('../../config/sellerIdentity');
    expect(SERIES.reschedule).toEqual({ code: 'RSF', prefix: 'BAS-RSF' });
    expect(SERIES.reschedule.code).not.toBe(SERIES.booking.code);
  });

  test('carries a SAC code — an invoice without one fails the GST exception scan', () => {
    const { SAC_RESCHEDULE, SAC_BOOKING } = require('../../config/sellerIdentity');
    expect(SAC_RESCHEDULE).toBeTruthy();
    // Same facilitation supply as the booking fee.
    expect(SAC_RESCHEDULE).toBe(SAC_BOOKING);
  });

  test('renders as a reschedule fee, not a booking fee', () => {
    const { buildTaxInvoiceHTML } = require('../../services/invoiceHtml');
    const html = buildTaxInvoiceHTML({
      source_type: 'reschedule', invoice_number: 'BAS-RSF/2026-27/00001',
      source_id: '11111111-2222-3333-4444-555555555555',
      taxable_value: 8.47, cgst: 0.77, sgst: 0.76, igst: 0, total: 10,
      place_of_supply: '21', gst_rate: 0.18, issued_at: '2026-09-20T10:00:00Z',
      buyer_name: 'Guest',
    });
    expect(html).toContain('Booking reschedule fee');
    expect(html).not.toContain('Booking convenience / platform fee');
    // source_id points at reschedule_payments, not the booking.
    expect(html).toContain('Reschedule ref');
    expect(html).toContain('GST-inclusive');
  });
});
