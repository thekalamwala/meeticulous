// bookingCaps → availabilityService → config/supabase (which throws without a
// service_role key). We inject our own supabaseAdmin stub per test, so a bare
// mock is enough to satisfy the require chain.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) } }));

jest.mock('../../services/planService', () => ({
  isFreeSlug: jest.fn((s) => s === 'free'),
  resolveVendorPlan: jest.fn((p) => p?.plan || 'free'),
}));

const { capDecision, checkBookingCaps, windowsFor } = require('../../lib/bookingCaps');
const planService = require('../../services/planService');

describe('capDecision (pure)', () => {
  test('no caps set → allowed', () => {
    expect(capDecision({ caps: {}, counts: {} }).allowed).toBe(true);
  });

  test('null/0/negative caps are treated as off', () => {
    const caps = { cap_per_day: null, cap_per_week: 0, cap_per_guest: -1 };
    expect(capDecision({ caps, counts: { day: 99, week: 99, guest: 99 } }).allowed).toBe(true);
  });

  describe.each(['day', 'week', 'guest'])('%s cap', (dim) => {
    const capKey = { day: 'cap_per_day', week: 'cap_per_week', guest: 'cap_per_guest' }[dim];
    const caps = { [capKey]: 2 };
    test('under cap → allowed', () => {
      expect(capDecision({ caps, counts: { [dim]: 1 } }).allowed).toBe(true);
    });
    test('at cap (count === cap) → blocked (the N+1 booking)', () => {
      const r = capDecision({ caps, counts: { [dim]: 2 } });
      expect(r.allowed).toBe(false);
      expect(typeof r.message).toBe('string');
    });
    test('over cap → blocked', () => {
      expect(capDecision({ caps, counts: { [dim]: 5 } }).allowed).toBe(false);
    });
  });

  test('day cap checked before week/guest (first failing wins)', () => {
    const caps = { cap_per_day: 1, cap_per_week: 1, cap_per_guest: 1 };
    const r = capDecision({ caps, counts: { day: 1, week: 1, guest: 1 } });
    expect(r.message).toMatch(/day/i);
  });
});

describe('windowsFor', () => {
  test('IST day window is a 24h span starting at local midnight', () => {
    const w = windowsFor('2026-11-14T06:00:00Z', 'Asia/Kolkata'); // 11:30 IST on the 14th
    // IST midnight 14th = 2026-11-13T18:30:00Z; next midnight = 2026-11-14T18:30:00Z
    expect(w.dayStart.toISOString()).toBe('2026-11-13T18:30:00.000Z');
    expect(w.dayEnd.toISOString()).toBe('2026-11-14T18:30:00.000Z');
  });
  test('week window is Mon→next Mon (7 days)', () => {
    const w = windowsFor('2026-11-14T06:00:00Z', 'Asia/Kolkata'); // Sat 14th
    expect((w.weekEnd - w.weekStart) / 86400000).toBeCloseTo(7, 5);
    expect(w.weekStart <= w.dayStart && w.dayEnd <= w.weekEnd).toBe(true);
  });
});

describe('checkBookingCaps (DB-gated)', () => {
  const makeSupabase = (count) => ({
    from: () => ({
      select: () => ({
        eq() { return this; }, neq() { return this; },
        gte() { return this; }, lt() { return this; }, ilike() { return this; },
        then: (res) => Promise.resolve({ count }).then(res),
      }),
    }),
  });
  beforeEach(() => jest.clearAllMocks());

  test('no caps set → allowed, never queries', async () => {
    const r = await checkBookingCaps({
      supabaseAdmin: makeSupabase(999), hostId: 'h1', hostProfile: { plan: 'pro' },
      avail: {}, scheduledAt: '2026-11-14T06:00:00Z', guestId: 'g1',
    });
    expect(r.allowed).toBe(true);
  });

  test('free host → caps ignored even when over', async () => {
    const r = await checkBookingCaps({
      supabaseAdmin: makeSupabase(999), hostId: 'h1', hostProfile: { plan: 'free' },
      avail: { cap_per_day: 1 }, scheduledAt: '2026-11-14T06:00:00Z', guestId: 'g1',
    });
    expect(r.allowed).toBe(true);
    expect(planService.isFreeSlug).toHaveBeenCalled();
  });

  test('pro host over day cap → blocked 409-style message', async () => {
    const r = await checkBookingCaps({
      supabaseAdmin: makeSupabase(3), hostId: 'h1', hostProfile: { plan: 'pro' },
      avail: { cap_per_day: 3, timezone: 'Asia/Kolkata' },
      scheduledAt: '2026-11-14T06:00:00Z', guestId: 'g1',
    });
    expect(r.allowed).toBe(false);
  });

  test('pro host under cap → allowed', async () => {
    const r = await checkBookingCaps({
      supabaseAdmin: makeSupabase(1), hostId: 'h1', hostProfile: { plan: 'pro' },
      avail: { cap_per_guest: 5 }, scheduledAt: '2026-11-14T06:00:00Z',
      guestPhone: '9876543210',
    });
    expect(r.allowed).toBe(true);
  });

  test('fails open on DB error', async () => {
    const boom = { from: () => { throw new Error('db down'); } };
    const r = await checkBookingCaps({
      supabaseAdmin: boom, hostId: 'h1', hostProfile: { plan: 'pro' },
      avail: { cap_per_day: 1, timezone: 'Asia/Kolkata' }, scheduledAt: '2026-11-14T06:00:00Z',
    });
    expect(r.allowed).toBe(true);
  });
});
