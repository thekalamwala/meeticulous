/**
 * tests/unit/bookingCommissionBand.test.js — pricing v2 §2, acceptance test 9.
 *
 * Wires createBooking end to end with the REAL pricingEngine: a Pro host's
 * month-to-date appointment GMV is read inside the booking lock and decides the
 * rate for the WHOLE booking (0% below ₹25,000 MTD-before, 3% at or above it),
 * and the applied rate is snapshotted on the row. The band arithmetic itself is
 * covered in planService.test.js; this pins the controller wiring. The 0/3 here
 * come from the mocked rate function, not from any live plan row.
 */
jest.mock('../../config/google', () => ({ createCalendarEvent: jest.fn().mockResolvedValue({ meetLink: 'm' }) }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (v) => v }));
jest.mock('../../services/availabilityService', () => ({ validateSlot: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../middleware/planMiddleware', () => ({ checkBookingReceiveLimit: jest.fn().mockResolvedValue({ allowed: true }) }));
const mockBandPlan = { commission_rates: { appointments: 0, appointment_band_inr: 25000, appointment_rate_above_band: 3 } };
jest.mock('../../services/planService', () => ({
  resolveVendorPlan: (h) => h.plan,
  getPlan: jest.fn(async (slug) => (slug === 'premium' ? mockBandPlan : { commission_percentage: 9 })),
  getRate: jest.fn(async (slug) => (slug === 'premium' ? 0 : 9)),
  appointmentRateFor: jest.fn(async (_slug, mtd) => (mtd >= 25000 ? 3 : 0)),
}));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn().mockResolvedValue({ platformFee: 10, gstRate: 0.18 }) }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue() }));
jest.mock('../../utils/sendEmail', () => jest.fn().mockResolvedValue());
jest.mock('../../services/paidMode', () => ({ feeOnlyForHost: jest.fn().mockResolvedValue(false) }));
// paid_booking_without_pan ON so no KYC gate; tds_tcs_v2 OFF (legacy withholding — not under test).
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn(async (k) => k === 'paid_booking_without_pan') }));

const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

const { createBooking } = require('../../controllers/bookingController');
const guestGrant = require('../../utils/bookingGrant');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };

let captured;
let mtdRead;
const wire = ({ plan, mtdRows, mtdError = null }) => {
  captured = null;
  mtdRead = false;
  const host = { id: 'h1', email: 'h@x.com', plan };
  const service = { id: 's1', title: 'Deep work', duration: 30, price: 2000, meeting_mode: 'online' };
  const guest = { id: 'u1', name: 'G', email: 'g@x.com', phone: '9990001111' };
  mockFrom.mockImplementation((table) => {
    let lastId;
    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn((_c, v) => { lastId = v; return chain; }),
      neq: jest.fn(() => chain), not: jest.fn(() => chain), order: jest.fn(() => chain),
      // The MTD read ends on .gte(created_at, monthStart).
      gte: jest.fn(() => {
        if (table === 'bookings') mtdRead = true;
        return Object.assign(Promise.resolve(table === 'bookings' ? { data: mtdRows, error: mtdError } : { data: [], error: null }), chain);
      }),
      insert: jest.fn((row) => { if (table === 'bookings') captured = row; return chain; }),
      limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
      single: jest.fn(() => Promise.resolve(
        table === 'services' ? { data: { host_id: host.id, ...service } } :
        table === 'profiles' ? { data: (lastId === host.id ? host : guest) } :
        { data: { id: 'bkg-1', ...service }, error: null })),
      maybeSingle: jest.fn(() => Promise.resolve({ data: { timezone: 'Asia/Kolkata' } })),
    };
    return chain;
  });
};

const reqFor = () => ({ body: {
  service_id: 's1', host_id: 'h1', guest_name: 'G', guest_email: 'g@x.com',
  scheduled_at: '2099-01-01T05:00:00.000Z', booking_grant: guestGrant.issue({ email: 'g@x.com' }),
} });

// MTD rows as stored: customer_total includes the ₹10 fee (8.47 + 1.53), which the read strips.
const mtd = (servicePrice) => [{ customer_total: servicePrice + 10, platform_fee_amount: 8.47, platform_fee_gst: 1.53 }];

beforeEach(() => jest.clearAllMocks());

test('Pro, ₹24,000 MTD-before, ₹2,000 booking → whole booking at 0% (never split across the band)', async () => {
  wire({ plan: 'premium', mtdRows: mtd(24000) });
  await createBooking(reqFor(), res());
  expect(mtdRead).toBe(true);
  expect(captured.commission_percentage).toBe(0);
  expect(captured.commission_applied).toBe(0);
});

test('Pro, ₹26,000 MTD-before → 3% on the whole booking, snapshotted with its GST backed out', async () => {
  wire({ plan: 'premium', mtdRows: mtd(26000) });
  await createBooking(reqFor(), res());
  expect(captured.commission_percentage).toBe(3);
  expect(captured.commission_applied).toBe(60);
  expect(captured.commission_gst).toBe(9.15);       // 60 − 60/1.18
  expect(captured.commission_taxable).toBe(50.85);
  expect(captured.customer_total).toBe(2010);        // commission never touches what the guest pays
});

test('a failed MTD read keeps the base rate — never the higher one', async () => {
  wire({ plan: 'premium', mtdRows: null, mtdError: { message: 'boom' } });
  await createBooking(reqFor(), res());
  expect(captured.commission_percentage).toBe(0);
});

test('a plan with no band (Starter) never reads MTD and books at its appointments rate', async () => {
  wire({ plan: 'free', mtdRows: mtd(999999) });
  await createBooking(reqFor(), res());
  expect(mtdRead).toBe(false);
  expect(captured.commission_percentage).toBe(9);
  expect(captured.commission_applied).toBe(180);
});
