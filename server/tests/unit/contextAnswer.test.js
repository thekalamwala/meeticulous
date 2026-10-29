// Data-aware bot answers — deterministic, money-safe. Pure (no DB, no model).

const { contextAnswer, contextNote } = require('../../services/bot/contextAnswer');

const host = (over = {}) => ({
  kind: 'host',
  profile: { name: 'Meera Rao', plan: 'Host+', planExpiresAt: '2027-01-01', ...over.profile },
  host: { listingActive: true, kyc: { status: 'approved', activation: 'activated' }, payoutLinked: true, ...over.host },
  bookings: over.bookings || [],
});
const guest = (bookings = []) => ({ kind: 'guest', profile: { name: 'Rahul', phone: '+9199' }, host: null, bookings });

test('genuine disputes are NEVER answered from context (they must escalate)', () => {
  expect(contextAnswer('I was double charged, refund me', host())).toBeNull();
  expect(contextAnswer('my account was hacked', host())).toBeNull();
  expect(contextAnswer('this is a fraudulent charge', guest())).toBeNull();
});

test('host "why isn\'t my listing live" names the real blocker + a next-step link', () => {
  const noPlan = contextAnswer('why isn\'t my listing live?', host({ profile: { plan: null } }));
  expect(noPlan.answer).toMatch(/subscription/i);
  expect(noPlan.answer).toContain('/dashboard/upgrade');
  expect(noPlan.source).toBe('context');

  const kycPending = contextAnswer('why is my listing not live', host({ host: { kyc: { status: 'pending' }, listingActive: false } }));
  expect(kycPending.answer).toMatch(/verification|kyc/i);
  expect(kycPending.answer).toContain('/dashboard/kyc');

  const live = contextAnswer('is my listing live', host());
  expect(live.answer).toMatch(/is live\*\*|live ✅/i);
});

test('expired plan is detected as inactive', () => {
  const ans = contextAnswer('why is my listing not live', host({ profile: { plan: 'Host+', planExpiresAt: '2020-01-01' } }));
  expect(ans.answer).toMatch(/subscription/i);
});

test('refund reports STATUS only, never an amount', () => {
  const ans = contextAnswer('where is my refund?', guest([{ ref: '#AB12', status: 'cancelled', payment_status: 'refunded' }]));
  expect(ans.answer).toContain('#AB12');
  expect(ans.answer).toMatch(/refunded/i);
  expect(ans.answer).not.toMatch(/₹|\brs\.?\b|\$\d/i); // no money amounts
});

test('refund with nothing refund-shaped falls through (null → normal ladder)', () => {
  expect(contextAnswer('where is my refund?', guest([{ ref: '#X', status: 'confirmed', payment_status: 'paid' }]))).toBeNull();
});

test('booking status returns the latest booking state', () => {
  const ans = contextAnswer('where is my booking?', guest([{ ref: '#BK9', service: 'Tarot', status: 'confirmed', payment_status: 'paid', when: '2027-02-01T10:00:00Z' }]));
  expect(ans.answer).toContain('#BK9');
  expect(ans.answer).toMatch(/confirmed/i);
  expect(ans.answer).toContain('/user/my-bookings');
});

test('payout not linked points the host to verification', () => {
  const ans = contextAnswer('when do I get paid?', host({ host: { payoutLinked: false, kyc: { status: 'approved' } } }));
  expect(ans.answer).toMatch(/payout account isn.t linked/i);
  expect(ans.answer).toContain('/dashboard/kyc');
});

test('unrelated questions return null', () => {
  expect(contextAnswer('what are your business hours?', host())).toBeNull();
  expect(contextAnswer('how do I add a service photo?', host())).toBeNull();
});

test('contextNote is PII-light: statuses only, no name/phone/email', () => {
  const note = contextNote(host({ bookings: [{ ref: '#BK9', status: 'confirmed', payment_status: 'paid' }] }));
  expect(note).toMatch(/Plan: Host\+/);
  expect(note).toMatch(/KYC: approved/);
  expect(note).not.toMatch(/Meera|Rao|\+9199|@/); // no personal identifiers
});
