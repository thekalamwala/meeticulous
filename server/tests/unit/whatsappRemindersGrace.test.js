/**
 * tests/unit/whatsappRemindersGrace.test.js
 *
 * WhatsApp booking reminders + reschedule alerts are Pro perks. Free (Starter)
 * hosts get them for a 60-day "Pro taste" counted from their FIRST confirmed
 * booking (services/proTaste.js). Paid plans always keep them.
 */
const mockBookings = { rows: [] };
const mockProfile = { row: null };
jest.mock('../../config/supabase', () => {
  const chain = (table) => {
    const q = {
      select: () => q, eq: () => q, in: () => q, order: () => q,
      limit: async () => ({ data: table === 'bookings' ? mockBookings.rows : [] }),
      maybeSingle: async () => ({ data: mockProfile.row }),
    };
    return q;
  };
  return { supabaseAdmin: { from: jest.fn((t) => chain(t)) } };
});
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn() }));
jest.mock('../../utils/inAppNotify', () => ({ inAppNotify: jest.fn() }));

const proTaste = require('../../services/proTaste');
const { whatsappRemindersAllowed, rescheduleAlertsAllowed } = require('../../controllers/bookingController');

const NOW = Date.parse('2027-03-01T00:00:00+05:30');
let nowSpy;
beforeEach(() => {
  nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  proTaste.clearCache();
  mockBookings.rows = [];
  mockProfile.row = null;
});
afterEach(() => nowSpy.mockRestore());

describe('proTaste pure helpers', () => {
  test('taste ends 60 days after the first booking', () => {
    expect(proTaste.tasteEndsAt('2027-01-01T00:00:00Z').toISOString()).toBe('2027-03-02T00:00:00.000Z');
    expect(proTaste.tasteEndsAt(null)).toBeNull();
  });
  test('daysLeft counts down and floors at 0', () => {
    expect(proTaste.daysLeft(new Date(NOW - 55 * 86400000).toISOString(), NOW)).toBe(5);
    expect(proTaste.daysLeft(new Date(NOW - 90 * 86400000).toISOString(), NOW)).toBe(0);
    expect(proTaste.daysLeft(null, NOW)).toBeNull();
  });
});

describe('whatsappRemindersAllowed (60-day Pro taste from first booking)', () => {
  test('paid plan → always WhatsApp', async () => {
    mockBookings.rows = [{ created_at: '2020-01-01' }];
    expect(await whatsappRemindersAllowed({ plan: 'premium' }, 'h1')).toBe(true);
    expect(await whatsappRemindersAllowed({ plan: 'creator' }, 'h1')).toBe(true);
  });

  test('free host with no booking yet → taste not started → WhatsApp', async () => {
    expect(await whatsappRemindersAllowed({ plan: 'free' }, 'h1')).toBe(true);
  });

  test('free host inside 60 days of first booking → WhatsApp', async () => {
    mockBookings.rows = [{ created_at: '2027-02-15T00:00:00+05:30' }];
    expect(await whatsappRemindersAllowed({ plan: 'free' }, 'h1')).toBe(true);
  });

  test('free host past 60 days of first booking → email fallback', async () => {
    mockBookings.rows = [{ created_at: '2026-11-01T00:00:00+05:30' }];
    expect(await whatsappRemindersAllowed({ plan: 'free' }, 'h1')).toBe(false);
  });

  test('host row without plan column → plan is loaded, Pro keeps WhatsApp', async () => {
    mockBookings.rows = [{ created_at: '2026-11-01T00:00:00+05:30' }];
    mockProfile.row = { plan: 'premium', plan_expires_at: null };
    expect(await whatsappRemindersAllowed({ name: 'x' }, 'h1')).toBe(true);
  });
});

describe('rescheduleAlertsAllowed', () => {
  test('free host past taste → no alerts; inside taste → alerts', async () => {
    mockBookings.rows = [{ created_at: '2026-11-01T00:00:00+05:30' }];
    expect(await rescheduleAlertsAllowed({ plan: 'free' }, 'h1')).toBe(false);
    proTaste.clearCache();
    mockBookings.rows = [{ created_at: '2027-02-20T00:00:00+05:30' }];
    expect(await rescheduleAlertsAllowed({ plan: 'free' }, 'h1')).toBe(true);
  });
});
