'use strict';
// PR-4: the lifecycle engine's decision core is deterministic — pin every IF→THEN
// transition. decide() is pure (no DB), so these are plain fixtures.

// decide() is pure; mock the DB module only so the require chain loads in tests.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) }, supabase: {} }));

const { decide, SEQ } = require('../../services/crm/lifecycleEngine');

const NOW = new Date('2025-06-01T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 864e5).toISOString();

test('cold new lead, never contacted → enroll New Lead nurture, no status change', () => {
  const d = decide({ status: 'new', created_at: daysAgo(0), email: 'a@b.com' }, {}, NOW);
  expect(d.changed).toBe(false);
  expect(d.status).toBe('new');
  expect(d.intent).toBe('low');
  expect(d.enroll).toBe(SEQ.NEW_LEAD);
  expect(d.nextAction).toBe('Enroll: New Lead nurture');
});

test('new lead we have contacted → moves to contacted', () => {
  const d = decide({ status: 'new', last_contacted_at: daysAgo(1) }, {}, NOW);
  expect(d.status).toBe('contacted');
  expect(d.changed).toBe(true);
  expect(d.enroll).toBeNull();
});

test('engaged since last contact → replied + human contact', () => {
  const d = decide({ status: 'contacted', last_contacted_at: daysAgo(2), last_engaged_at: daysAgo(1) }, {}, NOW);
  expect(d.status).toBe('replied');
  expect(d.nextAction).toBe('Human contact');
});

test('high intent (score ≥70) → qualified + human contact', () => {
  // replied(45) + phone8 + email4 + engaged<3d15 = 72 → high
  const d = decide({ status: 'replied', phone: '9', email: 'a@b', last_engaged_at: daysAgo(1) }, {}, NOW);
  expect(d.score).toBeGreaterThanOrEqual(70);
  expect(d.intent).toBe('high');
  expect(d.status).toBe('qualified');
  expect(d.nextAction).toBe('Human contact');
});

test('PAID host finished onboarding but no booking → activated + no-booking sequence', () => {
  // Relations is subscription-only: onboarding promotes to activated only for a paid host.
  const d = decide({ status: 'paid', profile_id: 'p1' }, { isPaid: true, onboardingComplete: true, hasBooking: false }, NOW);
  expect(d.status).toBe('activated');
  expect(d.enroll).toBe(SEQ.NO_BOOKING);
});

test('PAID host onboarded WITH a booking → won + first-booking celebration', () => {
  const d = decide({ status: 'activated', profile_id: 'p1' }, { isPaid: true, onboardingComplete: true, hasBooking: true }, NOW);
  expect(d.status).toBe('won');
  expect(d.enroll).toBe(SEQ.FIRST_BOOKING);
  expect(d.nextAction).toBe('Celebrate first booking');
});

test('UNPAID onboarded host stays in Presale (O-1) — no activation', () => {
  const d = decide({ status: 'qualified', profile_id: 'p1' }, { isPaid: false, onboardingComplete: true, hasBooking: true }, NOW);
  expect(d.status).toBe('qualified');
});

test('signed up but onboarding stale → first unfilled gap (no photo)', () => {
  const d = decide({ status: 'new', profile_id: 'p1', created_at: daysAgo(5) }, { onboardingComplete: false, hasBooking: false }, NOW);
  expect(d.status).toBe('new');
  expect(d.enroll).toBe(SEQ.NO_PHOTO);
});

test('onboarding stale, all gaps filled but flag unset → generic finish nudge', () => {
  const d = decide({ status: 'new', profile_id: 'p1', created_at: daysAgo(5) },
    { onboardingComplete: false, hasPhoto: true, hasService: true, hasAvailability: true }, NOW);
  expect(d.enroll).toBe(SEQ.NOT_ACTIVATED);
});

test('long-inactive, never converted → win-back', () => {
  const d = decide({ status: 'contacted', last_contacted_at: daysAgo(45), last_activity_at: daysAgo(45) }, {}, NOW);
  expect(d.enroll).toBe(SEQ.WINBACK);
});

test('null-safe', () => {
  const d = decide(null, {}, NOW);
  expect(d.score).toBe(0);
  expect(d.intent).toBe('low');
});
