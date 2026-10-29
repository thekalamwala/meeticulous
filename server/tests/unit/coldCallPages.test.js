'use strict';
// Cold Calling pages: Follow-ups, Call History, Reports (read-only roll-ups) and
// reschedule / mark-done of a lead's next follow-up.
const mockCalls = [];
let mockData = {};
function mockChain(table) {
  const o = { _table: table, _ops: [] };
  for (const m of ['select', 'eq', 'in', 'gte', 'lt', 'lte', 'is', 'not', 'neq', 'or', 'ilike', 'like', 'order', 'limit', 'range', 'maybeSingle', 'single']) {
    o[m] = jest.fn((...a) => { o._ops.push([m, ...a]); return o; });
  }
  o.update = jest.fn((p) => { o._ops.push(['update', p]); return o; });
  o.then = (res) => { mockCalls.push(o); return Promise.resolve(typeof mockData[table] === 'function' ? mockData[table](o) : (mockData[table] || { data: [], error: null })).then(res); };
  return o;
}
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn((t) => mockChain(t)) } }));
jest.mock('../../services/crm/leadService', () => ({ getLead: jest.fn() }));
jest.mock('../../services/crm/followUpService', () => ({ listOpen: jest.fn(), complete: jest.fn(), create: jest.fn() }));
jest.mock('../../services/crm/messageService', () => ({ enqueue: jest.fn() }));
jest.mock('../../services/crm/listService', () => ({ createList: jest.fn() }));

const leadService = require('../../services/crm/leadService');
const followUpService = require('../../services/crm/followUpService');
const r = require('../../services/crm/coldCallRules');
const svc = require('../../services/crm/coldCallService');

const NOW = new Date('2026-10-06T06:00:00Z'); // 11:30 IST
beforeEach(() => { jest.clearAllMocks(); mockCalls.length = 0; mockData = {}; });

describe('rules', () => {
  test('followUpRanges are IST-day bounds from now', () => {
    const x = r.followUpRanges(NOW);
    expect(x.overdue).toEqual([null, '2026-10-06T06:00:00.000Z']);
    expect(x.today).toEqual(['2026-10-06T06:00:00.000Z', '2026-10-06T18:30:00.000Z']);
    expect(x.tomorrow).toEqual(['2026-10-06T18:30:00.000Z', '2026-10-07T18:30:00.000Z']);
  });
  test('groupReport rolls calls up by a lead field, signups counted once per lead', () => {
    const leads = new Map([['A', { profession: 'Dental', profile_id: 'p' }], ['B', { profession: 'Salon' }]]);
    const rows = r.groupReport([
      { lead_id: 'A', meta: { outcome: 'no_answer' } }, { lead_id: 'A', meta: { outcome: 'interested' } },
      { lead_id: 'B', meta: { outcome: 'not_now' } }, { lead_id: 'Z', meta: { outcome: 'details' } }, { lead_id: 'B', meta: {} },
    ], leads, (l) => l.profession);
    expect(rows).toEqual([
      { key: 'Dental', calls: 2, connected: 1, interested: 1, signedUp: 1 },
      { key: 'Salon', calls: 1, connected: 1, interested: 0, signedUp: 0 },
      { key: 'Unknown', calls: 1, connected: 1, interested: 0, signedUp: 0 },
    ]);
  });
  test('wasSent counts any delivery state', () => {
    expect(['sent', 'delivered', 'opened'].every(r.wasSent)).toBe(true);
    expect(['queued', 'failed', 'skipped'].some(r.wasSent)).toBe(false);
  });
});

describe('followUps', () => {
  test('pages leads by next follow-up, bucket filter on retry_at, counts per bucket, last note', async () => {
    mockData = {
      leads: (o) => (o._ops.some(([m, , opts]) => m === 'select' && opts?.head)
        ? { count: 3, error: null }
        : { data: [{ id: 'A', business_name: 'Bloom', attributes: { cold_call: { retry_at: '2026-10-06T05:00:00.000Z', last_outcome: 'callback' } } }], count: 1, error: null }),
      lead_activities: { data: [{ lead_id: 'A', body: 'call after 11', occurred_at: '2026-10-05T10:00:00Z' }] },
    };
    const out = await svc.followUps({ bucket: 'overdue', q: 'Bloom' }, NOW);
    expect(out.rows[0]).toMatchObject({ nextAt: '2026-10-06T05:00:00.000Z', lastNote: 'call after 11' });
    expect(out.counts).toEqual({ overdue: 3, today: 3, tomorrow: 3, week: 3, nodate: 3 });
    const rowQuery = mockCalls.find((c) => c._table === 'leads' && c._ops.some(([m]) => m === 'range'));
    expect(rowQuery._ops).toEqual(expect.arrayContaining([['lt', 'attributes->cold_call->>retry_at', '2026-10-06T06:00:00.000Z'], ['range', 0, 24]]));
  });
  test('bad bucket → 400', async () => {
    await expect(svc.followUps({ bucket: 'x' }, NOW)).rejects.toMatchObject({ status: 400 });
  });
});

describe('setFollowUp', () => {
  test('reschedule moves the callback and retry_at; done clears both', async () => {
    leadService.getLead.mockResolvedValue({ id: 'A', attributes: { cold_call: { list_id: 'L', retry_at: 'old' } } });
    followUpService.listOpen.mockResolvedValue([{ id: 'f1', title: 'Callback: after 11' }, { id: 'f2', title: 'Send invoice' }]);
    await svc.setFollowUp('A', { at: '2026-10-07T05:30:00Z' }, 'adm');
    expect(followUpService.complete).toHaveBeenCalledWith('f1', 'adm');
    expect(followUpService.complete).not.toHaveBeenCalledWith('f2', 'adm');
    expect(followUpService.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Callback: after 11', dueAt: '2026-10-07T05:30:00.000Z' }));
    const upd = mockCalls.find((c) => c._ops.some(([m]) => m === 'update'))._ops.find(([m]) => m === 'update')[1];
    expect(upd.attributes.cold_call).toEqual({ list_id: 'L', retry_at: '2026-10-07T05:30:00.000Z' });

    jest.clearAllMocks(); mockCalls.length = 0;
    followUpService.listOpen.mockResolvedValue([{ id: 'f3', title: 'Callback: x' }]);
    await svc.setFollowUp('A', { done: true }, 'adm');
    expect(followUpService.create).not.toHaveBeenCalled();
    const upd2 = mockCalls.find((c) => c._ops.some(([m]) => m === 'update'))._ops.find(([m]) => m === 'update')[1];
    expect(upd2.attributes.cold_call.retry_at).toBeNull();
  });
  test('missing date → 400; unknown lead → 404', async () => {
    leadService.getLead.mockResolvedValue({ id: 'A', attributes: {} });
    await expect(svc.setFollowUp('A', {})).rejects.toMatchObject({ status: 400 });
    leadService.getLead.mockResolvedValue(null);
    await expect(svc.setFollowUp('Z', { done: true })).rejects.toMatchObject({ status: 404 });
  });
});

describe('history + reports', () => {
  test('history pages cold-call logs newest first with their lead', async () => {
    mockData = {
      lead_activities: { data: [{ id: 'a1', lead_id: 'A', meta: { outcome: 'interested', duration_min: 3, objection: 'Price' }, body: 'n', occurred_at: '2026-10-06T05:00:00Z' }], count: 1, error: null },
      leads: { data: [{ id: 'A', business_name: 'Bloom' }] },
    };
    const h = await svc.history({ days: 7, outcome: 'interested' }, NOW);
    expect(h.rows[0]).toMatchObject({ outcome: 'interested', objection: 'Price', durationMin: 3, lead: { business_name: 'Bloom' } });
    const q = mockCalls.find((c) => c._table === 'lead_activities');
    expect(q._ops).toEqual(expect.arrayContaining([['eq', 'meta->>outcome', 'interested'], ['order', 'occurred_at', { ascending: false }]]));
  });
  test('reports group by category and area', async () => {
    mockData = {
      lead_activities: { data: [{ lead_id: 'A', meta: { outcome: 'interested' } }, { lead_id: 'B', meta: { outcome: 'no_answer' } }], error: null },
      leads: { data: [{ id: 'A', profession: 'Dental', locality: 'Sadar' }, { id: 'B', profession: 'Dental', locality: 'Besa' }] },
    };
    const rep = await svc.reports({ days: 30 }, NOW);
    expect(rep.totals).toMatchObject({ calls: 2, connected: 1, interested: 1 });
    expect(rep.byCategory).toEqual([{ key: 'Dental', calls: 2, connected: 1, interested: 1, signedUp: 0 }]);
    expect(rep.byArea.map((x) => x.key).sort()).toEqual(['Besa', 'Sadar']);
  });
});
