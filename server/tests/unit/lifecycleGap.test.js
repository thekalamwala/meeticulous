'use strict';
// Phase 6: behavioural onboarding — decide() enrols the FIRST unfilled go-live gap,
// then the booking/celebration branch. Pure function; no DB.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) } }));

const { decide, SEQ } = require('../../services/crm/lifecycleEngine');

const NOW = Date.UTC(2026, 7, 27);
const staleLead = () => ({
  id: 'l1', profile_id: 'p1', status: 'contacted', last_contacted_at: '2026-08-01',
  created_at: '2026-08-10',  // > 3 days before NOW → stale signup
});

const gapOf = (ctx) => decide(staleLead(), ctx, NOW).enroll;

describe('onboarding gap branching (incomplete onboarding)', () => {
  test('no photo → add-photo sequence', () => {
    expect(gapOf({ onboardingComplete: false })).toBe(SEQ.NO_PHOTO);
  });
  test('has photo, no service → add-service', () => {
    expect(gapOf({ onboardingComplete: false, hasPhoto: true })).toBe(SEQ.NO_SERVICE);
  });
  test('has photo + service, no availability → set-availability', () => {
    expect(gapOf({ onboardingComplete: false, hasPhoto: true, hasService: true })).toBe(SEQ.NO_AVAILABILITY);
  });
  test('everything but the flag → generic finish nudge', () => {
    expect(gapOf({ onboardingComplete: false, hasPhoto: true, hasService: true, hasAvailability: true })).toBe(SEQ.NOT_ACTIVATED);
  });
});

describe('activated branch (paid host, onboarding complete)', () => {
  test('no booking → share nudge', () => {
    const d = decide({ ...staleLead(), status: 'paid' }, { isPaid: true, onboardingComplete: true, hasBooking: false }, NOW);
    expect(d.status).toBe('activated');
    expect(d.enroll).toBe(SEQ.NO_BOOKING);
  });
  test('first booking → celebration', () => {
    const d = decide({ ...staleLead(), status: 'paid' }, { isPaid: true, onboardingComplete: true, hasBooking: true }, NOW);
    expect(d.status).toBe('won');
    expect(d.enroll).toBe(SEQ.FIRST_BOOKING);
    expect(d.nextAction).toMatch(/Celebrate/);
  });
});

test('unlinked lead never enters the gap chain', () => {
  const d = decide({ id: 'x', status: 'new', created_at: '2026-08-10' }, {}, NOW);
  expect([SEQ.NO_PHOTO, SEQ.NO_SERVICE, SEQ.NO_AVAILABILITY]).not.toContain(d.enroll);
});
