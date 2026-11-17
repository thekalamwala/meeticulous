/**
 * tests/unit/bookingWithholding.test.js
 *
 * End-to-end wiring of the tds_tcs_v2 withholding into createBooking: proves the
 * controller plumbs host entity/PAN + the flag into the REAL pricingEngine and
 * snapshots the right tds_amount / tcs_amount onto the booking row. Unlike the
 * other createBooking tests, pricingEngine is NOT mocked here — a wrong field
 * name or dropped await at the call site would mis-withhold a real payout, and
 * the resolveWithholding unit tests alone would not catch it.
 */
jest.mock('../../config/google', () => ({ createCalendarEvent: jest.fn().mockResolvedValue({ meetLink: 'm' }) }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (v) => v }));
jest.mock('../../services/availabilityService', () => ({ validateSlot: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../middleware/planMiddleware', () => ({ checkBookingReceiveLimit: jest.fn().mockResolvedValue({ allowed: true }) }));
jest.mock('../../services/planService', () => ({ resolveVendorPlan: () => 'pro', getPlan: jest.fn().mockResolvedValue({ commission_percentage: 0 }) }));
// Full tax config, as platformConfig would return it (flag-ON rates).
jest.mock('../../services/platformConfig', () => ({
  getConfig: jest.fn().mockResolvedValue({
    platformFee: 10, gstRate: 0.18,
    tdsRate: 0.001, tdsRateNoPan: 0.05, tcsRate: 0.005, tdsThresholdIndividual: 500000,
  }),
}));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue() }));
jest.mock('../../utils/sendEmail', () => jest.fn().mockResolvedValue());
jest.mock('../../services/paidMode', () => ({ feeOnlyForHost: jest.fn().mockResolvedValue(false) }));
// pricingEngine is REAL (the whole point of this test).
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));

const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

const { createBooking } = require('../../controllers/bookingController');
const guestGrant = require('../../utils/bookingGrant');
const featureFlags = require('../../services/featureFlags');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };

// Capture the row inserted into `bookings`; return distinct profiles per id.
let captured;
const wire = ({ host, panOnFile }) => {
  captured = null;
  const service = { id: 's1', title: 'SEO', duration: 30, price: 500, meeting_mode: 'online' };
  const guest = { id: 'u1', name: 'G', email: 'g@x.com', phone: '9990001111' };
  mockFrom.mockImplementation((table) => {
    let lastId;
    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn((_c, v) => { lastId = v; return chain; }),
      neq: jest.fn(() => chain), not: jest.fn(() => chain), order: jest.fn(() => chain),
      insert: jest.fn((row) => { if (table === 'bookings') captured = row; return chain; }),
      limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
      single: jest.fn(() => Promise.resolve(
        table === 'services' ? { data: { host_id: host.id, ...service } } :
        table === 'profiles' ? { data: (lastId === host.id ? host : guest) } :
        { data: { id: 'bkg-1', ...service }, error: null })),
      maybeSingle: jest.fn(() => Promise.resolve(
        table === 'kyc_submissions' ? { data: panOnFile ? { user_id: host.id } : null } :
        { data: { timezone: 'Asia/Kolkata' } })),
    };
    return chain;
  });
};

const reqFor = () => ({ body: {
  service_id: 's1', host_id: 'h1', guest_name: 'G', guest_email: 'g@x.com',
  scheduled_at: '2099-01-01T05:00:00.000Z', booking_grant: guestGrant.issue({ email: 'g@x.com' }),
} });

const host = (extra) => ({ id: 'h1', email: 'h@x.com', ...extra });

beforeEach(() => jest.clearAllMocks());

test('flag OFF → legacy 1% TDS + 1% TCS snapshotted (₹500 → ₹5 / ₹5)', async () => {
  featureFlags.isFeatureEnabled.mockImplementation((k) => Promise.resolve(k !== 'paid_booking_without_pan' && k !== 'tds_tcs_v2'));
  wire({ host: host({ host_entity_type: 'individual_huf' }), panOnFile: true });
  await createBooking(reqFor(), res());
  expect(captured).toBeTruthy();
  expect(captured.tds_amount).toBe(5);
  expect(captured.tcs_amount).toBe(5);
});

test('flag ON, GST-registered individual + PAN, FY gross unknown → 0.1% TDS / 0.5% TCS (₹0.5 / ₹2.5)', async () => {
  featureFlags.isFeatureEnabled.mockImplementation((k) => Promise.resolve(k !== 'paid_booking_without_pan'));
  wire({ host: host({ host_entity_type: 'individual_huf', billing_details: { gstin: '27ABCDE1234F1Z5' } }), panOnFile: true });
  await createBooking(reqFor(), res());
  expect(captured.tds_amount).toBe(0.5);
  expect(captured.tcs_amount).toBe(2.5);
});

test('flag ON, UNREGISTERED host (no GSTIN) → 0.1% TDS but TCS 0 (₹0.5 / ₹0)', async () => {
  featureFlags.isFeatureEnabled.mockImplementation((k) => Promise.resolve(k !== 'paid_booking_without_pan'));
  wire({ host: host({ host_entity_type: 'individual_huf' }), panOnFile: true }); // no billing_details.gstin
  await createBooking(reqFor(), res());
  expect(captured.tds_amount).toBe(0.5);
  expect(captured.tcs_amount).toBe(0);
});

test('flag ON, host has NO PAN (booking allowed), GST-registered → 5% TDS / 0.5% TCS (₹25 / ₹2.5)', async () => {
  // Every flag ON, including paid_booking_without_pan so the no-PAN booking proceeds.
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  wire({ host: host({ host_entity_type: 'individual_huf', billing_details: { gstin: '27ABCDE1234F1Z5' } }), panOnFile: false });
  await createBooking(reqFor(), res());
  expect(captured.tds_amount).toBe(25);
  expect(captured.tcs_amount).toBe(2.5);
});
