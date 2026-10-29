'use strict';
const { payoutEntry } = require('../../services/ledger/journalTemplates');

test('payoutEntry debits Vendor Payables and credits Bank, balanced + vendor-tagged', () => {
  const t = payoutEntry({ host_id: 'host-1', amount: 500, reference: 'UTR123' });
  expect(t.description).toBe('Vendor payout UTR123');
  const debit = t.lines.find(l => l.account_code === '2000');
  const credit = t.lines.find(l => l.account_code === '1000');
  expect(debit).toMatchObject({ debit: 500, credit: 0, vendor_id: 'host-1' });
  expect(credit).toMatchObject({ debit: 0, credit: 500, vendor_id: 'host-1' });
  const sumD = t.lines.reduce((s, l) => s + l.debit, 0);
  const sumC = t.lines.reduce((s, l) => s + l.credit, 0);
  expect(sumD).toBe(sumC); // balanced
});
