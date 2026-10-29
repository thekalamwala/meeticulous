/**
 * Regression guard for the AiSensy "Booking Confirmed" template mismatch.
 *
 * The approved AiSensy template takes EXACTLY 4 body variables:
 *   Customer: {{1}} guest, {{2}} service, {{3}} host, {{4}} date/time
 *   Vendor:   {{1}} host,  {{2}} guest,   {{3}} service, {{4}} date/time
 * An earlier version appended the Meet link as a 5th param for ONLINE bookings,
 * which made every online confirmation fail "Template params does not match the
 * campaign" (offline sent 4 and worked — the split that made it look random).
 *
 * This locks it: even for an ONLINE booking that got a Meet link, the two
 * BOOKING_CONFIRMED_* sends must carry exactly 4 templateParams.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(() => Promise.resolve()) }));
jest.mock('../../config/google', () => ({ createCalendarEvent: jest.fn(() => Promise.resolve({ meetLink: 'https://meet.google.com/x', eventId: 'e1' })) }));
jest.mock('../../utils/profileSecrets', () => ({ attachGoogleTokens: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (x) => x }));
jest.mock('../../utils/manageBookingToken', () => ({ sign: () => 'tok' }));
jest.mock('../../controllers/bookingController', () => ({ fireDueReminders: jest.fn(() => Promise.resolve()) }));

const { supabaseAdmin } = require('../../config/supabase');
const NotificationEngine = require('../../services/notificationEngine');
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

const onlineBookingWithMeet = {
  id: 'b1', host_id: 'h1', guest_id: null,
  guest_name: 'Guest', guest_email: 'g@example.com', guest_phone: '+910000000000',
  scheduled_at: '2026-08-20T07:50:00Z', meeting_link: 'https://meet.google.com/x', notes: '',
  services: { title: 'Demo', duration: 30, meeting_mode: 'online' },
  // host HAS a refresh token → the calendar/Meet path runs (the online case that
  // used to append a 5th link param)
  profiles: { id: 'h1', name: 'Host', email: 'h@example.com', phone: '+911111111111', google_calendar_connected: true, google_refresh_token: 'r', google_access_token: 'a' },
};

beforeEach(() => jest.clearAllMocks());

test('online booking with a Meet link sends BOTH confirmations with exactly 4 templateParams', async () => {
  mockDb(onlineBookingWithMeet);
  await sendBookingConfirmation({ bookingId: 'b1' });

  const confirmed = NotificationEngine.send.mock.calls
    .map((c) => c[0])
    .filter((e) => e.event === 'BOOKING_CONFIRMED_CUSTOMER' || e.event === 'BOOKING_CONFIRMED_VENDOR');

  expect(confirmed).toHaveLength(2);
  for (const e of confirmed) {
    expect(Array.isArray(e.data.templateParams)).toBe(true);
    // 4-var AiSensy template — a 5th param (e.g. the Meet link) fails "params do not match".
    // The booking carries a meeting_link, so this guards that the link never leaks
    // into the confirmation's templateParams.
    expect(e.data.templateParams).toHaveLength(4);
  }
});
