'use strict';
// P3: cross-board team handoffs. Pure helpers (teamForPipeline / pickLeastLoaded)
// plus onCrossBoard's I/O — reassign to the receiving team, audit, and open the SLA.

const mockState = { lead: null, members: [], owned: [], updates: [], activities: [], slas: [] };

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from(table) {
      const b = {
        _t: table, _in: false,
        select() { return this; },
        eq() { return this; }, not() { return this; },
        in() { this._in = true; return this; },
        maybeSingle() { return Promise.resolve({ data: mockState.lead, error: null }); },
        then(res, rej) {
          const out = table === 'admin_users' ? { data: mockState.members }
            : (table === 'leads' && this._in) ? { data: mockState.owned }
              : { data: [] };
          return Promise.resolve({ ...out, error: null }).then(res, rej);
        },
        update(patch) { mockState.updates.push({ table, patch }); return { eq: () => Promise.resolve({ error: null }) }; },
      };
      return b;
    },
  },
  supabase: {},
}));
jest.mock('../../services/crm/activity', () => ({ logActivity: async (id, type, opts) => { mockState.activities.push({ id, type, meta: opts && opts.meta }); } }));
jest.mock('../../services/crm/followUpService', () => ({ openAuto: async (p) => { mockState.slas.push(p); return { id: 'fu1' }; } }));

const H = require('../../services/crm/handoffService');

beforeEach(() => { mockState.lead = null; mockState.members = []; mockState.owned = []; mockState.updates = []; mockState.activities = []; mockState.slas = []; });

describe('teamForPipeline (pure)', () => {
  test('maps each board to its team; exit → none', () => {
    expect(H.teamForPipeline('presale')).toBe('sales');
    expect(H.teamForPipeline('relations')).toBe('relations');
    expect(H.teamForPipeline('marketing')).toBe('marketing');
    expect(H.teamForPipeline('exit')).toBeNull();
  });
});

describe('pickLeastLoaded (pure)', () => {
  const members = [{ id: 'a', load: 3 }, { id: 'b', load: 1 }, { id: 'c', load: 1 }];
  test('no members → null', () => { expect(H.pickLeastLoaded([], 'x')).toBeNull(); });
  test('keeps the current owner if they are on the team (no churn)', () => {
    expect(H.pickLeastLoaded(members, 'a')).toBe('a');
  });
  test('picks the least-loaded member; ties break to array order', () => {
    expect(H.pickLeastLoaded(members, null)).toBe('b');
    expect(H.pickLeastLoaded(members, 'zzz')).toBe('b');
  });
});

describe('onCrossBoard (I/O)', () => {
  test('Presale → Relations: reassigns to least-loaded, logs handoff, opens SLA', async () => {
    mockState.lead = { owner_admin_id: 'sales1' };                       // owner is a sales rep, not on relations
    mockState.members = [{ id: 'rel_a' }, { id: 'rel_b' }];
    mockState.owned = [{ owner_admin_id: 'rel_a' }, { owner_admin_id: 'rel_a' }];  // rel_a load 2, rel_b load 0
    const r = await H.onCrossBoard({ leadId: 'L1', from: 'qualified', to: 'paid', actorAdminId: null });
    expect(r).toEqual({ handoff: true, team: 'relations', newOwner: 'rel_b' });
    expect(mockState.updates.find((u) => u.table === 'leads')?.patch.owner_admin_id).toBe('rel_b');
    const h = mockState.activities.find((a) => a.type === 'handoff');
    expect(h.meta).toMatchObject({ from_pipeline: 'presale', to_pipeline: 'relations', team: 'relations', prev_owner: 'sales1', new_owner: 'rel_b' });
    expect(mockState.slas[0]).toMatchObject({ leadId: 'L1', key: 'handoff:relations' });
  });

  test('within a board (Relations → Relations) → no handoff', async () => {
    const r = await H.onCrossBoard({ leadId: 'L1', from: 'paid', to: 'won' });
    expect(r).toEqual({ handoff: false });
    expect(mockState.activities).toHaveLength(0);
  });

  test('move to Exit → no team handoff', async () => {
    const r = await H.onCrossBoard({ leadId: 'L1', from: 'qualified', to: 'lost' });
    expect(r).toEqual({ handoff: false });
  });

  test('receiving team has no members → still logs + opens SLA, keeps owner', async () => {
    mockState.lead = { owner_admin_id: 'keep_me' };
    mockState.members = [];
    const r = await H.onCrossBoard({ leadId: 'L1', from: 'qualified', to: 'paid' });
    expect(r).toEqual({ handoff: true, team: 'relations', newOwner: 'keep_me' });
    expect(mockState.updates.filter((u) => u.table === 'leads')).toHaveLength(0);   // no reassign
    expect(mockState.slas[0].key).toBe('handoff:relations');
  });
});
