'use strict';
// Upgrade nudge: email a free host once their total commission crosses the threshold.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../services/planService', () => ({
  resolveVendorPlan: (o) => (o && o.plan) || 'starter',
  isFreeSlug: (s) => ['starter', 'explorer', 'free', 'starter_legacy'].includes(String(s || '').toLowerCase()),
}));

const { supabaseAdmin } = require('../../config/supabase');
const NotificationEngine = require('../../services/notificationEngine');
const { maybeSendUpgradeNudge, THRESHOLD_INR } = require('../../services/upgradeNudge');

const HOST = { id: 'h1', email: 'host@example.com', name: 'Asha Rao' };

// One mock covers all three tables: profiles/email_logs use .maybeSingle();
// the bookings query is awaited directly, so the chain object is also thenable.
function wire({ plan = 'starter', bookings = [], prior = null } = {}) {
  supabaseAdmin.from.mockImplementation((table) => {
    const result =
      table === 'profiles' ? { data: { plan }, error: null } :
      table === 'bookings' ? { data: bookings, error: null } :
      table === 'email_logs' ? { data: prior, error: null } :
      { data: null, error: null };
    const c = {};
    c.select = () => c; c.eq = () => c; c.in = () => c; c.limit = () => c;
    c.maybeSingle = () => Promise.resolve(result);
    c.then = (res, rej) => Promise.resolve(result).then(res, rej);
    return c;
  });
}

beforeEach(() => jest.clearAllMocks());

test('free host over the threshold, not yet emailed → sends', async () => {
  wire({ plan: 'starter', bookings: [{ commission_applied: 200 }, { commission_applied: 200 }], prior: null });
  const r = await maybeSendUpgradeNudge({ host: HOST, booking: { id: 'b1' } });
  expect(r).toEqual({ sent: true });
  expect(NotificationEngine.send).toHaveBeenCalledTimes(1);
  const sent = NotificationEngine.send.mock.calls[0][0];
  expect(sent.event).toBe('UPGRADE_COMMISSION_NUDGE');
  expect(sent.data.emailData).toMatchObject({ commission_total: '₹400', bookings_count: 2 });
});

test('paid host → skipped (already 0% commission)', async () => {
  wire({ plan: 'creator', bookings: [{ commission_applied: 999 }] });
  const r = await maybeSendUpgradeNudge({ host: HOST, booking: { id: 'b1' } });
  expect(r).toEqual({ sent: false, reason: 'paid_plan' });
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('free host below the threshold → skipped', async () => {
  wire({ plan: 'starter', bookings: [{ commission_applied: THRESHOLD_INR - 1 }] });
  const r = await maybeSendUpgradeNudge({ host: HOST, booking: { id: 'b1' } });
  expect(r).toEqual({ sent: false, reason: 'below_threshold' });
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('already emailed (email_logs) → deduped', async () => {
  wire({ plan: 'starter', bookings: [{ commission_applied: 5000 }], prior: { id: 'log1' } });
  const r = await maybeSendUpgradeNudge({ host: HOST, booking: { id: 'b1' } });
  expect(r).toEqual({ sent: false, reason: 'already_sent' });
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('never throws — resolves to reason:error on failure', async () => {
  wire({ plan: 'starter', bookings: [{ commission_applied: 5000 }], prior: null });
  NotificationEngine.send.mockRejectedValueOnce(new Error('provider down'));
  const r = await maybeSendUpgradeNudge({ host: HOST, booking: { id: 'b1' } });
  expect(r).toEqual({ sent: false, reason: 'error' });
});
