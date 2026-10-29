'use strict';
// leadService.listLeads — listId filter (Lists table) + default cold exclusion.
// Cold pool (status='list') must never leak into Sales/pipeline board views, and
// the Lists view must see ONLY that one list's cold rows.

jest.mock('../../config/supabase', () => {
  const calls = [];
  const qb = () => {
    const q = { _f: [] };
    for (const m of ['select','eq','neq','gt','gte','ilike','contains','or','order','range']) {
      q[m] = (...a) => { q._f.push([m, ...a]); return q; };
    }
    q.then = (res) => { calls.push(q._f); return Promise.resolve(res({ data: [], count: 0, error: null })); };
    return q;
  };
  return { supabaseAdmin: { from: () => qb() }, __calls: calls };
});
const { listLeads } = require('../../services/crm/leadService');

const flatEq = (calls, method, col, val) => calls.some((f) => f.some((c) => c[0] === method && c[1] === col && (val === undefined || c[2] === val)));

test('listLeads() without listId excludes cold (status=list)', async () => {
  const { __calls } = require('../../config/supabase');
  __calls.length = 0;
  await listLeads({});
  expect(flatEq(__calls, 'neq', 'status', 'list')).toBe(true);   // .neq('status','list')
});

test('listLeads({listId}) filters to that list and status=list', async () => {
  const { __calls } = require('../../config/supabase');
  __calls.length = 0;
  await listLeads({ listId: 'LID' });
  expect(flatEq(__calls, 'eq', 'list_id')).toBe(true);
  expect(flatEq(__calls, 'eq', 'status', 'list')).toBe(true);
});
