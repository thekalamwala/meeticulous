'use strict';
/**
 * touchGovernor DB-adapter tests (PR-7): canTouch (fail-open read) + recordTouch
 * (best-effort write via activity.logActivity). Subject resolution: lead direct,
 * profile → its linked lead, contact → PR-9 stub (fail-open, no ledger yet).
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/crm/activity', () => ({ logActivity: jest.fn(async () => 'act1') }));

const { supabaseAdmin } = require('../../config/supabase');
const { logActivity } = require('../../services/crm/activity');
const governor = require('../../services/crm/touchGovernor');

const H = 3600e3;
const now = Date.parse('2026-09-02T12:00:00Z');
const ago = (h) => new Date(now - h * H).toISOString();

// Chainable query builder: every filter returns itself; awaiting it (or .limit) resolves `result`.
const qb = (result) => {
  const b = {
    select: () => b, eq: () => b, in: () => b, gte: () => b, lte: () => b,
    limit: () => Promise.resolve(result), order: () => b,
    maybeSingle: () => Promise.resolve(result),
    then: (res, rej) => Promise.resolve(result).then(res, rej),
  };
  return b;
};

beforeEach(() => jest.clearAllMocks());

describe('canTouch', () => {
  test('lead with one automated touch 10h ago → capped', async () => {
    supabaseAdmin.from.mockReturnValueOnce(qb({ data: [{ occurred_at: ago(10) }], error: null }));
    const r = await governor.canTouch({ type: 'lead', id: 'lead1' }, now);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('frequency_capped');
  });

  test('lead with no automated touches → ok', async () => {
    supabaseAdmin.from.mockReturnValueOnce(qb({ data: [], error: null }));
    const r = await governor.canTouch({ type: 'lead', id: 'lead1' }, now);
    expect(r.ok).toBe(true);
  });

  test('read error → fail-open (ok)', async () => {
    supabaseAdmin.from.mockReturnValueOnce(qb({ data: null, error: { message: 'boom' } }));
    const r = await governor.canTouch({ type: 'lead', id: 'lead1' }, now);
    expect(r.ok).toBe(true);
  });

  test('profile subject resolves via leads.profile_id, then counts', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce(qb({ data: [{ id: 'lead9' }], error: null }))            // resolve lead
      .mockReturnValueOnce(qb({ data: [{ occurred_at: ago(5) }], error: null }));   // its touches
    const r = await governor.canTouch({ type: 'profile', id: 'prof1' }, now);
    expect(r.ok).toBe(false); // one touch 5h ago, default cap 1
  });

  test('profile with no linked lead → fail-open (no ledger yet)', async () => {
    supabaseAdmin.from.mockReturnValueOnce(qb({ data: [], error: null })); // no lead
    const r = await governor.canTouch({ type: 'profile', id: 'proflone' }, now);
    expect(r.ok).toBe(true);
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1); // never queried activities
  });

  test('contact (guest) subject with a recent automated clock → capped', async () => {
    supabaseAdmin.from.mockReturnValueOnce(qb({ data: { last_automated_touch_at: ago(10) }, error: null }));
    const r = await governor.canTouch({ type: 'contact', id: 'c1' }, now);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('frequency_capped');
  });

  test('contact (guest) subject with no automated clock → ok', async () => {
    supabaseAdmin.from.mockReturnValueOnce(qb({ data: { last_automated_touch_at: null }, error: null }));
    const r = await governor.canTouch({ type: 'contact', id: 'c1' }, now);
    expect(r.ok).toBe(true);
  });

  test('contact read error / pre-v3.139 column → fail-open', async () => {
    supabaseAdmin.from.mockReturnValueOnce(qb({ data: null, error: { message: 'column contacts.last_automated_touch_at does not exist' } }));
    const r = await governor.canTouch({ type: 'contact', id: 'c1' }, now);
    expect(r.ok).toBe(true);
  });
});

describe('recordTouch', () => {
  test('lead email touch → logActivity(email_sent, no actor, governed)', async () => {
    await governor.recordTouch({ type: 'lead', id: 'lead1' }, { channel: 'email', event: 'BIRTHDAY' });
    expect(logActivity).toHaveBeenCalledTimes(1);
    const [leadId, type, opts] = logActivity.mock.calls[0];
    expect(leadId).toBe('lead1');
    expect(type).toBe('email_sent');
    expect(opts.actorAdminId).toBeNull();
    expect(opts.meta.event).toBe('BIRTHDAY');
    expect(opts.meta.governed).toBe(true);
  });

  test('whatsapp channel maps to whatsapp_sent', async () => {
    await governor.recordTouch({ type: 'lead', id: 'lead1' }, { channel: 'whatsapp' });
    expect(logActivity.mock.calls[0][1]).toBe('whatsapp_sent');
  });

  test('profile resolves to its lead before logging', async () => {
    supabaseAdmin.from.mockReturnValueOnce(qb({ data: [{ id: 'lead9' }], error: null }));
    await governor.recordTouch({ type: 'profile', id: 'prof1' }, { channel: 'email' });
    expect(logActivity.mock.calls[0][0]).toBe('lead9');
  });

  test('profile with no lead → no-op, does not throw', async () => {
    supabaseAdmin.from.mockReturnValueOnce(qb({ data: [], error: null }));
    await expect(governor.recordTouch({ type: 'profile', id: 'x' }, { channel: 'email' })).resolves.toBeUndefined();
    expect(logActivity).not.toHaveBeenCalled();
  });

  test('contact (guest) stamps the contacts clock directly — no lead_activities write', async () => {
    const updates = [];
    supabaseAdmin.from.mockImplementation((t) => ({
      update: (vals) => { updates.push({ t, vals }); return { eq: () => Promise.resolve({ error: null }) }; },
    }));
    await governor.recordTouch({ type: 'contact', id: 'c1' }, { channel: 'email', event: 'BIRTHDAY' });
    expect(logActivity).not.toHaveBeenCalled();
    expect(updates[0].t).toBe('contacts');
    expect(updates[0].vals).toHaveProperty('last_automated_touch_at');
    expect(updates[0].vals).toHaveProperty('last_activity_at');
  });
});
