/**
 * tests/unit/whatsappRemindersGrace.test.js
 *
 * WhatsApp booking reminders are a paid perk. Free (Starter) hosts get them for a
 * grace window (their first 2 months, anchored no earlier than the scaling launch
 * so existing free hosts aren't cut off), then reminders fall back to email. Paid
 * plans always keep WhatsApp.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn() }));
jest.mock('../../utils/inAppNotify', () => ({ inAppNotify: jest.fn() }));

const { whatsappRemindersAllowed } = require('../../controllers/bookingController');

// Fixed "now" AFTER the launch grace window (launch anchor 2026-10-01 + 60d = 2026-11-30).
// Re-applied per test — the jest config restores mocks between tests, so a beforeAll
// spy would be wiped before the later cases run.
const NOW = Date.parse('2027-03-01T00:00:00+05:30');
let nowSpy;
beforeEach(() => { nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(() => nowSpy.mockRestore());

describe('whatsappRemindersAllowed (free 2-month WhatsApp grace)', () => {
  test('paid plan → always WhatsApp, regardless of signup age', () => {
    expect(whatsappRemindersAllowed({ plan: 'premium', created_at: '2020-01-01' })).toBe(true);
    expect(whatsappRemindersAllowed({ plan: 'creator', created_at: '2020-01-01' })).toBe(true);
  });

  test('free host past the grace window → email fallback (false)', () => {
    // Created before launch → anchored to 2026-10-01; window ended 2026-11-30, now is later.
    expect(whatsappRemindersAllowed({ plan: 'free', created_at: '2026-01-01' })).toBe(false);
  });

  test('free host inside their 2-month window → WhatsApp (true)', () => {
    // Signed up 2027-02-15, within 60 days of the fixed "now" (2027-03-01).
    expect(whatsappRemindersAllowed({ plan: 'free', created_at: '2027-02-15' })).toBe(true);
  });

  test('unknown signup date → do not downgrade (true)', () => {
    expect(whatsappRemindersAllowed({ plan: 'free' })).toBe(true);
  });
});
