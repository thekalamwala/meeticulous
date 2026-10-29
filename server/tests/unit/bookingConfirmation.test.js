/**
 * tests/unit/bookingConfirmation.test.js
 * The shared post-payment confirmation used by verify + webhook + reconciler:
 * it must always send BOOKING_CONFIRMED to guest AND host and fire reminders, and
 * only attempt a calendar event for an online service whose host has a Google token.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(() => Promise.resolve()) }));
jest.mock('../../config/google', () => ({ createCalendarEvent: jest.fn(() => Promise.resolve({ meetLink: 'https://meet/x', eventId: 'e1' })) }));
jest.mock('../../utils/profileSecrets', () => ({ attachGoogleTokens: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (x) => x }));
jest.mock('../../utils/manageBookingToken', () => ({ sign: () => 'tok' }));
jest.mock('../../controllers/bookingController', () => ({ fireDueReminders: jest.fn(() => Promise.resolve()) }));

const { supabaseAdmin } = require('../../config/supabase');
const NotificationEngine = require('../../services/notificationEngine');
const { createCalendarEvent } = require('../../config/google');
const { fireDueReminders } = require('../../controllers/bookingController');
const { sendBookingConfirmation } = require('../../services/bookingConfirmation');

const mockDb = (booking) => supabaseAdmin.from.mockImplementation((table) => {
  const chain = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.update = () => chain;
  chain.single = () => Promise.resolve({ data: table === 'bookings' ? booking : null });
  chain.maybeSingle = () => Promise.resolve({ data: table === 'availability' ? { timezone: 'Asia/Kolkata' } : null });
  return chain;
});

const baseBooking = (over = {}) => ({
  id: 'b1', host_id: 'h1', guest_id: null,
  guest_name: 'Guest', guest_email: 'g@example.com', guest_phone: '+910000000000',
  scheduled_at: '2026-08-20T07:50:00Z', meeting_link: '', notes: '',
  services: { title: 'Demo', duration: 30, meeting_mode: 'online' },
  profiles: { id: 'h1', name: 'Host', email: 'h@example.com', phone: '+911111111111', google_calendar_connected: true },
  ...over,
});

beforeEach(() => jest.clearAllMocks());

test('offline service: no calendar attempt, still confirms guest + host + reminder', async () => {
  mockDb(baseBooking({ services: { title: 'Meet', duration: 30, meeting_mode: 'offline' } }));
  await sendBookingConfirmation({ bookingId: 'b1' });
  expect(createCalendarEvent).not.toHaveBeenCalled();
  const events = NotificationEngine.send.mock.calls.map((c) => c[0].event);
  expect(events).toEqual(['BOOKING_CONFIRMED_CUSTOMER', 'BOOKING_CONFIRMED_VENDOR']);
  expect(fireDueReminders).toHaveBeenCalledTimes(1);
});

test('online but host has no refresh token: skips calendar, still confirms both', async () => {
  mockDb(baseBooking()); // attachGoogleTokens mock leaves google_refresh_token undefined
  await sendBookingConfirmation({ bookingId: 'b1' });
  expect(createCalendarEvent).not.toHaveBeenCalled();
  expect(NotificationEngine.send).toHaveBeenCalledTimes(2);
});

test('online with host token: creates the calendar event, then confirms both', async () => {
  const { attachGoogleTokens } = require('../../utils/profileSecrets');
  attachGoogleTokens.mockImplementation((host) => { host.google_refresh_token = 'r'; host.google_access_token = 'a'; });
  mockDb(baseBooking());
  await sendBookingConfirmation({ bookingId: 'b1' });
  expect(createCalendarEvent).toHaveBeenCalledTimes(1);
  expect(NotificationEngine.send).toHaveBeenCalledTimes(2);
});

test('missing booking: no-op, no sends', async () => {
  mockDb(null);
  await sendBookingConfirmation({ bookingId: 'nope' });
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('WhatsApp templateParams match the AiSensy 4-variable Booking Confirmed templates', async () => {
  const { attachGoogleTokens } = require('../../utils/profileSecrets');
  attachGoogleTokens.mockImplementation((host) => { host.google_refresh_token = 'r'; host.google_access_token = 'a'; });
  mockDb(baseBooking());
  await sendBookingConfirmation({ bookingId: 'b1' });
  const [customerCall, vendorCall] = NotificationEngine.send.mock.calls.map((c) => c[0]);
  // Exactly 4 body vars, no 5th link param — a 5th makes AiSensy reject with
  // "Template params does not match the campaign".
  expect(customerCall.data.templateParams).toHaveLength(4);
  expect(vendorCall.data.templateParams).toHaveLength(4);
  // Order must match the AiSensy templates.
  expect(customerCall.data.templateParams.slice(0, 3)).toEqual(['Guest', 'Demo', 'Host']); // {{1}} guest, {{2}} service, {{3}} host
  expect(vendorCall.data.templateParams.slice(0, 3)).toEqual(['Host', 'Guest', 'Demo']);   // {{1}} host, {{2}} guest, {{3}} service
});
