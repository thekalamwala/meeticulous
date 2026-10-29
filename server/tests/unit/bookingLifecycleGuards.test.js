/**
 * tests/unit/bookingLifecycleGuards.test.js
 *
 * Status-transition guards added in the pre-launch audit:
 *   P0-2  completeBooking — only a 'confirmed' booking may be completed.
 *   P1-5  cancelBooking   — idempotent on 'cancelled'; 'completed'/'no_show' can't be cancelled.
 *   P1-6  markNoShow      — host-only, confirmed-only, time-gated.
 */
jest.mock('../../config/google', () => ({
  createCalendarEvent: jest.fn(), updateCalendarEvent: jest.fn(), deleteCalendarEvent: jest.fn(),
}));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn().mockResolvedValue(true) }));
jest.mock('../../utils/sendEmail', () => jest.fn());
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue() }));
jest.mock('../../middleware/planMiddleware', () => ({ checkBookingReceiveLimit: jest.fn() }));
jest.mock('../../lib/pricingEngine', () => ({ computeBreakdown: jest.fn() }));
jest.mock('../../services/planService', () => ({ resolveVendorPlan: () => 'explorer', getPlan: jest.fn() }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../services/availabilityService', () => ({ validateSlot: jest.fn(), computeSlots: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (v) => v }));
jest.mock('../../utils/posthog', () => ({ capture: jest.fn(), resolveGuestId: jest.fn() }));
jest.mock('../../utils/background', () => ({ runInBackground: jest.fn() }));
jest.mock('../../utils/profileSecrets', () => ({ attachGoogleTokens: jest.fn().mockResolvedValue({}) }));
jest.mock('../../utils/bookingGrant', () => ({ verify: jest.fn(), normalizePhone: jest.fn() }));
jest.mock('../../utils/inAppNotify', () => ({ inAppNotify: jest.fn() }));
jest.mock('../../services/badgeEngine', () => ({ evaluate: jest.fn().mockResolvedValue({}) }));

const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

const { completeBooking, markNoShow, cancelBooking } = require('../../controllers/bookingController');

const HOST = { name: 'Host', email: 'h@x.com', phone: '1', username: 'host', location: '' };
const baseBooking = (over) => ({
  id: 'b1', host_id: 'h1', guest_id: 'g1', guest_name: 'G', guest_email: 'g@x.com', guest_phone: '9',
  payment_status: 'paid', status: 'confirmed',
  scheduled_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3h ago (past)
  services: { title: 'SEO', duration: 30, grace_period_minutes: 0 },
  profiles: HOST, ...over,
});

// Every from() returns the same chainable stub: .single()/.maybeSingle() resolve
// the configured booking / a tz row; the booking is returned again as the update
// result (positive paths just pass it through).
const wire = (booking) => {
  mockFrom.mockImplementation(() => {
    const chain = {
      select: () => chain, eq: () => chain, neq: () => chain, order: () => chain, limit: () => chain, update: () => chain,
      single: () => Promise.resolve({ data: booking, error: null }),
      maybeSingle: () => Promise.resolve({ data: { timezone: 'Asia/Kolkata' }, error: null }),
      then: (r) => r({ data: [], error: null }),
    };
    return chain;
  });
};

const mkRes = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  r.send = jest.fn(() => r);
  return r;
};

beforeEach(() => jest.clearAllMocks());

describe('completeBooking (P0-2)', () => {
  test('409 on a cancelled booking', async () => {
    wire(baseBooking({ status: 'cancelled' }));
    const res = mkRes();
    await completeBooking({ params: { id: 'b1' }, user: { id: 'h1' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('409 on a pending (unpaid) booking', async () => {
    wire(baseBooking({ status: 'pending', payment_status: 'unpaid' }));
    const res = mkRes();
    await completeBooking({ params: { id: 'b1' }, user: { id: 'h1' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('403 when caller is not the host', async () => {
    wire(baseBooking());
    const res = mkRes();
    await completeBooking({ params: { id: 'b1' }, user: { id: 'someone-else' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('markNoShow (P1-6)', () => {
  test('403 when caller is not the host', async () => {
    wire(baseBooking());
    const res = mkRes();
    await markNoShow({ params: { id: 'b1' }, user: { id: 'g1' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('409 on a non-confirmed booking', async () => {
    wire(baseBooking({ status: 'completed' }));
    const res = mkRes();
    await markNoShow({ params: { id: 'b1' }, user: { id: 'h1' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('409 before the session window has elapsed (future booking)', async () => {
    wire(baseBooking({ scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }));
    const res = mkRes();
    await markNoShow({ params: { id: 'b1' }, user: { id: 'h1' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('marks no_show for a confirmed, past booking', async () => {
    wire(baseBooking());
    const res = mkRes();
    await markNoShow({ params: { id: 'b1' }, user: { id: 'h1' } }, res);
    expect(res.json).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(409);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });
});

describe('cancelBooking (P1-5)', () => {
  test('idempotent no-op on an already-cancelled booking (no 409)', async () => {
    const b = baseBooking({ status: 'cancelled' });
    wire(b);
    const res = mkRes();
    await cancelBooking({ params: { id: 'b1' }, user: { id: 'h1' } }, res);
    expect(res.json).toHaveBeenCalledWith(b);
    expect(res.status).not.toHaveBeenCalledWith(409);
  });

  test('409 on a completed booking', async () => {
    wire(baseBooking({ status: 'completed' }));
    const res = mkRes();
    await cancelBooking({ params: { id: 'b1' }, user: { id: 'h1' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('403 when caller is neither host nor guest', async () => {
    wire(baseBooking());
    const res = mkRes();
    await cancelBooking({ params: { id: 'b1' }, user: { id: 'stranger' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
