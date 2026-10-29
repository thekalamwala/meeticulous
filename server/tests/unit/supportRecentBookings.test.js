'use strict';

// Ladder: past3 · past2+up1 · past1+up2 · up3 — recent past fills first, upcoming tops up.
// supabaseAdmin is only used by the async query fn; stub it so module load doesn't throw.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
const { composeRecent } = require('../../services/supportContextService');

const b = (id, iso) => ({ id, scheduled_at: iso });
// past = desc (most recent first), upcoming = asc (soonest first) — as the queries return them.
const PAST = [b('p1', '2026-08-30T10:00:00Z'), b('p2', '2026-08-20T10:00:00Z'), b('p3', '2026-08-10T10:00:00Z'), b('p4', '2026-08-01T10:00:00Z')];
const UP = [b('u1', '2026-09-05T10:00:00Z'), b('u2', '2026-09-10T10:00:00Z'), b('u3', '2026-09-20T10:00:00Z')];

const ids = (rows) => rows.map((r) => r.id);

describe('composeRecent — recent-past-first ladder', () => {
  test('past3 when 3+ past exist (upcoming ignored)', () => {
    // sorted newest-first for display
    expect(ids(composeRecent(PAST, UP))).toEqual(['p1', 'p2', 'p3']);
  });
  test('past2 + upcoming1', () => {
    expect(ids(composeRecent(PAST.slice(0, 2), UP))).toEqual(['u1', 'p1', 'p2']);
  });
  test('past1 + upcoming2', () => {
    expect(ids(composeRecent(PAST.slice(0, 1), UP))).toEqual(['u2', 'u1', 'p1']);
  });
  test('upcoming3 when no past', () => {
    expect(ids(composeRecent([], UP))).toEqual(['u3', 'u2', 'u1']);
  });
  test('fewer than 3 total returns what exists', () => {
    expect(ids(composeRecent(PAST.slice(0, 1), []))).toEqual(['p1']);
    expect(composeRecent([], [])).toEqual([]);
  });
});
