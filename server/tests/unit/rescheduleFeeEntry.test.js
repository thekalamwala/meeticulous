const { rescheduleFeeEntry } = require('../../services/ledger/journalTemplates');

test('₹10 fee → balanced, platform revenue + GST, no vendor payable', () => {
  const { lines } = rescheduleFeeEntry({ booking_id: 'b1', host_id: 'h1', fee: 10, gstRate: 0.18 });
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  expect(Math.round(debit * 100)).toBe(Math.round(credit * 100)); // balanced
  expect(lines.find((l) => l.account_code === '2000')).toBeUndefined(); // no vendor payable
  expect(lines.find((l) => l.account_code === '4000' && l.credit > 0)).toBeTruthy(); // platform revenue
});
