/**
 * tests/unit/expireStalePending.test.js
 *
 * The stale-hold reaper cancels abandoned unpaid 'pending' bookings so their slot
 * releases. F11: it must stamp settlement_status='cancelled' (like the shared
 * cancelBookingRecord), not leave a reaped hold at 'pending_completion' — an
 * impossible "cancelled but awaiting completion" state.
 */
jest.mock('../../config/google', () => ({ createCalendarEvent: jest.fn(), updateCalendarEvent: jest.fn(), deleteCalendarEvent: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (v) => v }));
jest.mock('../../services/availabilityService', () => ({ validateSlot: jest.fn(), computeSlots: jest.fn() }));
jest.mock('../../middleware/planMiddleware', () => ({ checkBookingReceiveLimit: jest.fn() }));
jest.mock('../../services/planService', () => ({ resolveVendorPlan: () => 'explorer', getPlan: jest.fn() }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../utils/sendEmail', () => jest.fn());
jest.mock('../../lib/pricingEngine', () => ({ computeBreakdown: jest.fn() }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue() }));

const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

const { expireStalePendingBookings } = require('../../controllers/bookingController');

let updatePatch;
const wire = ({ ids = ['b1', 'b2'], error = null } = {}) => {
  updatePatch = undefined;
  mockFrom.mockImplementation(() => {
    const chain = {
      update: (patch) => { updatePatch = patch; return chain; },
      eq: () => chain, lt: () => chain, select: () => chain,
      limit: () => Promise.resolve({ data: ids.map((id) => ({ id })), error }),
    };
    return chain;
  });
};

beforeEach(() => jest.clearAllMocks());

test('reaped holds are stamped status AND settlement_status = cancelled (F11)', async () => {
  wire({ ids: ['b1', 'b2'] });
  const result = await expireStalePendingBookings();
  expect(result.expired).toBe(2);
  expect(updatePatch).toMatchObject({ status: 'cancelled', settlement_status: 'cancelled' });
});

test('a DB error returns zero without throwing', async () => {
  wire({ ids: [], error: { message: 'boom' } });
  const result = await expireStalePendingBookings();
  expect(result.expired).toBe(0);
});
