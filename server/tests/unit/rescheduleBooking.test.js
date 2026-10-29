jest.mock('../../config/google', () => ({
  updateCalendarEvent: jest.fn().mockResolvedValue({}),
  createCalendarEvent: jest.fn(),
}));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue() }));
jest.mock('../../services/planService', () => ({
  rescheduleNotifyForPlan: jest.fn().mockResolvedValue(true),
  resolveVendorPlan: jest.fn(() => 'studio'),
}));
// The handler fires an un-awaited runInBackground(catchup-reminder). Left live, it
// runs AFTER the test ends — logging post-teardown and, on Node 22 (CI), rejecting
// into a fatal unhandled rejection that exits the worker 1 even though every test
// passes. No-op it: these tests assert the synchronous send/calendar path only.
jest.mock('../../utils/background', () => ({ runInBackground: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decryptToken: (v) => v, decrypt: (v) => v }));

const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

const featureFlags = require('../../services/featureFlags');
const { updateCalendarEvent } = require('../../config/google');
const NotificationEngine = require('../../services/notificationEngine');
const { rescheduleBooking } = require('../../controllers/bookingController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const futureISO = '2099-01-01T05:00:00.000Z';
const baseBooking = {
  id: 'b1', host_id: 'h1', guest_id: 'g1', status: 'confirmed', reschedule_count: 0,
  scheduled_at: '2098-12-01T05:00:00.000Z', services: { duration: 30, grace_period_minutes: 10 },
  google_event_id: 'evt1',
  'profiles!bookings_host_id_fkey': { id: 'h1', google_calendar_connected: true, google_refresh_token: 'r', google_access_token: 'a', reschedule_fee: 0 },
};

// Supabase mock: the FIRST .single() returns the booking; conflict query (await on
// the chain after .lte) resolves to { data: [], error: null }; the update().select().single()
// returns the updated row. Make the chain awaitable (thenable) resolving to empty conflicts.
const wire = (booking) => mockFrom.mockImplementation(() => {
  const chain = {
    select: jest.fn(() => chain), eq: jest.fn(() => chain), neq: jest.fn(() => chain),
    gte: jest.fn(() => chain), lte: jest.fn(() => chain), order: jest.fn(() => chain),
    update: jest.fn(() => chain),
    single: jest.fn().mockResolvedValue({ data: booking, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: { timezone: 'Asia/Kolkata', buffer_minutes: 0 } }),
    then: (resolve) => resolve({ data: [], error: null }), // conflict query awaits to empty
  };
  return chain;
});

beforeEach(() => jest.clearAllMocks());

test('403 when reschedule flag is off', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(false);
  wire(baseBooking);
  const r = res();
  await rescheduleBooking({ params: { id: 'b1' }, user: { id: 'g1' }, body: { scheduled_at: futureISO } }, r);
  expect(r.status).toHaveBeenCalledWith(403);
});

test('guest reschedule patches the calendar event when flag on', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  wire(baseBooking);
  const r = res();
  await rescheduleBooking({ params: { id: 'b1' }, user: { id: 'g1' }, body: { scheduled_at: futureISO } }, r);
  expect(updateCalendarEvent).toHaveBeenCalledWith('a', 'r', 'evt1', expect.objectContaining({ timezone: 'Asia/Kolkata' }));
});

// Regression guard: reschedule WhatsApp was silently unwired — the sends passed no
// phone and no templateParams, so the engine skipped WhatsApp entirely. It must now
// carry phone + EXACTLY 4 templateParams (matching the 4-var AiSensy template; a 5th
// is what broke "Booking Confirmed" for weeks).
test('reschedule sends carry phone + 4 whatsapp params to guest and host', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  wire({
    ...baseBooking,
    guest_name: 'Asha', guest_email: 'asha@x.com', guest_phone: '9990001111',
    'profiles!bookings_host_id_fkey': {
      ...baseBooking['profiles!bookings_host_id_fkey'],
      name: 'Nidhi', email: 'nidhi@x.com', phone: '8880002222', username: 'nidhi',
    },
  });
  const r = res();
  await rescheduleBooking({
    params: { id: 'b1' }, user: { id: 'g1' }, body: { scheduled_at: futureISO },
    protocol: 'https', get: () => 'api.test',
  }, r);

  const byEvent = (ev) => NotificationEngine.send.mock.calls.map((c) => c[0]).find((a) => a.event === ev);
  const cust = byEvent('BOOKING_RESCHEDULED_CUSTOMER');
  const vend = byEvent('BOOKING_RESCHEDULED_VENDOR');

  expect(cust.data.phone).toBe('9990001111');
  expect(cust.data.templateParams).toHaveLength(4);
  expect(cust.data.templateParams[0]).toBe('Asha');   // [guest, service, host, newTime]

  expect(vend.data.phone).toBe('8880002222');
  expect(vend.data.templateParams).toHaveLength(4);
  expect(vend.data.templateParams[0]).toBe('Nidhi');  // [host, guest, service, newTime]
});
