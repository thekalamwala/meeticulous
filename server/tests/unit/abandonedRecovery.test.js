'use strict';
// Abandoned-payment recovery: email once for a held, unpaid booking; dedup via email_logs.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../utils/manageBookingToken', () => ({ sign: () => 'TKN' }));

const { supabaseAdmin } = require('../../config/supabase');
const NotificationEngine = require('../../services/notificationEngine');
const { processAbandonedRecovery } = require('../../services/abandonedRecovery');

const BOOKING = { id: 'b1', guest_email: 'g@example.com', guest_name: 'Priya Rao', scheduled_at: '2026-08-30T10:30:00Z', service_id: 's1', host_id: 'h1' };

function wire({ bookings = [], priorLog = null, svc = { title: 'Sound Healing' }, host = { name: 'Aarav' } } = {}) {
  supabaseAdmin.from.mockImplementation((table) => {
    const c = {};
    ['select', 'eq', 'lt', 'gt', 'gte', 'lte', 'not', 'limit'].forEach((m) => { c[m] = () => c; });
    const res =
      table === 'bookings' ? { data: bookings, error: null } :
      table === 'email_logs' ? { data: priorLog, error: null } :
      table === 'services' ? { data: svc, error: null } :
      table === 'profiles' ? { data: host, error: null } : { data: null, error: null };
    c.maybeSingle = () => Promise.resolve(res);
    c.then = (r, j) => Promise.resolve(res).then(r, j);
    return c;
  });
}

beforeEach(() => jest.clearAllMocks());

test('held unpaid booking, not yet emailed → sends one recovery', async () => {
  wire({ bookings: [BOOKING], priorLog: null });
  const r = await processAbandonedRecovery();
  expect(r).toEqual({ sent: 1 });
  expect(NotificationEngine.send).toHaveBeenCalledTimes(1);
  const sent = NotificationEngine.send.mock.calls[0][0];
  expect(sent.event).toBe('BOOKING_ABANDONED_CUSTOMER');
  expect(sent.data.bookingId).toBe('b1');
  expect(sent.data.emailData).toMatchObject({ service_name: 'Sound Healing', vendor_name: 'Aarav', first_name: 'Priya' });
  expect(sent.data.emailData.resume_url).toContain('/manage-booking/TKN');
});

test('already emailed for this booking → skipped', async () => {
  wire({ bookings: [BOOKING], priorLog: { id: 'log1' } });
  const r = await processAbandonedRecovery();
  expect(r).toEqual({ sent: 0 });
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('no candidates → nothing sent, never throws', async () => {
  wire({ bookings: [] });
  const r = await processAbandonedRecovery();
  expect(r).toEqual({ sent: 0 });
});
