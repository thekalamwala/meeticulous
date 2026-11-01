'use strict';
// Cold Calling extras: per-lead WhatsApp tracking link, signup setup steps, best hour
// to call, the callback-reminder cron and the 6 pm recap email.
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
jest.mock('../../services/crm/activity', () => ({ logActivity: jest.fn() }));
jest.mock('../../utils/sendEmail', () => jest.fn());

const leadService = require('../../services/crm/leadService');
const messageService = require('../../services/crm/messageService');
const { logActivity } = require('../../services/crm/activity');
const sendEmail = require('../../utils/sendEmail');
const r = require('../../services/crm/coldCallRules');
const svc = require('../../services/crm/coldCallService');

const NOW = new Date('2026-10-06T12:30:00Z'); // 18:00 IST
const LEAD = { id: '40e43eb5-2511-433b-930c-62af03cb2a90', business_name: 'Bloom', phone: '9876543210', attributes: {} };
beforeEach(() => {
  jest.clearAllMocks(); mockCalls.length = 0; mockData = {};
  messageService.enqueue.mockImplementation(async () => ({ status: 'queued', created_at: NOW.toISOString() }));
});

describe('rules', () => {
  test('invite codes are 4 capital letters / digits; input is normalised', () => {
    for (let i = 0; i < 200; i++) expect(r.newRefCode()).toMatch(/^[A-Z0-9]{4}$/);
    expect(r.newRefCode(() => 0)).toBe('AAAA');
    expect(r.newRefCode(() => 0.999)).toBe('9999');
    expect(r.cleanRefCode(' cx12 ')).toBe('CX12');
    expect(r.cleanRefCode('CX1')).toBeNull();
    expect(r.cleanRefCode("CX1'")).toBeNull();
  });
  test('hourMix buckets calls by IST hour, connected excludes no-answer', () => {
    expect(r.hourMix([
      { meta: { outcome: 'interested' }, occurred_at: '2026-10-06T05:40:00Z' }, // 11:10 IST
      { meta: { outcome: 'no_answer' }, occurred_at: '2026-10-06T05:10:00Z' },  // 10:40 IST
      { meta: { outcome: 'not_now' }, occurred_at: '2026-10-06T05:50:00Z' },
      { meta: {}, occurred_at: '2026-10-06T05:50:00Z' },
    ])).toEqual([{ hour: 10, calls: 1, connected: 0 }, { hour: 11, calls: 2, connected: 2 }]);
  });
  test('setupSteps marks what a new host has done', () => {
    const s = r.setupSteps({ profile: { onboarding_completed: true }, services: 1, bookings: 0 });
    expect(s.filter((x) => !x.done).map((x) => x.key)).toEqual(['photo', 'booking']);
  });
  test('istHour', () => expect(r.istHour(NOW)).toBe(18));
});

describe('trackClick', () => {
  test('bad code never touches the DB', async () => {
    expect(await svc.trackClick('../etc')).toBe(false);
    expect(mockCalls).toHaveLength(0);
  });
  test('logs link_clicked on the lead holding that invite code (any case)', async () => {
    mockData = { leads: { data: { id: LEAD.id }, error: null } };
    expect(await svc.trackClick('cx12')).toBe(true);
    expect(mockCalls[0]._ops).toEqual(expect.arrayContaining([['eq', 'attributes->cold_call->>ref_code', 'CX12']]));
    expect(logActivity).toHaveBeenCalledWith(LEAD.id, 'link_clicked', expect.any(Object));
  });
});

describe('WhatsApp tracking link', () => {
  test('a ref variable is filled with the lead invite code as a body param', async () => {
    leadService.getLead.mockResolvedValue(LEAD);
    mockData = { leads: { data: { attributes: { cold_call: { ref_code: 'CX12' } } } }, crm_templates: { data: { channel: 'whatsapp', name: 'Cold Call Missed - Vendor', is_active: true, variables: [{ key: 'business_name' }, { key: 'link_code', ref: true }] } } };
    await svc.send(LEAD.id, { whatsapp: { category: 'cold_call_missed' } }, 'adm', NOW);
    expect(messageService.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      templateKey: 'Cold Call Missed - Vendor',
      variables: { params: ['{{business_name}}', 'CX12'] },
    }));
  });
  test('first send mints an unused code, skipping one already taken, and keeps other attributes', async () => {
    leadService.getLead.mockResolvedValue(LEAD);
    let n = 0;
    mockData = {
      leads: (o) => {
        if (o._ops.some(([m]) => m === 'update')) return { data: null, error: null };
        if (o._ops.some(([m, , opts]) => m === 'select' && opts?.head)) return { count: n++ === 0 ? 1 : 0, error: null };   // 1st code taken
        return { data: { attributes: { source: 'x', cold_call: { list_id: 'L' } } }, error: null };
      },
      crm_templates: { data: { channel: 'whatsapp', name: 'Cold Call Link - Vendor', is_active: true, variables: [{ key: 'business_name' }, { key: 'link_code', ref: true }] } },
    };
    await svc.send(LEAD.id, { whatsapp: { category: 'cold_call_link' } }, 'adm', NOW);
    const upd = mockCalls.find((c) => c._ops.some(([m]) => m === 'update'))._ops.find(([m]) => m === 'update')[1];
    expect(upd.attributes.source).toBe('x');
    expect(upd.attributes.cold_call.list_id).toBe('L');
    expect(upd.attributes.cold_call.ref_code).toMatch(/^[A-Z0-9]{4}$/);
    expect(messageService.enqueue.mock.calls[0][0].variables.params[1]).toBe(upd.attributes.cold_call.ref_code);
    expect(n).toBe(2);
  });
});

describe('callbackReminders', () => {
  test('does nothing until the template is approved', async () => {
    mockData = { crm_templates: { data: { is_active: false } } };
    expect(await svc.callbackReminders(NOW)).toEqual({ sent: 0 });
    expect(messageService.enqueue).not.toHaveBeenCalled();
  });
  test('sends once per callback, keyed on its due time', async () => {
    leadService.getLead.mockResolvedValue(LEAD);
    mockData = {
      crm_templates: (o) => (o._ops.some(([m, v]) => m === 'select' && v === 'is_active')
        ? { data: { is_active: true } }
        : { data: { channel: 'whatsapp', name: 'Cold Call Callback Reminder - Vendor', is_active: true, variables: [{ key: 'business_name' }, { key: 'callback_time' }] } }),
      lead_follow_ups: { data: [{ lead_id: LEAD.id, due_at: '2026-10-06T12:45:00.000Z' }] },
    };
    expect(await svc.callbackReminders(NOW)).toEqual({ sent: 1 });
    const call = messageService.enqueue.mock.calls[0][0];
    expect(call.idempotencyKey).toBe(`cold:${LEAD.id}:cb_reminder:whatsapp:2026-10-06:2026-10-06T12:45:00.000Z`);
    expect(call.variables.params[1]).toMatch(/6:15/);
  });
});

describe('dailyRecap', () => {
  test('skips a day with no calls and no callbacks', async () => {
    expect(await svc.dailyRecap(NOW)).toMatchObject({ sent: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });
  test('emails the day and tomorrow\'s callbacks', async () => {
    mockData = {
      lead_activities: (o) => (o._ops.some(([m, v]) => m === 'eq' && v === 'type')
        ? { data: [{ meta: { outcome: 'interested' }, occurred_at: '2026-10-06T06:00:00Z' }, { meta: { outcome: 'no_answer' }, occurred_at: '2026-10-06T07:00:00Z' }] }
        : { data: [] }),
      lead_follow_ups: { data: [{ lead_id: 'B', due_at: '2026-10-07T05:30:00.000Z', title: 'Callback: x' }] },
      leads: { data: [{ id: 'B', business_name: 'Sunrise <Dental>' }] },
    };
    expect(await svc.dailyRecap(NOW)).toEqual({ sent: true });
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe('hello@meeticulous.com');
    expect(mail.subject).toBe('Cold calling today: 2 calls · 1 interested');
    expect(mail.html).toContain('Sunrise &lt;Dental&gt;');
  });
});

describe('reports', () => {
  test('includes calls by hour', async () => {
    mockData = { lead_activities: { data: [{ lead_id: 'A', meta: { outcome: 'interested' }, occurred_at: '2026-10-06T05:40:00Z' }], error: null } };
    const out = await svc.reports({ days: 7 }, NOW);
    expect(out.byHour).toEqual([{ hour: 11, calls: 1, connected: 1 }]);
  });
});

describe('invite link (category page + ?i=<code>)', () => {
  test('code and link params are filled from the lead invite code', async () => {
    leadService.getLead.mockResolvedValue(LEAD);
    mockData = {
      leads: { data: { attributes: { cold_call: { ref_code: 'CX12' } } } },
      crm_templates: { data: { channel: 'whatsapp', name: 'Cold Call Link - Vendor', is_active: true, variables: [{ key: 'business_name' }, { key: 'invite_code', ref: 'code' }, { key: 'invite_link', ref: 'link' }] } },
    };
    await svc.send(LEAD.id, { whatsapp: { category: 'cold_call_link' } }, 'adm', NOW);
    expect(messageService.enqueue.mock.calls[0][0].variables.params).toEqual(['{{business_name}}', 'CX12', 'https://meeticulous.com/?i=CX12']);
  });
  test('signup from the invite links the account to that lead, never re-pointing a linked one', async () => {
    mockData = { leads: (o) => (o._ops.some(([m]) => m === 'update') ? { data: null } : { data: { id: 'A', profile_id: null } }) };
    expect(await svc.claimSignup('cx12', 'p1')).toBe(true);
    const upd = mockCalls.find((c) => c._ops.some(([m]) => m === 'update'));
    expect(upd._ops).toEqual(expect.arrayContaining([['update', expect.objectContaining({ profile_id: 'p1' })], ['eq', 'id', 'A'], ['is', 'profile_id', null]]));
    expect(logActivity).toHaveBeenCalledWith('A', 'host_signup', expect.any(Object));

    jest.clearAllMocks(); mockCalls.length = 0;
    mockData = { leads: { data: { id: 'A', profile_id: 'other' } } };
    expect(await svc.claimSignup('CX12', 'p1')).toBe(false);
    expect(mockCalls.some((c) => c._ops.some(([m]) => m === 'update'))).toBe(false);
    expect(await svc.claimSignup('not-a-code', 'p1')).toBe(false);
  });
});

describe('landingPath', () => {
  test.each([
    ['Dental clinic', '/for/dentists'], ['Pediatric dentist', '/for/dentists'], ['Skin care clinic', '/for/dermatologists'],
    ["Children's hospital", '/for/pediatricians'], ['Obstetrician-gynecologist', '/for/gynecologists'], ['ENT Specialist', '/for/ent-specialists'],
    ['Eye care center', '/for/ophthalmologists'], ['Physiotherapy Center', '/for/physiotherapists'], ['Hospital', '/for/doctors'],
    ['Beauty Parlour', '/for/salon'], ['Make-up artist', '/for/salon'], ['Day spa', '/for/spa'], ['Makerspace', '/'],
    ['Gym', '/for/fitness'], ['Box cricket turf', '/for/sports-turf'], ['Chartered accountant', '/for/chartered-accountants'],
    ['Legal services', '/for/lawyers'], ['Interior designer', '/for/architects'], ['Astrologer', '/for/astrologers'],
    ['Coaching Center', '/for/tutors'], ['Software company', '/for/agencies'], ['Psychologist', '/for/life-coaches'],
    ['Pharmacy', '/'], ['', '/'], [null, '/'],
  ])('%s → %s', (p, path) => expect(r.landingPath(p)).toBe(path));
});

test('the tracked link goes to the lead category page with ?i=<code>', async () => {
  leadService.getLead.mockResolvedValue({ ...LEAD, profession: 'Dental clinic' });
  mockData = {
    leads: { data: { attributes: { cold_call: { ref_code: 'CX12' } } } },
    crm_templates: { data: { channel: 'whatsapp', name: 'Cold Call Link - Vendor', is_active: true, variables: [{ key: 'business_name' }, { key: 'invite_link', ref: 'link' }] } },
  };
  await svc.send(LEAD.id, { whatsapp: { category: 'cold_call_link' } }, 'adm', NOW);
  expect(messageService.enqueue.mock.calls[0][0].variables.params).toEqual(['{{business_name}}', 'https://meeticulous.com/for/dentists?i=CX12']);
});
