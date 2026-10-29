'use strict';
// Profile-completion reminder: nudge stalled hosts; cap + window dedup.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue({ ok: true }) }));

const { supabaseAdmin } = require('../../config/supabase');
const NotificationEngine = require('../../services/notificationEngine');
const { processProfileCompletion } = require('../../services/profileCompletion');

function wire({ profiles = [], logs = [] } = {}) {
  supabaseAdmin.from.mockImplementation((table) => {
    const c = {};
    c.select = () => c;
    ['eq', 'lt', 'limit'].forEach((m) => { c[m] = () => c; });
    c.then = (res, rej) => Promise.resolve(
      table === 'profiles' ? { data: profiles, error: null } : { data: logs, error: null }
    ).then(res, rej);
    return c;
  });
}

const HOST = { id: 'h1', name: 'Aarav Shah', email: 'a@example.com', username: 'aarav', onboarding_slug: 'aarav', onboarding_completed: false, is_host: true, updated_at: '2026-01-01T00:00:00Z' };
beforeEach(() => jest.clearAllMocks());

test('stalled host, never reminded → sends with slug', async () => {
  wire({ profiles: [HOST], logs: [] });
  const r = await processProfileCompletion();
  expect(r).toEqual({ sent: 1 });
  const sent = NotificationEngine.send.mock.calls[0][0];
  expect(sent.event).toBe('PROFILE_COMPLETION_REMINDER');
  expect(sent.data.emailData).toMatchObject({ slug: 'aarav', first_name: 'Aarav' });
});

test('reminded recently → skipped', async () => {
  wire({ profiles: [HOST], logs: [{ id: 'l1', created_at: new Date().toISOString() }] });
  const r = await processProfileCompletion();
  expect(r).toEqual({ sent: 0 });
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('max reminders already sent → skipped', async () => {
  const old = '2026-01-01T00:00:00Z';
  wire({ profiles: [HOST], logs: [{ id: 'l1', created_at: old }, { id: 'l2', created_at: old }] });
  const r = await processProfileCompletion();
  expect(r).toEqual({ sent: 0 });
});
