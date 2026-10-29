'use strict';
// leadService.mergeLead (feat/crm-lead-merge): admin manually folds a duplicate lead into
// another via merge_lead_rows. Guards self-merge + missing rows; logs a lead_merged activity.

const mockRows = {};
const mockRpc = { calls: [] };
let mockRpcErr = null;

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from() {
      let filter = null;
      const qb = {
        select() { return qb; },
        eq(_c, v) { filter = v; return qb; },
        maybeSingle() { return Promise.resolve({ data: mockRows[filter] || null, error: null }); },
      };
      return qb;
    },
    rpc(fn, args) { mockRpc.calls.push({ fn, args }); return Promise.resolve({ data: args.p_survivor, error: mockRpcErr }); },
  },
  supabase: {},
}));
const mockActivity = { calls: [] };
jest.mock('../../services/crm/activity', () => ({ logActivity: async (...a) => { mockActivity.calls.push(a); } }));

const { mergeLead } = require('../../services/crm/leadService');
beforeEach(() => { for (const k of Object.keys(mockRows)) delete mockRows[k]; mockRpc.calls = []; mockActivity.calls = []; mockRpcErr = null; });

test('folds loser into survivor via merge_lead_rows + logs activity', async () => {
  mockRows['surv'] = { id: 'surv', name: 'Vinit Sisle', status: 'qualified' };
  mockRows['lose'] = { id: 'lose', name: 'Adv. Vinit', email: 'adv@x.com' };
  const out = await mergeLead('surv', 'lose', 'admin1');
  expect(mockRpc.calls[0]).toEqual({ fn: 'merge_lead_rows', args: { p_survivor: 'surv', p_loser: 'lose' } });
  expect(out.id).toBe('surv');
  expect(mockActivity.calls[0][1]).toBe('lead_merged');
});

test('rejects self-merge', async () => {
  await expect(mergeLead('x', 'x', 'a')).rejects.toThrow(/into itself/);
  expect(mockRpc.calls).toHaveLength(0);
});

test('rejects when a lead is missing', async () => {
  mockRows['surv'] = { id: 'surv' };   // loser absent
  await expect(mergeLead('surv', 'gone', 'a')).rejects.toThrow(/not found/);
  expect(mockRpc.calls).toHaveLength(0);
});

test('propagates a merge rpc error', async () => {
  mockRows['surv'] = { id: 'surv' }; mockRows['lose'] = { id: 'lose' };
  mockRpcErr = { message: 'boom' };
  await expect(mergeLead('surv', 'lose', 'a')).rejects.toEqual({ message: 'boom' });
});
