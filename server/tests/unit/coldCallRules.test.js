'use strict';
const r = require('../../services/crm/coldCallRules');

const NOW = new Date('2026-10-06T06:00:00Z'); // Tue 11:30 IST
const lead = (id, cc = {}, extra = {}) => ({ id, status: 'list', do_not_contact: false, attributes: { cold_call: { list_id: 'L', ...cc } }, ...extra });

describe('phone parsing', () => {
  test('phone10 handles 0-prefixed, +91, 91 and plain', () => {
    expect(r.phone10('08888705552')).toBe('8888705552');
    expect(r.phone10('+91 88887 05552')).toBe('8888705552');
    expect(r.phone10('918888705552')).toBe('8888705552');
    expect(r.phone10('8888705552')).toBe('8888705552');
    expect(r.phone10('12345')).toBeNull();
    expect(r.phone10('')).toBeNull();
  });
  test('waPhone10 reads scraped WhatsApp links and rejects junk', () => {
    expect(r.waPhone10('https://wa.me/919822176677')).toBe('9822176677');
    expect(r.waPhone10('https://api.whatsapp.com/send?phone=919922256169')).toBe('9922256169');
    expect(r.waPhone10('https://api.whatsapp.com/send?phone=+917972857192&amp;text=Hey')).toBe('7972857192');
    expect(r.waPhone10('https://api.whatsapp.com/send?phone=7021220659&amp;text=Hi')).toBe('7021220659');
    expect(r.waPhone10('https://api.whatsapp.com/send?phone=https://wa.me/918888705552')).toBe('8888705552');
    expect(r.waPhone10('https://wa.me/?text=https://www.example.com')).toBeNull();
    expect(r.waPhone10('')).toBeNull();
  });
});

describe('nextStep', () => {
  test('interested closes and moves to qualified with signup template', () => {
    const s = r.nextStep('interested', {}, NOW);
    expect(s.status).toBe('qualified');
    expect(s.template).toBe('cold_call_interested');
    expect(s.cold_call).toMatchObject({ attempts: 1, last_outcome: 'interested', closed: true, retry_at: null });
  });
  test('details retries in 3 days, not_now in 30 days', () => {
    expect(r.nextStep('details', {}, NOW).cold_call.retry_at).toBe('2026-10-09T06:00:00.000Z');
    expect(r.nextStep('not_now', {}, NOW).cold_call.retry_at).toBe('2026-11-05T06:00:00.000Z');
  });
  test('callback requires callbackAt and carries it', () => {
    expect(() => r.nextStep('callback', {}, NOW)).toThrow('callbackAt required');
    const s = r.nextStep('callback', {}, NOW, '2026-10-06T11:30:00Z');
    expect(s.callbackAt).toBe('2026-10-06T11:30:00.000Z');
    // safety net: if the Callback task is closed elsewhere, the lead resurfaces as a retry
    expect(s.cold_call.retry_at).toBe('2026-10-06T11:30:00.000Z');
    expect(s.cold_call.closed).toBe(false);
  });
  test('no_answer retries next day; third no-answer closes as unreachable', () => {
    const one = r.nextStep('no_answer', {}, NOW).cold_call;
    expect(one).toMatchObject({ no_answers: 1, closed: false, retry_at: '2026-10-07T06:00:00.000Z' });
    const three = r.nextStep('no_answer', { attempts: 2, no_answers: 2 }, NOW).cold_call;
    expect(three).toMatchObject({ attempts: 3, no_answers: 3, closed: true, closed_reason: 'unreachable', retry_at: null });
  });
  test('not_interested → dnc, wrong_number → tag, both closed, no template', () => {
    expect(r.nextStep('not_interested', {}, NOW)).toMatchObject({ dnc: true, template: null });
    expect(r.nextStep('wrong_number', {}, NOW)).toMatchObject({ tag: 'wrong-number', template: null });
    expect(r.nextStep('wrong_number', {}, NOW).cold_call.closed).toBe(true);
  });
  test('keeps unrelated cold_call fields (day/priority/pitch)', () => {
    expect(r.nextStep('details', { day: 'Day 2', pitch: 'x' }, NOW).cold_call).toMatchObject({ day: 'Day 2', pitch: 'x' });
  });
  test('unknown outcome throws', () => {
    expect(() => r.nextStep('maybe', {}, NOW)).toThrow('unknown outcome');
  });
});

describe('buildQueue', () => {
  test('orders callbacks due > retries due > fresh by day then priority', () => {
    const leads = [
      lead('fresh-d10', { day: 'Day 10', priority: '1' }),
      lead('fresh-d2-p5', { day: 'Day 2', priority: '5' }),
      lead('fresh-d2-p1', { day: 'Day 2', priority: '1' }),
      lead('retry', { attempts: 1, retry_at: '2026-10-06T05:00:00Z' }),
      lead('retry-future', { attempts: 1, retry_at: '2026-10-07T05:00:00Z' }),
      lead('cb', { attempts: 1 }),
      lead('cb-later', { attempts: 1 }),
      lead('closed', { attempts: 1, closed: true }),
      lead('dnc', {}, { do_not_contact: true }),
    ];
    const fus = [
      { id: 'f1', lead_id: 'cb', title: 'Callback: after OPD', due_at: '2026-10-06T05:50:00Z' },
      { id: 'f2', lead_id: 'cb-later', title: 'Callback: evening', due_at: '2026-10-06T12:00:00Z' },
      { id: 'f3', lead_id: 'fresh-d10', title: 'Send invoice', due_at: '2026-10-06T05:00:00Z' }, // not a callback
    ];
    const q = r.buildQueue(leads, fus, NOW);
    expect(q.callbacksDue.map((i) => i.lead.id)).toEqual(['cb']);
    expect(q.callbacksDue[0].overdue).toBe(true);
    expect(q.retries.map((i) => i.lead.id)).toEqual(['retry']);
    expect(q.fresh.map((i) => i.lead.id)).toEqual(['fresh-d2-p1', 'fresh-d2-p5', 'fresh-d10']);
    expect(q.upcoming.map((i) => i.lead.id)).toEqual(['cb-later']);
  });
  test('callback due within 15 minutes counts as due (not overdue)', () => {
    const q = r.buildQueue([lead('a', { attempts: 1 })], [{ id: 'f', lead_id: 'a', title: 'Callback: x', due_at: '2026-10-06T06:10:00Z' }], NOW);
    expect(q.callbacksDue[0]).toMatchObject({ overdue: false });
  });
  test('a fresh lead with an open callback is not also in fresh', () => {
    const q = r.buildQueue([lead('a')], [{ id: 'f', lead_id: 'a', title: 'Callback: x', due_at: '2026-10-07T06:00:00Z' }], NOW);
    expect(q.fresh).toEqual([]);
    expect(q.upcoming.length).toBe(1);
  });
});

describe('daily plan', () => {
  test('sortKey orders Day → Priority (P1 or rank) → Fit desc, missing last', () => {
    const keys = [
      r.sortKey({ day: 'Day 10', priority: '1' }),
      r.sortKey({ priority: 'P1', fit: '85' }),
      r.sortKey({ day: 'Day 2', priority: '5' }),
      r.sortKey({ priority: 'P2', fit: '99' }),
      r.sortKey({ priority: 'P1', fit: '99' }),
      r.sortKey({ day: 'Day 2', priority: '1' }),
      r.sortKey({}),
    ].sort();
    expect(keys).toEqual([
      r.sortKey({ day: 'Day 2', priority: '1' }), r.sortKey({ day: 'Day 2', priority: '5' }), r.sortKey({ day: 'Day 10', priority: '1' }),
      r.sortKey({ priority: 'P1', fit: '99' }), r.sortKey({ priority: 'P1', fit: '85' }), r.sortKey({ priority: 'P2', fit: '99' }), r.sortKey({}),
    ]);
    expect(r.sortKey({ day: 'Day 1', priority: 'P1', fit: '9' })).toBe('001.0001.091');
  });
  test('freshSlots fills what is left of the 60 after calls, callbacks and retries', () => {
    expect(r.DAILY_TARGET).toBe(60);
    expect(r.freshSlots({})).toBe(60);
    expect(r.freshSlots({ callsToday: 20, callbacksToday: 5, retries: 10 })).toBe(25);
    expect(r.freshSlots({ callsToday: 58, callbacksToday: 4 })).toBe(0);
  });
});

describe('overview', () => {
  test('outcomeMix counts outcomes, connected, interested and top objections; ignores non cold-call logs', () => {
    const m = r.outcomeMix([
      { outcome: 'interested' }, { outcome: 'not_now', objection: 'Price' }, { outcome: 'not_interested', objection: 'Price' },
      { outcome: 'no_answer' }, { outcome: 'details', objection: 'Busy' }, { outcome: null }, null, { outcome: 'demo_done' },
    ]);
    expect(m.byOutcome).toEqual({ interested: 1, not_now: 1, not_interested: 1, no_answer: 1, details: 1 });
    expect(m).toMatchObject({ calls: 5, connected: 4, interested: 1 });
    expect(m.objections).toEqual([{ label: 'Price', n: 2 }, { label: 'Busy', n: 1 }]);
  });
  test('followUpBuckets splits by IST day', () => {
    const b = r.followUpBuckets([
      { due_at: '2026-10-06T05:00:00Z' },   // before NOW → overdue
      { due_at: '2026-10-06T12:00:00Z' },   // 17:30 IST today
      { due_at: '2026-10-07T05:00:00Z' },   // tomorrow
      { due_at: '2026-10-09T05:00:00Z' },   // later
    ], NOW);
    expect(b).toEqual({ overdue: 1, today: 1, tomorrow: 1, later: 1 });
  });
});

describe('stats + dates', () => {
  test('todayStats counts connected and interested', () => {
    expect(r.todayStats(['interested', 'no_answer', 'details', 'wrong_number', null])).toEqual({ calls: 5, connected: 2, interested: 1 });
  });
  test('istDayEnd is the next IST midnight', () => {
    expect(r.istDayEnd(new Date('2026-10-05T20:00:00Z'))).toBe('2026-10-06T18:30:00.000Z');
  });
  test('IST day helpers', () => {
    const late = new Date('2026-10-05T20:00:00Z'); // 01:30 IST on Oct 6
    expect(r.istDate(late)).toBe('2026-10-06');
    expect(r.istDayStart(late)).toBe('2026-10-05T18:30:00.000Z');
    expect(r.formatIst('2026-10-07T11:30:00Z')).toMatch(/7 Oct/);
    expect(r.formatIst('2026-10-07T11:30:00Z')).toMatch(/5:00/);
  });
});
