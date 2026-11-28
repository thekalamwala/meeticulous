const { rescheduleFeeEntry } = require('../../services/ledger/journalTemplates');

test('₹10 fee → balanced, platform revenue + GST, no vendor payable', () => {
  const { lines } = rescheduleFeeEntry({ booking_id: 'b1', host_id: 'h1', fee: 10, gstRate: 0.18 });
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  expect(Math.round(debit * 100)).toBe(Math.round(credit * 100)); // balanced
  expect(lines.find((l) => l.account_code === '2000')).toBeUndefined(); // no vendor payable
  expect(lines.find((l) => l.account_code === '4000' && l.credit > 0)).toBeTruthy(); // platform revenue
});

// Pricing v2 §2.1 item 5: both flat guest-paid fees must split identically.
test('reschedule fee splits exactly like the booking fee (splitInclusiveFee)', () => {
  const { splitInclusiveFee } = require('../../lib/pricingEngine');
  for (const fee of [10, 20, 1]) {
    const { lines } = rescheduleFeeEntry({ booking_id: 'b1', host_id: 'h1', fee, gstRate: 0.18 });
    const revenue = lines.find((l) => l.account_code === '4000' && l.credit > 0).credit;
    const gst = lines.filter((l) => l.credit > 0 && l.account_code !== '4000')
      .reduce((s, l) => s + l.credit, 0);
    const split = splitInclusiveFee(fee, { gstRate: 0.18 });
    expect(revenue).toBe(split.taxable);
    expect(Math.round(gst * 100)).toBe(Math.round(split.gst * 100));
  }
});
