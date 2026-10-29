'use strict';
// PR-7.5: pure derivation of the two relationship-health sentiment signals from the
// host's support threads + vendor feedback. relationshipHealth.compute already reads
// ctx.supportOpen / ctx.negativeFeedback; this is where loadAccountCtx populates them.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) }, supabase: {} }));

const { sentimentSignals } = require('../../services/crm/lifecycleEngine');

const NOW = new Date('2026-09-02T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 864e5).toISOString();

describe('sentimentSignals', () => {
  test('an escalated host thread (waiting/assigned) → supportOpen', () => {
    const { supportOpen } = sentimentSignals(
      [{ user_id: 'h1', status: 'waiting' }, { user_id: 'h2', status: 'assigned' }], [], NOW,
    );
    expect(supportOpen.has('h1')).toBe(true);
    expect(supportOpen.has('h2')).toBe(true);
  });

  test('a bot or resolved thread is NOT supportOpen (not yet a human issue / already closed)', () => {
    const { supportOpen } = sentimentSignals(
      [{ user_id: 'h1', status: 'bot' }, { user_id: 'h2', status: 'resolved' }], [], NOW,
    );
    expect(supportOpen.has('h1')).toBe(false);
    expect(supportOpen.has('h2')).toBe(false);
  });

  test('a poor support rating (≤2 of 5) → negative', () => {
    const { negative } = sentimentSignals([{ user_id: 'h1', status: 'resolved', rating: 2 }], [], NOW);
    expect(negative.has('h1')).toBe(true);
  });

  test('a good support rating (≥3) is not negative', () => {
    const { negative } = sentimentSignals([{ user_id: 'h1', status: 'resolved', rating: 4 }], [], NOW);
    expect(negative.has('h1')).toBe(false);
  });

  test('a vendor complaint → negative', () => {
    const { negative } = sentimentSignals([], [{ vendor_id: 'h1', type: 'complaint', created_at: daysAgo(3) }], NOW);
    expect(negative.has('h1')).toBe(true);
  });

  test('a low vendor rating (≤3 of 10) → negative; a high one is not', () => {
    const { negative } = sentimentSignals([], [
      { vendor_id: 'h1', type: 'other', rating: 2, created_at: daysAgo(3) },
      { vendor_id: 'h2', type: 'other', rating: 9, created_at: daysAgo(3) },
    ], NOW);
    expect(negative.has('h1')).toBe(true);
    expect(negative.has('h2')).toBe(false);
  });

  test('a stale complaint (>90d) is not counted (health tracks CURRENT sentiment)', () => {
    const { negative } = sentimentSignals([], [{ vendor_id: 'h1', type: 'complaint', created_at: daysAgo(200) }], NOW);
    expect(negative.has('h1')).toBe(false);
  });

  test('empty inputs → empty sets, never throws', () => {
    const r = sentimentSignals(undefined, undefined, NOW);
    expect(r.supportOpen.size).toBe(0);
    expect(r.negative.size).toBe(0);
  });
});
