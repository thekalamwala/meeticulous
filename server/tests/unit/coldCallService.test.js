'use strict';

// Chainable supabase stub: per-table result, records update() payloads.
const mockUpdates = [];
let mockTableData = {};
function mockChain(table) {
  const o = {};
  for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'is', 'not', 'neq', 'or', 'like', 'order', 'limit', 'maybeSingle', 'single']) o[m] = jest.fn(() => o);
  o.update = jest.fn((p) => { mockUpdates.push({ table, p }); return o; });
  o.then = (res) => Promise.resolve(mockTableData[table] || { data: null, error: null }).then(res);
  return o;
}
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn((t) => mockChain(t)) } }));
jest.mock('../../services/crm/leadService', () => ({
  upsertLead: jest.fn(), getLead: jest.fn(), logCall: jest.fn(), addNote: jest.fn(),
  changeStatus: jest.fn(), setDnc: jest.fn(), addTag: jest.fn(),
}));
jest.mock('../../services/crm/followUpService', () => ({ listOpen: jest.fn(), complete: jest.fn(), create: jest.fn() }));
jest.mock('../../services/crm/messageService', () => ({ enqueue: jest.fn() }));
jest.mock('../../services/crm/listService', () => ({ createList: jest.fn() }));

const leadService = require('../../services/crm/leadService');
const followUpService = require('../../services/crm/followUpService');
const messageService = require('../../services/crm/messageService');
const listService = require('../../services/crm/listService');
const svc = require('../../services/crm/coldCallService');

const NOW = new Date('2026-10-06T06:00:00Z');
const TPL = {
  email: { id: 't1', channel: 'email', name: 'cold_call_interested', category: 'cold_call_interested', subject: 'Hi {{business_name}}', body: '<p>link</p>', variables: [], is_active: true },
  whatsapp: { id: 't2', channel: 'whatsapp', name: 'cold_call_interested_wa', category: 'cold_call_interested', variables: [{ key: 'business_name' }], is_active: false },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdates.length = 0;
  mockTableData = {};
  const { supabaseAdmin } = require('../../config/supabase');
  supabaseAdmin.from.mockImplementation((t) => mockChain(t));
  followUpService.listOpen.mockResolvedValue([]);
  messageService.enqueue.mockResolvedValue({ status: 'sent', error: null });
  leadService.changeStatus.mockResolvedValue(undefined);
  followUpService.create.mockResolvedValue({ id: 'f' });
});

function withTemplates(email = TPL.email, whatsapp = TPL.whatsapp) {
  // sendFollowUp reads one template per channel via .eq('channel').eq('category').maybeSingle()
  const { supabaseAdmin } = require('../../config/supabase');
  supabaseAdmin.from.mockImplementation((t) => {
    const o = mockChain(t);
    if (t === 'crm_templates') {
      let ch = null;
      o.eq = jest.fn((col, v) => { if (col === 'channel') ch = v; return o; });
      o.then = (res) => Promise.resolve({ data: ch === 'email' ? email : whatsapp, error: null }).then(res);
    }
    return o;
  });
}

describe('importRows', () => {
  test('normalises phones, parses WhatsApp, keeps call history on re-import', async () => {
    leadService.upsertLead
      .mockResolvedValueOnce({ lead: { id: 'A', attributes: { cold_call: { attempts: 2, last_outcome: 'no_answer', day: 'Day 1' } } }, created: false })
      .mockResolvedValueOnce({ lead: { id: 'B', attributes: null }, created: true });
    const out = await svc.importRows({
      listId: 'L1',
      rows: [
        { business: 'Clinic A', phone: '08888705552', whatsapp: 'https://wa.me/919822176677', day: 'Day 2', priority: '3', pitch: 'p' },
        { business: 'Clinic B', phone: '9922256169' },
        { business: 'No phone', phone: '123' },
      ],
    });
    expect(out).toEqual({ created: 1, merged: 1, skipped: 1, listId: 'L1' });
    const [patchA, optsA] = leadService.upsertLead.mock.calls[0];
    expect(patchA).toMatchObject({ phone: '8888705552', whatsapp_phone: '919822176677', business_name: 'Clinic A', status: 'list', list_id: 'L1' });
    expect(optsA).toMatchObject({ source: 'cold_call', skipMetaLead: true });
    expect(leadService.upsertLead.mock.calls[1][0].whatsapp_phone).toBe('919922256169'); // fallback = phone
    const ccA = mockUpdates.find((u) => u.table === 'leads').p.attributes.cold_call;
    expect(ccA).toMatchObject({ list_id: 'L1', attempts: 2, last_outcome: 'no_answer', day: 'Day 2', priority: '3', pitch: 'p', sort_key: '002.0003.100' });
  });
  test('creates the list when only listName is given', async () => {
    listService.createList.mockResolvedValue({ id: 'NEW' });
    leadService.upsertLead.mockResolvedValue({ lead: { id: 'A', attributes: {} }, created: true });
    const out = await svc.importRows({ listName: 'Nagpur', rows: [{ phone: '8888705552' }] });
    expect(listService.createList).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nagpur', source: 'cold_call' }));
    expect(out.listId).toBe('NEW');
  });
  test('rejects missing list and oversized batches', async () => {
    await expect(svc.importRows({ rows: [] })).rejects.toMatchObject({ status: 400 });
    await expect(svc.importRows({ listId: 'L', rows: new Array(51).fill({ phone: '8888705552' }) })).rejects.toMatchObject({ status: 400 });
  });
});

describe('importRows — review fixes', () => {
  test('identifies by phone only; fills email only when blank and unclaimed', async () => {
    leadService.upsertLead.mockResolvedValue({ lead: { id: 'A', email: null, attributes: null }, created: true });
    await svc.importRows({ listId: 'L1', rows: [{ phone: '8888705552', email: 'shared@chain.in' }] });
    expect(leadService.upsertLead.mock.calls[0][0]).not.toHaveProperty('email');
    expect(mockUpdates.find((u) => u.table === 'leads').p.email).toBe('shared@chain.in');
  });
  test('does not take an email another lead already holds', async () => {
    mockTableData.leads = { data: { id: 'OTHER' }, error: null };
    leadService.upsertLead.mockResolvedValue({ lead: { id: 'A', email: null, attributes: null }, created: true });
    await svc.importRows({ listId: 'L1', rows: [{ phone: '8888705552', email: 'shared@chain.in' }] });
    expect(mockUpdates.find((u) => u.table === 'leads').p).not.toHaveProperty('email');
  });
  test('re-import without plan columns keeps stored day/priority/pitch', async () => {
    leadService.upsertLead.mockResolvedValue({ lead: { id: 'A', attributes: { cold_call: { day: 'Day 3', priority: '7', pitch: 'old' } } }, created: false });
    await svc.importRows({ listId: 'L1', rows: [{ phone: '8888705552' }] });
    expect(mockUpdates.find((u) => u.table === 'leads').p.attributes.cold_call).toMatchObject({ day: 'Day 3', priority: '7', pitch: 'old' });
  });
});

describe('recordOutcome', () => {
  const baseLead = { id: 'L1', status: 'list', email: 'a@b.co', business_name: 'Clinic', attributes: { cold_call: { list_id: 'X', day: 'Day 1' } } };

  test('interested: logs call first, moves to qualified, sends email, skips pending WhatsApp, idempotent key', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead });
    const order = [];
    leadService.logCall.mockImplementation(async () => { order.push('call'); });
    messageService.enqueue.mockImplementation(async () => { order.push('send'); return { status: 'sent', error: null }; });
    const out = await svc.recordOutcome('L1', { outcome: 'interested', note: 'loved it', durationSec: 95, send: { email: true, whatsapp: true } }, 'admin1', NOW);
    expect(order).toEqual(['call', 'send']);
    expect(leadService.logCall).toHaveBeenCalledWith('L1', { outcome: 'interested', durationMin: 2, body: 'loved it', objection: null }, 'admin1');
    expect(leadService.addNote).toHaveBeenCalledWith('L1', 'loved it', 'admin1');
    expect(leadService.changeStatus).toHaveBeenCalledWith('L1', 'qualified', 'admin1', { via: 'cold_call' });
    expect(messageService.enqueue).toHaveBeenCalledTimes(1);
    expect(messageService.enqueue.mock.calls[0][0]).toMatchObject({
      leadId: 'L1', channel: 'email', senderKey: 'shubham', immediate: true,
      idempotencyKey: 'cold:L1:interested:email:2026-10-06',
    });
    expect(out.sends).toEqual({ email: { status: 'sent', reason: null }, whatsapp: { status: 'skipped', reason: 'pending_aisensy' } });
    expect(mockUpdates.find((u) => u.table === 'leads').p.attributes.cold_call).toMatchObject({ attempts: 1, last_outcome: 'interested', closed: true, day: 'Day 1' });
  });

  test('a throwing send never loses the call log', async () => {
    withTemplates(TPL.email, { ...TPL.whatsapp, is_active: true });
    leadService.getLead.mockResolvedValue({ ...baseLead });
    messageService.enqueue.mockRejectedValue(new Error('aisensy down'));
    const out = await svc.recordOutcome('L1', { outcome: 'interested', send: { email: true, whatsapp: true } }, 'admin1', NOW);
    expect(leadService.logCall).toHaveBeenCalled();
    expect(out.sends.email).toEqual({ status: 'failed', reason: 'aisensy down' });
    expect(out.sends.whatsapp).toEqual({ status: 'failed', reason: 'aisensy down' });
  });

  test('never regresses a lead already further in the pipeline', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead, status: 'paid' });
    await svc.recordOutcome('L1', { outcome: 'details', send: {} }, 'admin1', NOW);
    expect(leadService.changeStatus).not.toHaveBeenCalled();
  });

  test('status-move failure becomes a warning, not an error', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead });
    leadService.changeStatus.mockRejectedValue(new Error('reason required'));
    const out = await svc.recordOutcome('L1', { outcome: 'details', send: {} }, 'admin1', NOW);
    expect(out.ok).toBe(true);
    expect(out.warnings).toEqual(['status: reason required']);
  });

  test('callback: requires time, completes old callback, opens a new one without email reminder', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead });
    await expect(svc.recordOutcome('L1', { outcome: 'callback' }, 'admin1', NOW)).rejects.toMatchObject({ status: 400 });
    followUpService.listOpen.mockResolvedValue([{ id: 'old', title: 'Callback: morning' }, { id: 'other', title: 'Send deck' }]);
    await svc.recordOutcome('L1', { outcome: 'callback', note: 'after OPD', callbackAt: '2026-10-06T11:30:00Z', send: {} }, 'admin1', NOW);
    expect(followUpService.complete).toHaveBeenCalledTimes(1);
    expect(followUpService.complete).toHaveBeenCalledWith('old', 'admin1');
    expect(followUpService.create).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'L1', title: 'Callback: after OPD', dueAt: '2026-10-06T11:30:00.000Z', remind: false,
    }));
  });

  test('callback email fills {{callback_time}} before enqueue', async () => {
    withTemplates({ ...TPL.email, category: 'cold_call_callback', subject: 'Talk {{callback_time}}', body: '<p>{{callback_time}} {{business_name}}</p>' });
    leadService.getLead.mockResolvedValue({ ...baseLead });
    await svc.recordOutcome('L1', { outcome: 'callback', callbackAt: '2026-10-07T11:30:00Z', send: { email: true } }, 'admin1', NOW);
    const arg = messageService.enqueue.mock.calls[0][0];
    expect(arg.subject).toMatch(/7 Oct/);
    expect(arg.variables.html).toMatch(/\{\{business_name\}\}/); // lead tokens still rendered later by messageService
  });

  test('not_interested marks DNC and sends nothing', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead });
    await svc.recordOutcome('L1', { outcome: 'not_interested', send: { email: true } }, 'admin1', NOW);
    expect(leadService.setDnc).toHaveBeenCalledWith('L1', true, 'admin1');
    expect(messageService.enqueue).not.toHaveBeenCalled();
  });

  test('email captured on the call is saved before sending', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead, email: null });
    await svc.recordOutcome('L1', { outcome: 'interested', email: ' New@Clinic.in ', send: { email: true } }, 'admin1', NOW);
    expect(mockUpdates.find((u) => u.table === 'leads' && u.p.email).p.email).toBe('new@clinic.in');
  });

  test('unknown lead → 404, unknown outcome → 400', async () => {
    leadService.getLead.mockResolvedValue(null);
    await expect(svc.recordOutcome('nope', { outcome: 'interested' }, 'a', NOW)).rejects.toMatchObject({ status: 404 });
    leadService.getLead.mockResolvedValue({ ...baseLead });
    await expect(svc.recordOutcome('L1', { outcome: 'maybe' }, 'a', NOW)).rejects.toMatchObject({ status: 400 });
  });
});

describe('recordOutcome — objection', () => {
  test('the objection raised on the call is stored on the call log (trimmed, capped)', async () => {
    leadService.getLead.mockResolvedValue({ id: 'L1', status: 'list', attributes: { cold_call: {} } });
    await svc.recordOutcome('L1', { outcome: 'not_now', objection: '  Already use software  ' }, 'admin1', NOW);
    expect(leadService.logCall.mock.calls[0][1].objection).toBe('Already use software');
  });
});

describe('recordOutcome — review fixes', () => {
  const baseLead = { id: 'L1', status: 'list', email: 'a@b.co', business_name: 'Clinic', attributes: { cold_call: {} } };

  test('not_interested on a paying customer keeps their status (no DNC) and warns', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead, status: 'paid' });
    const out = await svc.recordOutcome('L1', { outcome: 'not_interested', send: {} }, 'admin1', NOW);
    expect(leadService.setDnc).not.toHaveBeenCalled();
    expect(out.warnings.join(' ')).toMatch(/paying customer/);
  });

  test('a failing callback task becomes a warning, not a 500 after the call was logged', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead });
    followUpService.create.mockRejectedValue(new Error('db down'));
    const out = await svc.recordOutcome('L1', { outcome: 'callback', callbackAt: '2026-10-06T11:30:00Z', send: {} }, 'admin1', NOW);
    expect(out.ok).toBe(true);
    expect(out.warnings).toEqual(['callback task: db down']);
  });

  test('a second callback the same day gets its own idempotency key (new time is sent)', async () => {
    withTemplates({ ...TPL.email, category: 'cold_call_callback' });
    leadService.getLead.mockResolvedValue({ ...baseLead });
    await svc.recordOutcome('L1', { outcome: 'callback', callbackAt: '2026-10-07T11:30:00Z', send: { email: true } }, 'admin1', NOW);
    expect(messageService.enqueue.mock.calls[0][0].idempotencyKey).toBe('cold:L1:callback:email:2026-10-06:2026-10-07T11:30:00.000Z');
  });

  test('an already-sent follow-up is reported as already_sent, not sent', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead });
    const old = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    messageService.enqueue.mockResolvedValue({ status: 'sent', error: null, created_at: old });
    const out = await svc.recordOutcome('L1', { outcome: 'interested', send: { email: true } }, 'admin1', NOW);
    expect(out.sends.email).toEqual({ status: 'already_sent', reason: null });
  });
});

describe('getQueue — daily slice', () => {
  const L = (id, cc = {}) => ({ id, status: 'list', do_not_contact: false, attributes: { cold_call: { list_id: 'L1', ...cc } } });
  // leads queries are told apart by shape: count head / .in (callback leads) / .lte (retries) / .order (fresh).
  function queueDb({ calls = 0, followUps = [], cbLeads = [], retries = [], fresh = [] }) {
    const seen = { freshLimit: null, freshOrder: null, freshQueried: false };
    const { supabaseAdmin } = require('../../config/supabase');
    supabaseAdmin.from.mockImplementation((t) => {
      const o = mockChain(t);
      let kind = 'other';
      o.select = jest.fn((_c, opts) => { if (opts?.head) kind = 'count'; return o; });
      o.in = jest.fn(() => { kind = 'cb'; return o; });
      o.lte = jest.fn(() => { kind = 'retry'; return o; });
      o.order = jest.fn((col) => { if (t !== 'leads') return o; kind = 'fresh'; seen.freshOrder = col; seen.freshQueried = true; return o; });
      o.limit = jest.fn((n) => { if (kind === 'fresh') seen.freshLimit = n; return o; });
      o.then = (res) => {
        const data = {
          lead_follow_ups: { data: followUps },
          lead_activities: { data: Array.from({ length: calls }, () => ({ lead_id: 'x', meta: { outcome: 'no_answer' } })) },
          crm_messages: { data: [{ status: 'sent' }, { status: 'failed' }] },
          crm_templates: { data: [] },
        }[t] || ({ count: { count: 42 }, cb: { data: cbLeads }, retry: { data: retries }, fresh: { data: fresh } }[kind] || { data: [] });
        return Promise.resolve({ error: null, ...data }).then(res);
      };
      return o;
    });
    return seen;
  }

  test('fresh fills only what is left of the 60, ordered by sort_key in the DB', async () => {
    const seen = queueDb({
      calls: 40,
      followUps: [
        { id: 'f1', lead_id: 'CB', title: 'Callback: x', due_at: '2026-10-06T05:00:00Z' },      // due now
        { id: 'f2', lead_id: 'CB2', title: 'Callback: y', due_at: '2026-10-06T12:00:00Z' },     // later today
      ],
      cbLeads: [L('CB', { attempts: 1 }), { ...L('CB2', { attempts: 1 }), attributes: { cold_call: { list_id: 'OTHER', attempts: 1 } } }],
      retries: [L('R1', { attempts: 1, retry_at: '2026-10-06T00:00:00Z', closed: false })],
      fresh: Array.from({ length: 30 }, (_, i) => L(`F${i}`)),
    });
    const q = await svc.getQueue('L1', NOW);
    expect(q.callbacksDue.map((i) => i.lead.id)).toEqual(['CB']);
    expect(q.upcoming.map((i) => i.lead.id)).toEqual(['CB2']);           // callback from another list still shows
    expect(q.retries.map((i) => i.lead.id)).toEqual(['R1']);
    expect(q.fresh).toHaveLength(60 - 40 - 2 - 1);                         // 17
    expect(seen.freshOrder).toBe('attributes->cold_call->>sort_key');
    expect(seen.freshLimit).toBe(17 + 10);
    expect(q.today).toMatchObject({ calls: 40, target: 60, followUpsSent: 1 });
    expect(q.totals).toEqual({ fresh: 42, signedUp: 42 });
  });

  test('finished calls today come back as done, with their outcome', async () => {
    queueDb({ calls: 2, cbLeads: [L('x', { attempts: 1 })] });   // both calls are on lead x (no_answer)
    const q = await svc.getQueue('L1', NOW);
    expect(q.done.map((d) => [d.lead.id, d.outcome])).toEqual([['x', 'no_answer'], ['x', 'no_answer']]);
  });

  test('target reached → no fresh query at all', async () => {
    const seen = queueDb({ calls: 60, fresh: [L('F')] });
    const q = await svc.getQueue('L1', NOW);
    expect(q.fresh).toEqual([]);
    expect(seen.freshQueried).toBe(false);
  });
});

describe('stats (overview)', () => {
  test('rolls up the week across lists with per-list progress', async () => {
    const { supabaseAdmin } = require('../../config/supabase');
    supabaseAdmin.from.mockImplementation((t) => {
      const o = mockChain(t);
      let head = false;
      o.select = jest.fn((_c, opts) => { head = !!opts?.head; return o; });
      o.then = (res) => Promise.resolve({ error: null, ...(head ? { count: 7 } : {
        lead_activities: { data: [{ meta: { outcome: 'interested' } }, { meta: { outcome: 'no_answer' } }] },
        crm_messages: { data: [{ status: 'sent' }] },
        lead_follow_ups: { data: [{ id: 'f1', lead_id: 'A', title: 'Callback: x', due_at: '2026-10-06T05:00:00Z' }] },
        lead_lists: { data: [{ id: 'L1', name: 'Week 1' }] },
        leads: { data: [{ id: 'A', business_name: 'Bloom' }] },
      }[t] || { data: [] }) }).then(res);
      return o;
    });
    const s = await svc.stats({ days: 7 }, NOW);
    expect(s).toMatchObject({ days: 7, calls: 2, connected: 1, interested: 1, followUpsSent: 1, signedUp: 7 });
    expect(s.followUps).toMatchObject({ overdue: 1, next: [{ leadId: 'A', name: 'Bloom' }] });
    expect(s.lists).toEqual([{ id: 'L1', name: 'Week 1', total: 7, fresh: 7, interested: 7 }]);
  });
});

describe('search', () => {
  test('phone in any format matches the last 10 digits; short queries return nothing', async () => {
    const { supabaseAdmin } = require('../../config/supabase');
    let orArg = null;
    supabaseAdmin.from.mockImplementation((t) => { const o = mockChain(t); o.or = jest.fn((a) => { orArg = a; return o; }); return o; });
    mockTableData = { leads: { data: [{ id: 'A' }], error: null } };
    expect(await svc.search('+91 88887-05552')).toEqual([{ id: 'A' }]);
    expect(orArg).toContain('phone.ilike.%8888705552%');
    expect(orArg).toContain('whatsapp_phone.ilike.%8888705552%');
    await svc.search('Smile, (Dental)');
    expect(orArg).toContain('name.ilike.%Smile   Dental%');                 // , ( ) stripped — can't break the or()
    expect(orArg).not.toContain('phone.ilike');                             // no digits → no phone arm
    expect(await svc.search('ab')).toEqual([]);
  });
});

describe('send (follow-up window)', () => {
  test('sends the picked message set per channel with a category idempotency key', async () => {
    leadService.getLead.mockResolvedValue({ id: 'A', email: 'a@b.co', attributes: {} });
    withTemplates(TPL.email, { ...TPL.whatsapp, is_active: true, name: 'Cold Call Missed - Vendor' });
    const out = await svc.send('A', { email: { category: 'cold_call_missed' }, whatsapp: { category: 'cold_call_missed' } }, 'adm', NOW);
    expect(out.sends.email.status).toBe('sent');
    expect(out.sends.whatsapp.status).toBe('sent');
    const keys = messageService.enqueue.mock.calls.map(([a]) => a.idempotencyKey);
    expect(keys).toEqual(['cold:A:cold_call_missed:email:2026-10-06', 'cold:A:cold_call_missed:whatsapp:2026-10-06']);
    expect(messageService.enqueue.mock.calls[1][0].templateKey).toBe('Cold Call Missed - Vendor');
  });
  test('saves a typed email first; only ticked channels go; bad input → 400/404', async () => {
    leadService.getLead.mockResolvedValue({ id: 'A', email: null, attributes: {} });
    withTemplates();
    await svc.send('A', { email: { category: 'cold_call_interested' }, whatsapp: null, toEmail: 'New@Lead.co' }, 'adm', NOW);
    expect(mockUpdates.find((u) => u.table === 'leads').p.email).toBe('new@lead.co');
    expect(messageService.enqueue).toHaveBeenCalledTimes(1);
    await expect(svc.send('A', {}, 'adm', NOW)).rejects.toMatchObject({ status: 400 });
    await expect(svc.send('A', { email: { category: 'x; drop' } }, 'adm', NOW)).rejects.toMatchObject({ status: 400 });
    leadService.getLead.mockResolvedValue(null);
    await expect(svc.send('Z', { email: { category: 'cold_call_interested' } })).rejects.toMatchObject({ status: 404 });
  });
});

describe('updateDetails', () => {
  test('writes lead columns and call-only extras; blank clears; absent kept', async () => {
    leadService.getLead.mockResolvedValue({ id: 'A', attributes: { cold_call: { list_id: 'L1', hours: '9-5' } } });
    mockTableData = { leads: { data: { id: 'A' }, error: null } };
    await svc.updateDetails('A', { name: ' Priya ', email: 'PRIYA@Bloom.co', role: 'Owner', alt_phone: '', website: '' }, NOW);
    const p = mockUpdates.find((u) => u.table === 'leads').p;
    expect(p).toMatchObject({ name: 'Priya', email: 'priya@bloom.co', website: null });
    expect(p.attributes.cold_call).toEqual({ list_id: 'L1', hours: '9-5', role: 'Owner', alt_phone: null });
  });
  test('invalid email and empty body → 400', async () => {
    leadService.getLead.mockResolvedValue({ id: 'A', attributes: {} });
    await expect(svc.updateDetails('A', { email: 'nope' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.updateDetails('A', {})).rejects.toMatchObject({ status: 400 });
  });
});

describe('remind', () => {
  test('creates a Callback follow-up with no email reminder', async () => {
    leadService.getLead.mockResolvedValue({ id: 'L1' });
    await svc.remind('L1', { at: '2026-10-07T05:30:00Z', note: 'ask for Dr. G' }, 'admin1');
    expect(followUpService.create).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'L1', title: 'Callback: ask for Dr. G', dueAt: '2026-10-07T05:30:00.000Z', remind: false,
    }));
  });
  test('bad date → 400', async () => {
    await expect(svc.remind('L1', { at: 'soon' }, 'a')).rejects.toMatchObject({ status: 400 });
  });
});
