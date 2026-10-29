'use strict';
// P1a Sales Desk — the column-vs-column / merge logic that can't be a SQL filter
// is pure and tested here. Query wrappers are thin and trusted.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) }, supabase: {} }));

const { isUnansweredReply, activationReason, mergeById, shape } = require('../../services/crm/deskService');

describe('isUnansweredReply', () => {
  test('no lead / no reply → false', () => {
    expect(isUnansweredReply(null)).toBe(false);
    expect(isUnansweredReply({ created_at: '2025-01-01' })).toBe(false);
  });
  test('reply after last outbound → true', () => {
    expect(isUnansweredReply({ last_reply_at: '2025-06-02T00:00:00Z', last_contacted_at: '2025-06-01T00:00:00Z' })).toBe(true);
  });
  test('reply before last outbound (already answered) → false', () => {
    expect(isUnansweredReply({ last_reply_at: '2025-06-01T00:00:00Z', last_contacted_at: '2025-06-02T00:00:00Z' })).toBe(false);
  });
  test('reply with no prior outbound → true (falls back to created_at)', () => {
    expect(isUnansweredReply({ last_reply_at: '2025-06-02T00:00:00Z', created_at: '2025-06-01T00:00:00Z' })).toBe(true);
  });
});

describe('activationReason', () => {
  test('profile not found → null', () => { expect(activationReason(undefined, false)).toBeNull(); });
  test('live but no booking', () => { expect(activationReason(true, false)).toBe('Live — no booking yet'); });
  test('signed up, not onboarded', () => { expect(activationReason(false, false)).toBe('Signed up — not activated'); });
  test('onboarded and booked → null (done)', () => { expect(activationReason(true, true)).toBeNull(); });
});

describe('mergeById', () => {
  test('dedupes by id, collects reasons, preserves first-seen order', () => {
    const A = { id: 'a', name: 'A' }, B = { id: 'b', name: 'B' };
    const out = mergeById([
      { lead: A, reason: 'Follow-up overdue' },
      { lead: B, reason: 'Replied — unanswered' },
      { lead: A, reason: 'Replied — unanswered' }, // same lead, new reason
      { lead: null, reason: 'x' },                  // skipped
    ]);
    expect(out.map((l) => l.id)).toEqual(['a', 'b']);
    expect(out[0]._reasons).toEqual(['Follow-up overdue', 'Replied — unanswered']);
    expect(out[1]._reasons).toEqual(['Replied — unanswered']);
  });
  test('does not duplicate an identical reason', () => {
    const A = { id: 'a' };
    const out = mergeById([{ lead: A, reason: 'r' }, { lead: A, reason: 'r' }]);
    expect(out[0]._reasons).toEqual(['r']);
  });
});

describe('shape', () => {
  test('picks the desk fields, defaults missing to null, carries reasons', () => {
    const s = shape({ id: 'a', name: 'A', score: 72, intent: 'high' }, ['High intent (score 72)']);
    expect(s).toMatchObject({ id: 'a', name: 'A', score: 72, intent: 'high', business_name: null, next_action: null });
    expect(s.reasons).toEqual(['High intent (score 72)']);
  });
  test('falls back to _reasons when no reasons passed', () => {
    expect(shape({ id: 'a', _reasons: ['x'] }).reasons).toEqual(['x']);
  });
});
