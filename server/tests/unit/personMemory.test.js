// Slice 7 — per-person memory line (pure; data already in the support context).

const { memoryNote } = require('../../services/bot/contextAnswer');

const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

test('empty when there is nothing to remember', () => {
  expect(memoryNote(null)).toBe('');
  expect(memoryNote({})).toBe('');
  expect(memoryNote({ profile: {}, tickets: { total: 0, items: [] } })).toBe('');
});

test('surfaces tenure + prior support count and recent subjects (capped at 3)', () => {
  const ctx = {
    profile: { joinedAt: daysAgo(120) },
    tickets: { total: 3, items: [{ subject: 'Payout delay' }, { subject: 'KYC rejected' }, { subject: 'Invoice' }, { subject: 'extra' }] },
  };
  const out = memoryNote(ctx);
  expect(out).toMatch(/months/);
  expect(out).toMatch(/reached support 3 times before/);
  expect(out).toMatch(/Payout delay; KYC rejected; Invoice/);
  expect(out).not.toMatch(/extra/); // 4th subject dropped
});

test('a first-time, this-month contact reads naturally', () => {
  const out = memoryNote({ profile: { joinedAt: new Date().toISOString() }, tickets: { total: 1, items: [{ subject: 'Hello' }] } });
  expect(out).toMatch(/Joined this month/);
  expect(out).toMatch(/reached support 1 time before/);
});

test('tenure alone (no prior tickets) still produces a line', () => {
  expect(memoryNote({ profile: { joinedAt: daysAgo(400) }, tickets: { total: 0, items: [] } })).toMatch(/With us about \d+ months/);
});
