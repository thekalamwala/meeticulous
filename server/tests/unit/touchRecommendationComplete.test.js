'use strict';
// PR-4: acting on a recommendation records the touch on the lead timeline (which, via
// a real channel, stamps the meaningful-interaction clock) and closes the rec — the
// TOUCH → RESPONSE → updated-state loop.

jest.mock('../../services/crm/activity', () => ({ logActivity: jest.fn(async () => 'act1') }));
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));

const { supabaseAdmin } = require('../../config/supabase');
const { logActivity } = require('../../services/crm/activity');
const svc = require('../../services/crm/touchRecommendationService');

function mockDb(rec) {
  const updates = [];
  supabaseAdmin.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: rec, error: null }) }) }),
    update: (vals) => { updates.push(vals); return { eq: () => Promise.resolve({ error: null }) }; },
  }));
  return updates;
}

const REC = { id: 'r1', lead_id: 'L1', reason: 'cooling', touch_type: 'check_in' };

beforeEach(() => jest.clearAllMocks());

test('complete via WhatsApp logs a meaningful contact tagged with the reason, and closes the rec', async () => {
  const updates = mockDb(REC);
  const r = await svc.complete({ recId: 'r1', adminId: 'a1', channel: 'whatsapp', outcome: 'replied' });
  expect(r).toEqual({ ok: true });

  expect(logActivity).toHaveBeenCalledTimes(1);
  const [leadId, type, opts] = logActivity.mock.calls[0];
  expect(leadId).toBe('L1');
  expect(type).toBe('whatsapp_sent');            // CONTACT type → stamps the meaningful clock (v3.133)
  expect(opts.actorAdminId).toBe('a1');          // human actor
  expect(opts.touchReason).toBe('cooling');      // tags the timeline row (v3.137)
  expect(opts.meta).toMatchObject({ recommendation_id: 'r1', touch_type: 'check_in', outcome: 'replied' });

  const done = updates.find((u) => u.status === 'done');
  expect(done).toMatchObject({ status: 'done', acted_by_admin_id: 'a1', outcome: 'replied' });
});

test('channel maps to the right contact type (email → email_sent)', async () => {
  mockDb(REC);
  await svc.complete({ recId: 'r1', adminId: 'a1', channel: 'email' });
  expect(logActivity.mock.calls[0][1]).toBe('email_sent');
});

test('no channel → recorded as touch_logged (not a contact type, so not a meaningful stamp)', async () => {
  mockDb(REC);
  await svc.complete({ recId: 'r1', adminId: 'a1' });
  expect(logActivity.mock.calls[0][1]).toBe('touch_logged');
});

test('unknown rec → notFound, nothing logged', async () => {
  mockDb(null);
  const r = await svc.complete({ recId: 'nope', adminId: 'a1', channel: 'whatsapp' });
  expect(r).toEqual({ ok: false, notFound: true });
  expect(logActivity).not.toHaveBeenCalled();
});

test('a GUEST rec stamps the contact clocks directly (no lead_activities write)', async () => {
  const updates = mockDb({ id: 'r9', subject_type: 'guest', contact_id: 'c9', lead_id: null, reason: 'dormant', touch_type: 'winback' });
  const r = await svc.complete({ recId: 'r9', adminId: 'a1', channel: 'email', outcome: 'sent' });
  expect(r).toEqual({ ok: true });
  expect(logActivity).not.toHaveBeenCalled();       // no lead → no timeline row
  // stamps the guest's meaningful/activity clocks, then closes the rec
  const stamp = updates.find((u) => u.last_meaningful_interaction_at);
  expect(stamp).toMatchObject({ last_meaningful_channel: 'email' });
  expect(stamp).toHaveProperty('last_activity_at');
  const done = updates.find((u) => u.status === 'done');
  expect(done).toMatchObject({ status: 'done', acted_by_admin_id: 'a1' });
});
