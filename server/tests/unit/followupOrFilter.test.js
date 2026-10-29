'use strict';
// buildFollowupOr — the PostgREST `.or()` string that replaced the old
// `.in('id', [up to 10k ids])` URL bomb in listLeads. Pure, no DB.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) } }));

const { buildFollowupOr, followupWindow } = require('../../services/crm/leadService');
const CLOSED = '(paid,activated,won,lost,do_not_contact)'; // shape only — real value from lifecycleRules

describe('buildFollowupOr', () => {
  test('overdue window: next_action_at strictly before "to", excludes closed', () => {
    const { to, inclusive } = followupWindow('overdue');
    const s = buildFollowupOr({ to, inclusive, taskIds: [], closedSql: CLOSED });
    expect(s).toBe(`and(next_action_at.lt.${to},status.not.in.${CLOSED})`);
  });

  test('today window: inclusive (lte)', () => {
    const { to, inclusive } = followupWindow('today');
    const s = buildFollowupOr({ to, inclusive, taskIds: [], closedSql: CLOSED });
    expect(s).toBe(`and(next_action_at.lte.${to},status.not.in.${CLOSED})`);
  });

  test('open window (no date bound): any non-null next_action_at, excludes closed', () => {
    const { to, inclusive } = followupWindow('open');
    expect(to).toBeUndefined();
    const s = buildFollowupOr({ to, inclusive, taskIds: [], closedSql: CLOSED });
    expect(s).toBe(`and(next_action_at.not.is.null,status.not.in.${CLOSED})`);
  });

  test('task ids are appended as a SECOND arm (matches regardless of status)', () => {
    const { to, inclusive } = followupWindow('overdue');
    const s = buildFollowupOr({ to, inclusive, taskIds: ['a', 'b'], closedSql: CLOSED });
    expect(s).toBe(`and(next_action_at.lt.${to},status.not.in.${CLOSED}),id.in.(a,b)`);
  });

  test('no task ids → no id arm (never emits an empty in-list)', () => {
    const s = buildFollowupOr({ to: undefined, inclusive: false, taskIds: [], closedSql: CLOSED });
    expect(s).not.toContain('id.in');
  });

  test('bounded URL: even a large task set stays inline-comma-joined, never the leads table', () => {
    const ids = Array.from({ length: 300 }, (_, i) => `id${i}`);
    const s = buildFollowupOr({ to: undefined, inclusive: false, taskIds: ids, closedSql: CLOSED });
    expect(s.endsWith(`id.in.(${ids.join(',')})`)).toBe(true);
  });
});
