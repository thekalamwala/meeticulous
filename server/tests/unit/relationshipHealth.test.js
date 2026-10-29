'use strict';
// PR-2 (relationship engine): relationship health is a SEPARATE axis from lead
// score — it answers "is the relationship current and healthy, or going quiet?".
// These tests pin the guardrails that make it meaningful (not another lead score):
// it decays with time-since-MEANINGFUL-interaction, automated touches never raise
// it, and at_risk needs corroboration.

const { compute } = require('../../services/crm/relationshipHealth');

const NOW = new Date('2026-06-01T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 864e5).toISOString();

test('recent meaningful contact + real outcomes → thriving', () => {
  const { state, score } = compute(
    { status: 'won', last_meaningful_interaction_at: daysAgo(3), last_activity_at: daysAgo(3) },
    { isPaid: true, hasBooking: true, bookingsLast30d: 6, meetsSloth: true },
    NOW,
  );
  expect(state).toBe('thriving');
  expect(score).toBeGreaterThanOrEqual(90);
});

test('no meaningful contact for 25 days → cooling, even if automated touches are recent', () => {
  const { state } = compute(
    {
      status: 'paid',
      last_meaningful_interaction_at: daysAgo(25),
      last_activity_at: daysAgo(1),          // bumped by an automated send…
      last_automated_touch_at: daysAgo(1),   // …which must NOT keep health up
    },
    { isPaid: true, hasBooking: true, bookingsLast30d: 2 },
    NOW,
  );
  expect(state).toBe('cooling');
});

test('automated touches alone (never a meaningful interaction) never read as healthy', () => {
  const { state } = compute(
    { status: 'contacted', last_meaningful_interaction_at: null, last_activity_at: daysAgo(5), last_automated_touch_at: daysAgo(2) },
    { isPaid: false, hasBooking: false, bookingsLast30d: 0 },
    NOW,
  );
  expect(['thriving', 'steady']).not.toContain(state);
});

test('a single soft signal caps at cooling; a second corroborates to at_risk', () => {
  const base = { status: 'activated', last_meaningful_interaction_at: daysAgo(10), last_activity_at: daysAgo(10) };
  const ctx = { isPaid: true, hasBooking: false, bookingsLast30d: 0 };

  const one = compute(base, { ...ctx, supportOpen: true }, NOW);
  expect(one.state).toBe('cooling');

  const two = compute(base, { ...ctx, supportOpen: true, negativeFeedback: true }, NOW);
  expect(two.state).toBe('at_risk');
});

test('lapsed subscription is a hard risk signal → at_risk (recently active)', () => {
  const { state } = compute(
    { status: 'paid', last_meaningful_interaction_at: daysAgo(5), last_activity_at: daysAgo(2) },
    { isPaid: true, hasBooking: true, bookingsLast30d: 1, lapsed: true },
    NOW,
  );
  expect(state).toBe('at_risk');
});

test('churned, or long two-way silence + lapsed → dormant', () => {
  const churned = compute({ status: 'churned', last_meaningful_interaction_at: daysAgo(200) }, {}, NOW);
  expect(churned.state).toBe('dormant');

  const longGone = compute(
    { status: 'paid', last_meaningful_interaction_at: daysAgo(120), last_activity_at: daysAgo(120) },
    { lapsed: true },
    NOW,
  );
  expect(longGone.state).toBe('dormant');
});

test('signals explain the state (top contributors, meaningful recency always present)', () => {
  const { signals } = compute(
    { status: 'won', last_meaningful_interaction_at: daysAgo(3), last_activity_at: daysAgo(3) },
    { isPaid: true, hasBooking: true, bookingsLast30d: 6, meetsSloth: true },
    NOW,
  );
  expect(signals.length).toBeGreaterThan(0);
  expect(signals.length).toBeLessThanOrEqual(4);
  expect(signals.some((s) => s.key === 'meaningful_interaction')).toBe(true);
});

test('null lead is a safe no-op', () => {
  expect(compute(null)).toEqual({ state: 'dormant', score: 0, signals: [] });
});

// ── PR-7.5: the two sentiment signals (now populated by lifecycleEngine.loadAccountCtx)
// are honest inputs. A single soft signal caps at 'cooling'; two corroborate to 'at_risk'.
describe('support/feedback sentiment wiring', () => {
  const lead = { status: 'paid', last_meaningful_interaction_at: daysAgo(18), last_activity_at: daysAgo(2) };
  const baseCtx = { isPaid: true, hasBooking: true, bookingsLast30d: 0 };

  test('baseline (no negatives) is steady', () => {
    expect(compute(lead, baseCtx, NOW).state).toBe('steady');
  });

  test('an open support issue alone pulls steady → cooling', () => {
    const r = compute(lead, { ...baseCtx, supportOpen: true }, NOW);
    expect(r.state).toBe('cooling');
    expect(r.signals.some((s) => s.key === 'support')).toBe(true);
  });

  test('open support + negative feedback corroborate to at_risk', () => {
    const r = compute(lead, { ...baseCtx, supportOpen: true, negativeFeedback: true }, NOW);
    expect(r.state).toBe('at_risk');
  });
});
