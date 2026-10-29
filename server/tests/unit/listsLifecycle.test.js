// server/tests/unit/listsLifecycle.test.js
const rules = require('../../services/crm/lifecycleRules');

describe('lifecycleRules — list (cold) state', () => {
  test('list is a valid status, lowest rank, not on a rendered board', () => {
    expect(rules.STATUSES).toContain('list');
    expect(rules.RANK.list).toBe(0);
    expect(rules.pipelineOf('list')).toBe('lists');
    expect(rules.BOARD_COLUMNS.lists).toBeUndefined(); // flat table, no kanban board
  });
  test('auto never moves a cold lead, and it is excluded as CLOSED', () => {
    expect(rules.NO_AUTO.has('list')).toBe(true);
    expect(rules.CLOSED).toContain('list');
    expect(rules.resolveAccountStatus('list', { isPaid: true, hasBooking: true })).toBe('list');
  });
  test('promote list→new is allowed with no reason', () => {
    expect(rules.manualTransition('list', 'new')).toEqual({ allowed: true, needsReason: false });
  });
  test('demote →list needs no reason, but a paying customer is blocked', () => {
    expect(rules.manualTransition('qualified', 'list')).toEqual({ allowed: true, needsReason: false });
    expect(rules.manualTransition('paid', 'list').allowed).toBe(false);
  });
});
