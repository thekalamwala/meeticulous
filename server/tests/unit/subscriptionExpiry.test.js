'use strict';
// Subscription renewal nudge: fire at T-7/T-1 for paid hosts; dedup per host.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../services/planService', () => ({
  isFreeSlug: (s) => ['free', 'starter', 'explorer', 'starter_legacy'].includes(String(s || '').toLowerCase()),
  // The renewal email reads the plan's display name straight from the row, so a
  // rename never leaves a stale label in a customer-facing send.
  getPlan: jest.fn(async (slug) => ({ slug, name: slug === 'premium' ? 'Pro' : 'Pro (Partner)' })),
}));

const { supabaseAdmin } = require('../../config/supabase');
const NotificationEngine = require('../../services/notificationEngine');
const { processSubscriptionExpiry } = require('../../services/subscriptionExpiry');

const DAY = 86400000;
const expiryIn = (days) => new Date(Date.now() + days * DAY - 60000).toISOString(); // ceil() → `days`

function wire({ profiles = [], priorLog = null } = {}) {
  supabaseAdmin.from.mockImplementation((table) => {
    const c = {};
    ['select', 'eq', 'not', 'gte', 'lte', 'gt', 'limit'].forEach((m) => { c[m] = () => c; });
    const res =
      table === 'profiles' ? { data: profiles, error: null } :
      table === 'email_logs' ? { data: priorLog, error: null } : { data: null, error: null };
    c.maybeSingle = () => Promise.resolve(res);
    c.then = (r, j) => Promise.resolve(res).then(r, j);
    return c;
  });
}

const host = (over = {}) => ({ id: 'h1', name: 'Aarav Shah', email: 'a@example.com', plan: 'creator', plan_expires_at: expiryIn(7), ...over });

beforeEach(() => jest.clearAllMocks());

test('paid host 7 days out → sends renewal nudge', async () => {
  wire({ profiles: [host()], priorLog: null });
  const r = await processSubscriptionExpiry();
  expect(r).toEqual({ sent: 1 });
  const sent = NotificationEngine.send.mock.calls[0][0];
  expect(sent.event).toBe('SUBSCRIPTION_EXPIRING');
  expect(sent.data.emailData).toMatchObject({ plan_name: 'Pro (Partner)', days_left: 7, first_name: 'Aarav' });
});

test('free host → skipped', async () => {
  wire({ profiles: [host({ plan: 'starter' })] });
  const r = await processSubscriptionExpiry();
  expect(r).toEqual({ sent: 0 });
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('not on a send-day (5 days out) → skipped', async () => {
  wire({ profiles: [host({ plan_expires_at: expiryIn(5) })] });
  const r = await processSubscriptionExpiry();
  expect(r).toEqual({ sent: 0 });
});

test('already nudged in the window → skipped', async () => {
  wire({ profiles: [host()], priorLog: { id: 'log1' } });
  const r = await processSubscriptionExpiry();
  expect(r).toEqual({ sent: 0 });
});
