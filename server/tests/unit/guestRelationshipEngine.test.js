'use strict';
/**
 * PR-9: the guest relationship engine reuses the pure health/touch functions over a
 * guest-shaped subject. These pin (a) the booking→ctx aggregation, (b) that a guest's
 * "meaningful interaction" is their last booking, (c) that a recently-booked guest reads
 * healthy → NO rec while a gone-quiet guest surfaces a win-back, and (d) that recs carry
 * subject_type='guest' + contact_id + a 'contact:<id>:<reason>' dedupe_key.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/crm/touchRecommendationService', () => ({ upsertOpen: jest.fn(async () => ({ inserted: 1 })) }));

const { supabaseAdmin } = require('../../config/supabase');
const touchRec = require('../../services/crm/touchRecommendationService');
const engine = require('../../services/crm/guestRelationshipEngine');

const NOW = Date.parse('2026-09-02T12:00:00Z');
const daysAgo = (n) => new Date(NOW - n * 864e5).toISOString();

describe('guestCtxFromBookings', () => {
  test('counts paid non-dead bookings; last-30d; first/last', () => {
    const ctx = engine.guestCtxFromBookings([
      { payment_status: 'paid', status: 'completed', scheduled_at: daysAgo(100) },
      { payment_status: 'paid', status: 'completed', scheduled_at: daysAgo(5) },
      { payment_status: 'paid', status: 'cancelled', scheduled_at: daysAgo(2) }, // dead → dropped
      { payment_status: 'pending', status: 'completed', scheduled_at: daysAgo(1) }, // unpaid → dropped
    ], NOW);
    expect(ctx.hasBooking).toBe(true);
    expect(ctx.isPaid).toBe(true);
    expect(ctx.bookingsTotal).toBe(2);
    expect(ctx.bookingsLast30d).toBe(1);           // only the 5d-ago one
    expect(ctx.firstBookingAt).toBe(daysAgo(100));
    expect(ctx.lastBookingAt).toBe(daysAgo(5));
  });

  test('no bookings → empty customer ctx', () => {
    const ctx = engine.guestCtxFromBookings([], NOW);
    expect(ctx.hasBooking).toBe(false);
    expect(ctx.bookingsTotal).toBe(0);
    expect(ctx.lastBookingAt).toBeNull();
  });
});

describe('buildGuestSubject', () => {
  test("meaningful interaction is the later of a human contact and the last booking", () => {
    const ctx = { firstBookingAt: daysAgo(200), lastBookingAt: daysAgo(30) };
    // no prior human contact → the last booking is the meaningful interaction
    let s = engine.buildGuestSubject({ id: 'c1', last_meaningful_interaction_at: null }, ctx, NOW);
    expect(s.last_meaningful_interaction_at).toBe(daysAgo(30));
    expect(s.created_at).toBe(daysAgo(200));        // relationship starts at first booking
    expect(s.status).toBeNull();
    // a more recent human contact wins over the booking
    s = engine.buildGuestSubject({ id: 'c1', last_meaningful_interaction_at: daysAgo(10) }, ctx, NOW);
    expect(s.last_meaningful_interaction_at).toBe(daysAgo(10));
  });
});

describe('toGuestRec', () => {
  test('remaps a lead-keyed rec onto the guest subject', () => {
    const rec = { lead_id: 'c1', subject_type: 'lead', reason: 'cooling', dedupe_key: 'lead:c1:cooling', priority: 'medium' };
    const g = engine.toGuestRec('c1')(rec);
    expect(g.subject_type).toBe('guest');
    expect(g.lead_id).toBeNull();
    expect(g.contact_id).toBe('c1');
    expect(g.dedupe_key).toBe('contact:c1:cooling');
  });
});

describe('recommendationsForGuest', () => {
  const contact = { id: 'c1', last_meaningful_interaction_at: null, created_at: daysAgo(400) };

  test('a guest who booked recently reads healthy → no rec', () => {
    const ctx = engine.guestCtxFromBookings([{ payment_status: 'paid', status: 'completed', scheduled_at: daysAgo(4) }], NOW);
    const { health, recs } = engine.recommendationsForGuest(contact, ctx, NOW);
    expect(['thriving', 'steady']).toContain(health.state);
    expect(recs).toHaveLength(0);
  });

  test('a guest who has gone quiet surfaces a win-back rec (guest-subject)', () => {
    const ctx = engine.guestCtxFromBookings([{ payment_status: 'paid', status: 'completed', scheduled_at: daysAgo(140) }], NOW);
    const { recs } = engine.recommendationsForGuest(contact, ctx, NOW);
    expect(recs.length).toBeGreaterThanOrEqual(1);
    const winback = recs.find((r) => r.touch_type === 'winback' || r.reason === 'dormant' || r.reason === 'at_risk');
    expect(winback).toBeTruthy();
    expect(winback.subject_type).toBe('guest');
    expect(winback.contact_id).toBe('c1');
    expect(winback.dedupe_key.startsWith('contact:c1:')).toBe(true);
    expect(winback.lead_id).toBeNull();
  });

  test('a booking milestone surfaces a guest milestone rec', () => {
    const bookings = Array.from({ length: 50 }, () => ({ payment_status: 'paid', status: 'completed', scheduled_at: daysAgo(4) }));
    const ctx = engine.guestCtxFromBookings(bookings, NOW);
    const { recs } = engine.recommendationsForGuest(contact, ctx, NOW);
    const milestone = recs.find((r) => r.reason === 'milestone');
    expect(milestone).toBeTruthy();
    expect(milestone.subject_type).toBe('guest');
    expect(milestone.dedupe_key).toBe('contact:c1:milestone:bookings:50');
  });
});

describe('run', () => {
  const qb = (result) => {
    const b = {};
    for (const m of ['select', 'in', 'not', 'eq', 'order', 'limit', 'update', 'gte', 'lte']) b[m] = () => b;
    b.then = (res, rej) => Promise.resolve(result).then(res, rej);
    return b;
  };

  beforeEach(() => jest.clearAllMocks());

  test('emits guest recs for gone-quiet customers, skips non-customers', async () => {
    const CONTACTS = [
      { id: 'c1', email: 'quiet@x.com', user_id: null, created_at: daysAgo(400), contact_type: 'guest', last_meaningful_interaction_at: null, last_activity_at: null },
      { id: 'c2', email: 'nobooking@x.com', user_id: null, created_at: daysAgo(10), contact_type: 'guest', last_meaningful_interaction_at: null, last_activity_at: null },
    ];
    const BOOKINGS = [{ guest_email: 'quiet@x.com', payment_status: 'paid', status: 'completed', scheduled_at: daysAgo(140) }];
    supabaseAdmin.from.mockImplementation((t) => {
      if (t === 'contacts') return qb({ data: CONTACTS });
      if (t === 'bookings') return qb({ data: BOOKINGS });
      if (t === 'support_threads') return qb({ data: [] });
      return qb({ data: [] });
    });

    const out = await engine.run(NOW);
    expect(out.scanned).toBe(2);
    expect(out.customers).toBe(1);                 // c2 skipped (no booking)
    expect(touchRec.upsertOpen).toHaveBeenCalledTimes(1);
    const recs = touchRec.upsertOpen.mock.calls[0][0];
    expect(recs[0].subject_type).toBe('guest');
    expect(recs[0].contact_id).toBe('c1');
  });

  test('no contacts → no-op', async () => {
    supabaseAdmin.from.mockImplementation(() => qb({ data: [] }));
    const out = await engine.run(NOW);
    expect(out).toEqual({ scanned: 0, customers: 0, recs: 0 });
    expect(touchRec.upsertOpen).not.toHaveBeenCalled();
  });
});
