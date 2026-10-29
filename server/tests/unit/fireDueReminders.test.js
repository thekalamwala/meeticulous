/**
 * bookingController.fireDueReminders — last-minute catch-up reminder.
 *
 * The 5-min reminder cron only matches a ±10-min band around each lead-time, so
 * a booking created INSIDE that band's past edge (e.g. booked 40 min before a
 * session) never trips the 1h reminder. fireDueReminders runs at confirmation /
 * reschedule and fires a single nudge for any plan-entitled window whose lead-
 * time has already elapsed, marking every elapsed window so the cron never
 * double-sends.
 */

jest.mock('../../config/google', () => ({
  createCalendarEvent: jest.fn(), updateCalendarEvent: jest.fn(), deleteCalendarEvent: jest.fn(),
}));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn().mockResolvedValue(true) }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue() }));
jest.mock('../../utils/sendEmail', () => jest.fn().mockResolvedValue());
jest.mock('../../middleware/planMiddleware', () => ({
  checkBookingReceiveLimit: jest.fn().mockResolvedValue({ allowed: true }),
}));
jest.mock('../../services/planService', () => ({
  resolveVendorPlan: jest.fn(() => 'professional'),
  isFreeSlug: jest.fn(() => false), // paid → sendBookingReminder keeps WhatsApp on
  reminderWindowsForPlan: jest.fn().mockResolvedValue([24, 1]),
  rescheduleNotifyForPlan: jest.fn().mockResolvedValue(true),
  getPlan: jest.fn(),
}));

let lastBookingUpdate;
const mockFrom = jest.fn(() => {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    update: jest.fn((vals) => { lastBookingUpdate = vals; return chain; }),
    maybeSingle: jest.fn().mockResolvedValue({ data: { timezone: 'Asia/Kolkata' }, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve) => resolve({ data: null, error: null }),
  };
  return chain;
});
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

const NotificationEngine = require('../../services/notificationEngine');
const planService = require('../../services/planService');
const { fireDueReminders } = require('../../controllers/bookingController');

const HOST = { name: 'Host', email: 'h@x.com', phone: '8', username: 'host' };
const minutesFromNow = (m) => new Date(Date.now() + m * 60000).toISOString();
const booking = (over = {}) => ({
  id: 'b1', host_id: 'h1', status: 'confirmed',
  guest_name: 'Guest', guest_email: 'g@x.com', guest_phone: '9', guest_id: 'g1',
  services: { title: 'Call', meeting_mode: 'online' }, meeting_link: '',
  reminder_24h_sent: false, reminder_1h_sent: false, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  lastBookingUpdate = undefined;
  planService.reminderWindowsForPlan.mockResolvedValue([24, 1]);
});

test('last-minute booking → ONE nudge, both elapsed windows marked sent', async () => {
  await fireDueReminders(booking({ scheduled_at: minutesFromNow(40) }), HOST);
  expect(NotificationEngine.send).toHaveBeenCalledTimes(2); // guest + host, single nudge
  expect(lastBookingUpdate).toEqual(
    expect.objectContaining({ reminder_24h_sent: true, reminder_1h_sent: true }),
  );
});

test('non-imminent booking inside the 24h window → NO instant reminder (1h cron owns it), 24h suppressed', async () => {
  // [24,1] plan, session 16h out: booked inside the 24h window but not imminent.
  // A "reminder" seconds after the confirmation is noise — the 1h cron reminds
  // later. So: no send, but the elapsed 24h flag is marked sent (1h left false).
  await fireDueReminders(booking({ scheduled_at: minutesFromNow(16 * 60) }), HOST);
  expect(NotificationEngine.send).not.toHaveBeenCalled();
  expect(lastBookingUpdate).toEqual(expect.objectContaining({ reminder_24h_sent: true }));
  expect(lastBookingUpdate.reminder_1h_sent).toBeUndefined();
});

test('future booking → no catch-up (cron owns it)', async () => {
  await fireDueReminders(booking({ scheduled_at: minutesFromNow(48 * 60) }), HOST);
  expect(NotificationEngine.send).not.toHaveBeenCalled();
  expect(lastBookingUpdate).toBeUndefined();
});

test('starter (no entitled windows) → nothing sent', async () => {
  planService.reminderWindowsForPlan.mockResolvedValue([]);
  await fireDueReminders(booking({ scheduled_at: minutesFromNow(40) }), HOST);
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('creator (24h only) same-day booking → fires 24h, never touches 1h flag', async () => {
  planService.reminderWindowsForPlan.mockResolvedValue([24]);
  await fireDueReminders(booking({ scheduled_at: minutesFromNow(5 * 60) }), HOST);
  expect(NotificationEngine.send).toHaveBeenCalledTimes(2);
  expect(lastBookingUpdate).toEqual(expect.objectContaining({ reminder_24h_sent: true }));
  expect(lastBookingUpdate.reminder_1h_sent).toBeUndefined();
});

test('already-started booking → nothing', async () => {
  await fireDueReminders(booking({ scheduled_at: minutesFromNow(-5) }), HOST);
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('non-confirmed booking → nothing', async () => {
  await fireDueReminders(booking({ status: 'pending', scheduled_at: minutesFromNow(40) }), HOST);
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('reminders feature flag off → nothing', async () => {
  const featureFlags = require('../../services/featureFlags');
  featureFlags.isFeatureEnabled.mockResolvedValueOnce(false);
  await fireDueReminders(booking({ scheduled_at: minutesFromNow(40) }), HOST);
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});
