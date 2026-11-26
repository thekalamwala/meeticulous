'use strict';
// Guards the 2026-11-25 egress fix: the CRM crons must not issue one Supabase
// request per lead. (Prod API was suspended for exceeding Render bandwidth.)

const calls = [];
const PROFILES = [
  { id: 'p1', phone: '+91 98765 43210', email: 'a@x.com', created_at: '2026-01-01' },
  { id: 'p2', phone: null, email: 'b@x.com', created_at: '2026-01-02' },
];
const LEADS = [
  { id: 'l1', phone: '9876543210', email: null },      // phone match → p1
  { id: 'l2', phone: null, email: 'b@x.com' },          // email match → p2
  { id: 'l3', phone: '1112223334', email: 'zz@x.com' }, // no match
  { id: 'l4', phone: '919876543210999', email: null },  // digits embedded in a longer number → no match
];

function mockBuilder(table) {
  const q = { table, op: 'select', args: [] };
  calls.push(q);
  const b = {
    select() { return b; }, order() { return b; }, is() { return b; }, eq(...a) { q.args.push(a); return b; },
    range(from) { q.from = from; return b; },
    update(patch) { q.op = 'update'; q.patch = patch; return b; },
    then(res, rej) {
      let data = null;
      if (q.op === 'select' && table === 'profiles') data = q.from ? [] : PROFILES;
      if (q.op === 'select' && table === 'leads') data = q.from ? [] : LEADS;
      return Promise.resolve({ data, error: null }).then(res, rej);
    },
  };
  return b;
}

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (t) => mockBuilder(t) } }));
jest.mock('../../services/aisensyService', () => ({
  normalizePhone: (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 10 ? d : null; },
}));
jest.mock('../../services/contactsService', () => ({ syncLeads: jest.fn() }));

const { linkLeadsToProfiles } = require('../../services/crm/attribution');

describe('attribution.linkLeadsToProfiles', () => {
  beforeEach(() => { calls.length = 0; });

  test('reads profiles once, not once per lead, and links by exact phone then email', async () => {
    const linked = await linkLeadsToProfiles();
    expect(linked).toBe(2);
    const profileReads = calls.filter((c) => c.table === 'profiles');
    expect(profileReads).toHaveLength(1);
    const updates = calls.filter((c) => c.table === 'leads' && c.op === 'update');
    expect(updates.map((u) => [u.args[0][1], u.patch.profile_id])).toEqual([['l1', 'p1'], ['l2', 'p2']]);
  });
});

describe('lifecycle change detection', () => {
  const { scoringChanged, healthChanged } = require('../../services/crm/lifecycleEngine');

  test('unchanged score/intent/next action → no write', () => {
    const lead = { score: 40, intent: 'low', next_action: 'Call' };
    expect(scoringChanged(lead, { score: 40, intent: 'low', nextAction: 'Call' })).toBe(false);
    expect(scoringChanged(lead, { score: 41, intent: 'low', nextAction: 'Call' })).toBe(true);
    expect(scoringChanged({}, { score: 40, intent: 'low', nextAction: 'Call' })).toBe(true);
  });

  test('health signals compare by value, ignoring jsonb key order', () => {
    const lead = { health_state: 'cooling', health_score: 55, health_signals: { b: 2, a: { y: 1, x: [1, 2] } } };
    expect(healthChanged(lead, { state: 'cooling', score: 55, signals: { a: { x: [1, 2], y: 1 }, b: 2 } })).toBe(false);
    expect(healthChanged(lead, { state: 'cooling', score: 55, signals: { a: { x: [2, 1], y: 1 }, b: 2 } })).toBe(true);
    expect(healthChanged(lead, { state: 'at_risk', score: 55, signals: lead.health_signals })).toBe(true);
  });
});
