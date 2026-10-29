/**
 * tests/unit/autoCompleteBookings.test.js
 *
 * The auto-completion cron closes the booking lifecycle so revenue becomes
 * settle-able without anyone clicking "Mark Completed". Verifies the time-window
 * logic: only confirmed sessions that have elapsed past (duration + grace + HOLD)
 * AND ended on/after the backfill cutoff are completed.
 */
jest.mock('../../config/google', () => ({ createCalendarEvent: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (v) => v }));
jest.mock('../../services/availabilityService', () => ({ validateSlot: jest.fn(), computeSlots: jest.fn() }));
jest.mock('../../middleware/planMiddleware', () => ({ checkBookingReceiveLimit: jest.fn() }));
jest.mock('../../services/planService', () => ({ resolveVendorPlan: () => 'explorer', getPlan: jest.fn() }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../utils/sendEmail', () => jest.fn());
jest.mock('../../lib/pricingEngine', () => ({ computeBreakdown: jest.fn() }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue() }));
jest.mock('../../services/badgeEngine', () => ({ evaluate: jest.fn().mockResolvedValue({}) }));

const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

const NotificationEngine = require('../../services/notificationEngine');
const badgeEngine = require('../../services/badgeEngine');
const { autoCompleteBookings } = require('../../controllers/bookingController');

const HOST = { name: 'Host', email: 'h@x.com', phone: '1', username: 'host', location: '' };
const baseRow = (over) => ({
  id: 'b', host_id: 'h1', guest_id: 'g1', guest_name: 'G', guest_email: 'g@x.com', guest_phone: '9',
  payment_status: 'paid', services: { title: 'SEO', duration: 30, grace_period_minutes: 0 },
  'profiles!bookings_host_id_fkey': HOST, ...over,
});

// Supabase mock: the list query is awaited directly (thenable → listResult);
// each markBookingCompleted update ends in .single() (→ updateResult).
let gteCalls = [];
const wire = (rows) => {
  gteCalls = [];
  mockFrom.mockImplementation(() => {
    const chain = {
      select: () => chain, eq: () => chain, neq: () => chain, lte: () => chain,
      gte: (_col, val) => { gteCalls.push(val); return chain; },
      order: () => chain, limit: () => chain, update: () => chain,
      single: () => Promise.resolve({ data: { id: 'b', status: 'completed' }, error: null }),
      then: (resolve) => resolve({ data: rows, error: null }),
    };
    return chain;
  });
};

beforeEach(() => jest.clearAllMocks());

test('completes only elapsed-past-hold bookings within the backfill cutoff', async () => {
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  const H = 60 * 60 * 1000, D = 24 * H;

  wire([
    baseRow({ id: 'done',   scheduled_at: iso(5 * H) }),   // ended ~4.5h ago > 2h hold, within cutoff → COMPLETE
    baseRow({ id: 'fresh',  scheduled_at: iso(30 * 60 * 1000) }), // ended ~now, inside 2h hold → skip
    baseRow({ id: 'stale',  scheduled_at: iso(10 * D) }),  // ended >3d-ago cutoff → skip (backlog)
  ]);

  const result = await autoCompleteBookings();

  expect(result.completed).toBe(1);
  // 2 notifications (customer + vendor) per completed booking.
  expect(NotificationEngine.send).toHaveBeenCalledTimes(2);
  expect(badgeEngine.evaluate).toHaveBeenCalledTimes(1);
});

test('no eligible bookings → no completions, no notifications', async () => {
  const now = Date.now();
  wire([
    baseRow({ id: 'fresh', scheduled_at: new Date(now - 10 * 60 * 1000).toISOString() }), // 10min ago, inside hold
  ]);

  const result = await autoCompleteBookings();

  expect(result.completed).toBe(0);
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('query error returns zero without throwing', async () => {
  mockFrom.mockImplementation(() => {
    const chain = {
      select: () => chain, eq: () => chain, gte: () => chain, lte: () => chain, order: () => chain, limit: () => chain,
      then: (resolve) => resolve({ data: null, error: { message: 'boom' } }),
    };
    return chain;
  });

  const result = await autoCompleteBookings();
  expect(result.completed).toBe(0);
});

// F20: the batch is bounded below by (cutoff − 1 day) so a pile of pre-cutoff
// confirmed rows can't fill the ascending, fixed-size batch and starve completion.
test('bounds the query to a scheduled_at floor (no pre-cutoff starvation)', async () => {
  wire([]);
  await autoCompleteBookings();
  expect(gteCalls.length).toBeGreaterThan(0);
  const floor = new Date(gteCalls[0]).getTime();
  // Default cutoff is 3 days before boot; the floor is one day earlier still, and
  // comfortably in the past relative to "now".
  expect(floor).toBeLessThan(Date.now() - 3 * 24 * 60 * 60 * 1000);
});

test('session-complete email resolves the host name from the bare `profiles` embed key', async () => {
  // Regression for the "session with Host" bug: supabase-js returns the
  // un-aliased `profiles!bookings_host_id_fkey(...)` embed under the table-name
  // key `profiles`. Reading the raw select string yields undefined, so the email
  // rendered the literal "Host". hostOf() must fall back to `.profiles`.
  const now = Date.now();
  const H = 60 * 60 * 1000;
  const realHost = { name: 'Shubham Datarkar', email: 'h@x.com', phone: '1', username: 'shubham', location: '' };
  const row = baseRow({ id: 'done', scheduled_at: new Date(now - 5 * H).toISOString() });
  delete row['profiles!bookings_host_id_fkey']; // real PostgREST shape: keyed by table name
  row.profiles = realHost;
  wire([row]);

  await autoCompleteBookings();

  const customerCall = NotificationEngine.send.mock.calls
    .map((c) => c[0])
    .find((arg) => arg.event === 'BOOKING_COMPLETED_CUSTOMER');
  expect(customerCall).toBeTruthy();
  // Host name renders, not the literal "Host" — in the email body via {{vendor_name}}.
  expect(customerCall.data.emailData.vendor_name).toBe('Shubham Datarkar');
  // …and the guest name still interpolates from its own column.
  expect(customerCall.data.name).toBe('G');
  // Review CTA ({{profile_url}}) targets the host profile instead of the dashboard fallback.
  expect(customerCall.data.emailData.profile_url).toContain('/shubham');
});
