'use strict';
// Guest→host invite: email repeat guests who aren't hosts; dedup + guards.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue({ ok: true }) }));

const { supabaseAdmin } = require('../../config/supabase');
const NotificationEngine = require('../../services/notificationEngine');
const { processGuestHostInvites } = require('../../services/guestHostInvite');

function wire({ scanRows = [], profile = { is_host: false, name: 'Priya Rao', email: 'g@example.com' }, completedCount = 2, priorLog = null } = {}) {
  supabaseAdmin.from.mockImplementation((table) => {
    const c = { _head: false };
    c.select = (_s, o) => { c._head = !!(o && o.head); return c; };
    ['eq', 'gt', 'not', 'limit'].forEach((m) => { c[m] = () => c; });
    c.maybeSingle = () => Promise.resolve(
      table === 'profiles' ? { data: profile, error: null } :
      table === 'email_logs' ? { data: priorLog, error: null } : { data: null, error: null });
    c.then = (res, rej) => {
      const out = table === 'bookings'
        ? (c._head ? { count: completedCount, error: null } : { data: scanRows, error: null })
        : { data: null, error: null };
      return Promise.resolve(out).then(res, rej);
    };
    return c;
  });
}

const SCAN = [{ guest_id: 'g1', guest_email: 'g@example.com', guest_name: 'Priya Rao' }];
beforeEach(() => jest.clearAllMocks());

test('repeat guest, not a host, not invited → sends', async () => {
  wire({ scanRows: SCAN, completedCount: 2, priorLog: null });
  const r = await processGuestHostInvites();
  expect(r).toEqual({ sent: 1 });
  const sent = NotificationEngine.send.mock.calls[0][0];
  expect(sent.event).toBe('GUEST_TO_HOST_INVITE');
  expect(sent.data.emailData).toMatchObject({ completed_count: 2, first_name: 'Priya' });
  expect(sent.data.emailData.become_host_url).toContain('/become-a-host');
});

test('guest is already a host → skipped', async () => {
  wire({ scanRows: SCAN, profile: { is_host: true, name: 'Priya', email: 'g@example.com' } });
  const r = await processGuestHostInvites();
  expect(r).toEqual({ sent: 0 });
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('below the booking minimum → skipped', async () => {
  wire({ scanRows: SCAN, completedCount: 1 });
  const r = await processGuestHostInvites();
  expect(r).toEqual({ sent: 0 });
});

test('already invited → skipped', async () => {
  wire({ scanRows: SCAN, completedCount: 5, priorLog: { id: 'log1' } });
  const r = await processGuestHostInvites();
  expect(r).toEqual({ sent: 0 });
});
