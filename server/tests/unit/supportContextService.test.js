// Context service — the "give support eyes" join. supabaseAdmin mocked with a
// per-table result queue. Key guarantee: KYC returns STATUS only, never PII.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
const { supabaseAdmin } = require('../../config/supabase');
const { getSupportContext } = require('../../services/supportContextService');

// A chainable query builder that resolves (await or .maybeSingle()) to `result`.
function qb(result) {
  const b = {};
  ['select', 'eq', 'neq', 'order', 'limit', 'in', 'lt', 'lte', 'gt', 'gte'].forEach((m) => { b[m] = () => b; });
  b.maybeSingle = () => Promise.resolve(result);
  b.then = (res) => res(result);
  return b;
}

// Wire from(table) to shift the next canned result for that table.
function wire(map) {
  supabaseAdmin.from.mockImplementation((t) => qb((map[t] || []).shift() || { data: null, error: null }));
}

beforeEach(() => jest.clearAllMocks());

test('guest context maps recent bookings and carries no host section', async () => {
  wire({
    profiles: [{ data: { name: 'Rahul Verma', phone: '+9199', plan: null }, error: null }],
    bookings: [{ data: [{ id: 'b1', service_id: 's1', scheduled_at: '2026-08-01', status: 'confirmed', payment_status: 'paid' }], error: null }],
    services: [{ data: [{ id: 's1', title: 'Tarot Reading' }], error: null }],
  });
  const ctx = await getSupportContext({ phone: '+9199', isHost: false });
  expect(ctx.kind).toBe('guest');
  expect(ctx.host).toBeNull();
  expect(ctx.bookings).toHaveLength(1);
  expect(ctx.bookings[0]).toMatchObject({ service: 'Tarot Reading', status: 'confirmed', payment_status: 'paid' });
  expect(ctx.bookings[0].ref).toMatch(/^#/);
});

test('host context exposes KYC STATUS only — no PAN/Aadhaar/account ever in the payload', async () => {
  wire({
    profiles: [{ data: { name: 'Meera', plan: 'Host+', plan_expires_at: '2026-12-01', is_verified: true, onboarding_completed: true }, error: null }],
    bookings: [{ data: [], error: null }], // no bookings → title lookup is skipped
    services: [{ data: [{ id: 'sX' }], error: null }], // only call is the active-listing check

    // Even though the row holds encrypted PII, the service must only read status fields.
    kyc_submissions: [{ data: { status: 'approved', route_activation_status: 'activated', razorpay_account_id: 'acc_1', pan_number: 'ENC', aadhaar_number: 'ENC', account_number: 'ENC' }, error: null }],
  });
  const ctx = await getSupportContext({ userId: 'u1', isHost: true });
  expect(ctx.kind).toBe('host');
  expect(ctx.host.listingActive).toBe(true);
  expect(ctx.host.kyc).toEqual({ status: 'approved', activation: 'activated' });
  expect(ctx.host.payoutLinked).toBe(true);

  const blob = JSON.stringify(ctx);
  expect(blob).not.toMatch(/pan_number|aadhaar|account_number|ENC/i);
});

test('previous tickets exclude the open thread and count the rest', async () => {
  wire({
    profiles: [{ data: { name: 'Riya' }, error: null }],
    bookings: [{ data: [], error: null }],
    support_threads: [{ data: [
      { id: 'cur', reference: 'SUP-CUR', subject: 'now', status: 'assigned', created_at: '2026-08-30' },
      { id: 't2', reference: 'SUP-002', subject: 'earlier', status: 'resolved', created_at: '2026-08-10' },
    ], error: null }],
  });
  const ctx = await getSupportContext({ phone: '+91', isHost: false, currentThreadId: 'cur' });
  expect(ctx.tickets.total).toBe(1);
  expect(ctx.tickets.items[0]).toMatchObject({ ref: 'SUP-002', status: 'resolved' });
});

test('degrades section-by-section when a read errors, never throwing', async () => {
  wire({
    profiles: [{ data: null, error: { message: 'boom' } }],
    bookings: [{ data: null, error: { message: 'boom' } }],
  });
  const ctx = await getSupportContext({ phone: '+91', isHost: false });
  expect(ctx.bookings).toEqual([]);
  expect(ctx.profile).toMatchObject({ phone: '+91' });
});
