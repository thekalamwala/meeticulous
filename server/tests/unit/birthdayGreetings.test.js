'use strict';
// PR: birthday greetings — send BIRTHDAY to profiles whose DOB is today, once per year,
// gated by the birthday_greetings flag.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(async () => ({ email: { success: true } })) }));
jest.mock('../../services/crm/touchGovernor', () => ({
  canTouch: jest.fn(async () => ({ ok: true })),
  recordTouch: jest.fn(async () => {}),
}));

const { supabaseAdmin } = require('../../config/supabase');
const featureFlags = require('../../services/featureFlags');
const NotificationEngine = require('../../services/notificationEngine');
const governor = require('../../services/crm/touchGovernor');
const { processBirthdays } = require('../../services/birthdayGreetings');

const NOW = new Date('2026-06-15T09:00:00Z').getTime(); // today = 06-15, year 2026

function mockProfiles(rows) {
  const updates = [];
  supabaseAdmin.from.mockImplementation(() => ({
    select: () => ({ not: () => Promise.resolve({ data: rows, error: null }) }),
    update: (vals) => { updates.push(vals); return { eq: () => Promise.resolve({ error: null }) }; },
  }));
  return updates;
}

beforeEach(() => jest.clearAllMocks());

test('flag off → nothing sent, no query', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(false);
  const r = await processBirthdays(NOW);
  expect(r).toEqual({ sent: 0, skipped: 0 });
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});

test('greets a birthday today (not yet greeted this year) and stamps it', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  const updates = mockProfiles([
    { id: 'p1', name: 'Asha Kumar', email: 'a@x.com', date_of_birth: '1990-06-15', birthday_greeted_at: null },
  ]);
  const r = await processBirthdays(NOW);
  expect(r.sent).toBe(1);
  expect(NotificationEngine.send).toHaveBeenCalledTimes(1);
  const arg = NotificationEngine.send.mock.calls[0][0];
  expect(arg.event).toBe('BIRTHDAY');
  expect(arg.data).toMatchObject({ email: 'a@x.com', recipientUserId: 'p1' });
  expect(arg.data.emailData.first_name).toBe('Asha');
  expect(updates[0]).toHaveProperty('birthday_greeted_at');
  // Records the automated touch on the governor's ledger (as a profile subject).
  expect(governor.recordTouch).toHaveBeenCalledWith(
    { type: 'profile', id: 'p1' },
    expect.objectContaining({ channel: 'email', event: 'BIRTHDAY' }),
  );
});

test('governor cap skips the send and does NOT stamp (retries when the cap clears)', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  governor.canTouch.mockResolvedValueOnce({ ok: false, reason: 'frequency_capped' });
  const updates = mockProfiles([
    { id: 'p1', name: 'Asha Kumar', email: 'a@x.com', date_of_birth: '1990-06-15', birthday_greeted_at: null },
  ]);
  const r = await processBirthdays(NOW);
  expect(r.sent).toBe(0);
  expect(r.skipped).toBe(1);
  expect(NotificationEngine.send).not.toHaveBeenCalled();
  expect(updates).toHaveLength(0); // never stamped → next tick can retry
  expect(governor.recordTouch).not.toHaveBeenCalled();
});

test('skips already-greeted-this-year and no-email; ignores non-today birthdays', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  mockProfiles([
    { id: 'p2', name: 'Ben', email: 'b@x.com', date_of_birth: '1985-06-15', birthday_greeted_at: '2026-06-15T00:00:00Z' }, // greeted this year
    { id: 'p3', name: 'Cara', email: 'c@x.com', date_of_birth: '1992-03-01', birthday_greeted_at: null },                   // not today
    { id: 'p4', name: 'Dan', email: null, date_of_birth: '1991-06-15', birthday_greeted_at: '2025-06-15T00:00:00Z' },       // today but no email
  ]);
  const r = await processBirthdays(NOW);
  expect(r.sent).toBe(0);
  expect(r.skipped).toBe(2);            // p2 + p4 (p3 isn't today → not counted)
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});
