/**
 * Verifies the payment-bug fix: createBooking must NOT create a Google Calendar
 * event for PAID services (deferred to verifyPayment). Free services still do.
 */
jest.mock('../../config/google', () => ({
  createCalendarEvent: jest.fn().mockResolvedValue({ meetLink: 'https://meet.google.com/x' }),
}));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (v) => v }));
jest.mock('../../services/availabilityService', () => ({
  validateSlot: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock('../../middleware/planMiddleware', () => ({
  checkBookingReceiveLimit: jest.fn().mockResolvedValue({ allowed: true }),
}));
jest.mock('../../services/planService', () => ({
  resolveVendorPlan: () => 'explorer',
  getPlan: jest.fn().mockResolvedValue({ commission_percentage: 0 }),
}));
jest.mock('../../services/platformConfig', () => ({
  getConfig: jest.fn().mockResolvedValue({ platformFee: 10, gstRate: 0.18 }),
}));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue() }));
jest.mock('../../utils/sendEmail', () => jest.fn().mockResolvedValue());
jest.mock('../../lib/pricingEngine', () => ({
  // Input-sensitive so the calendar branch (keyed off customerTotal) is exercised:
  // a genuinely-free booking (price 0, no fee) totals 0; a paid one totals > 0.
  computeBreakdown: ({ servicePrice = 0, chargeFeeOnFree = false }) => {
    const fee = servicePrice === 0 && !chargeFeeOnFree ? 0 : 10;
    const gst = Math.round(fee * 0.18 * 100) / 100;
    return { platformFee: fee, commission: 0, vendorPayout: servicePrice, commissionGst: 0, commissionTaxable: 0, tds: 0, tcs: 0, gst, customerTotal: servicePrice + fee + gst };
  },
}));

const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

const { createCalendarEvent } = require('../../config/google');
const { createBooking } = require('../../controllers/bookingController');
const guestGrant = require('../../utils/bookingGrant');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };

// The `profiles` table is queried for BOTH the host (by host_id) and, for a
// logged-in booker, their own profile (by req.user.id). Return distinct rows per
// id — a coarse "profiles → host" mock would make every booker's email equal the
// host's and falsely trip the self-booking guard. `eq(col, val)` captures the id
// so single() can branch on it. A booker whose id ≠ host.id gets `guest`.
const wireSupabase = ({ service, host, avail, panOnFile = true, insertError = null, holds = [],
  guest = { id: 'u1', name: 'G', email: 'g@x.com', phone: '9990001111' } }) => {
  mockFrom.mockImplementation((table) => {
    let lastId;
    let sawInsert = false;
    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn((_col, val) => { lastId = val; return chain; }), neq: jest.fn(() => chain),
      not: jest.fn(() => chain), insert: jest.fn(() => { sawInsert = true; return chain; }),
      order: jest.fn(() => chain),
      // F8 own-hold lookup: from('bookings').select().eq×4.order().limit() → holds.
      limit: jest.fn(() => Promise.resolve({ data: holds, error: null })),
      single: jest.fn(() => Promise.resolve(
        // A real service always belongs to a host; derive host_id from the host so
        // createBooking's `host_id = service.host_id` resolves (fixtures omit it).
        table === 'services' ? { data: { host_id: host.id, ...service } } :
        table === 'profiles' ? { data: (lastId === host.id ? host : guest) } :
        // bookings INSERT: optionally return a DB error (e.g. exclusion constraint).
        (sawInsert && insertError ? { data: null, error: insertError } :
          { data: { id: 'bkg-1', ...service }, error: null }))),
      maybeSingle: jest.fn(() => Promise.resolve(
        table === 'kyc_submissions' ? { data: panOnFile ? { user_id: host?.id } : null } :
        { data: avail })),
    };
    return chain;
  });
};

beforeEach(() => jest.clearAllMocks());

test('paid online service does NOT create a calendar event at booking time', async () => {
  wireSupabase({
    service: { id: 's1', title: 'SEO', duration: 30, price: 500, meeting_mode: 'online' },
    host: { id: 'h1', email: 'h@x.com', google_calendar_connected: true, google_refresh_token: 'r', google_access_token: 'a' },
    avail: { timezone: 'Asia/Kolkata' },
  });
  const req = { body: { service_id: 's1', host_id: 'h1', guest_name: 'G', guest_email: 'g@x.com', scheduled_at: '2099-01-01T05:00:00.000Z', booking_grant: guestGrant.issue({ email: 'g@x.com' }) } };
  await createBooking(req, res());
  expect(createCalendarEvent).not.toHaveBeenCalled();
});

test('free online service STILL creates a calendar event at booking time', async () => {
  wireSupabase({
    service: { id: 's1', title: 'Intro', duration: 30, price: 0, meeting_mode: 'online' },
    host: { id: 'h1', email: 'h@x.com', google_calendar_connected: true, google_refresh_token: 'r', google_access_token: 'a' },
    avail: { timezone: 'Asia/Kolkata' },
  });
  const req = { body: { service_id: 's1', host_id: 'h1', guest_name: 'G', guest_email: 'g@x.com', scheduled_at: '2099-01-01T05:00:00.000Z', booking_grant: guestGrant.issue({ email: 'g@x.com' }) } };
  await createBooking(req, res());
  expect(createCalendarEvent).toHaveBeenCalledTimes(1);
});

// ── Security audit H-1: server-side OTP gate ──
test('anonymous booking WITHOUT a valid OTP grant is rejected 401', async () => {
  wireSupabase({
    service: { id: 's1', title: 'SEO', duration: 30, price: 500, meeting_mode: 'online' },
    host: { id: 'h1', email: 'h@x.com' },
    avail: { timezone: 'Asia/Kolkata' },
  });
  const r = res();
  // No req.user, no booking_grant — the OTP gate must block before any insert.
  const req = { body: { service_id: 's1', guest_name: 'G', guest_email: 'g@x.com', scheduled_at: '2099-01-01T05:00:00.000Z' } };
  await createBooking(req, r);
  expect(r.status).toHaveBeenCalledWith(401);
  expect(createCalendarEvent).not.toHaveBeenCalled();
});

test('anonymous booking with a grant for a DIFFERENT contact is rejected 401', async () => {
  wireSupabase({
    service: { id: 's1', title: 'SEO', duration: 30, price: 500, meeting_mode: 'online' },
    host: { id: 'h1', email: 'h@x.com' },
    avail: { timezone: 'Asia/Kolkata' },
  });
  const r = res();
  const req = { body: { service_id: 's1', guest_name: 'G', guest_email: 'victim@x.com', scheduled_at: '2099-01-01T05:00:00.000Z', booking_grant: guestGrant.issue({ email: 'attacker@x.com' }) } };
  await createBooking(req, r);
  expect(r.status).toHaveBeenCalledWith(401);
});

test('logged-in booking needs no OTP grant (reaches insert → 201)', async () => {
  wireSupabase({
    service: { id: 's1', title: 'SEO', duration: 30, price: 500, meeting_mode: 'online' },
    host: { id: 'h1', email: 'h@x.com' },
    avail: { timezone: 'Asia/Kolkata' },
  });
  const r = res();
  const req = { user: { id: 'u1' }, body: { service_id: 's1', guest_name: 'G', guest_email: 'g@x.com', scheduled_at: '2099-01-01T05:00:00.000Z' } };
  await createBooking(req, r);
  expect(r.status).toHaveBeenCalledWith(201);
});

// ── v4 TDS 194-O: PAN mandatory for PAID bookings ──
test('paid booking is rejected 409 when the host has no PAN on file', async () => {
  wireSupabase({
    service: { id: 's1', title: 'SEO', duration: 30, price: 500, meeting_mode: 'online' },
    host: { id: 'h1', email: 'h@x.com' },
    avail: { timezone: 'Asia/Kolkata' },
    panOnFile: false,
  });
  const r = res();
  const req = { user: { id: 'u1' }, body: { service_id: 's1', guest_name: 'G', guest_email: 'g@x.com', scheduled_at: '2099-01-01T05:00:00.000Z' } };
  await createBooking(req, r);
  expect(r.status).toHaveBeenCalledWith(409);
  expect(createCalendarEvent).not.toHaveBeenCalled();
});

test('free booking is allowed even when the host has no PAN (no TDS on ₹0)', async () => {
  wireSupabase({
    service: { id: 's1', title: 'Intro', duration: 30, price: 0, meeting_mode: 'online' },
    host: { id: 'h1', email: 'h@x.com', google_calendar_connected: true, google_refresh_token: 'r', google_access_token: 'a' },
    avail: { timezone: 'Asia/Kolkata' },
    panOnFile: false,
  });
  const r = res();
  const req = { user: { id: 'u1' }, body: { service_id: 's1', guest_name: 'G', guest_email: 'g@x.com', scheduled_at: '2099-01-01T05:00:00.000Z' } };
  await createBooking(req, r);
  expect(r.status).toHaveBeenCalledWith(201);
});

// ── A host cannot book their own service (circular money + double-listed row) ──
test('logged-in host booking their OWN service is rejected 400 (guest_id === host_id)', async () => {
  wireSupabase({
    service: { id: 's1', title: 'SEO', duration: 30, price: 500, meeting_mode: 'online' },
    host: { id: 'h1', email: 'h@x.com', phone: '7904109359' },
    avail: { timezone: 'Asia/Kolkata' },
  });
  const r = res();
  // The booker IS the host — same account id.
  const req = { user: { id: 'h1' }, body: { service_id: 's1', guest_name: 'G', scheduled_at: '2099-01-01T05:00:00.000Z' } };
  await createBooking(req, r);
  expect(r.status).toHaveBeenCalledWith(400);
  expect(createCalendarEvent).not.toHaveBeenCalled();
});

test('logged-OUT host self-booking via their own email is rejected 400 (contact match)', async () => {
  wireSupabase({
    service: { id: 's1', title: 'SEO', duration: 30, price: 500, meeting_mode: 'online' },
    host: { id: 'h1', email: 'h@x.com', phone: '7904109359' },
    avail: { timezone: 'Asia/Kolkata' },
  });
  const r = res();
  // Anonymous, but enters the host's own email (with a valid OTP grant for it).
  const req = { body: { service_id: 's1', guest_name: 'G', guest_email: 'h@x.com', scheduled_at: '2099-01-01T05:00:00.000Z', booking_grant: guestGrant.issue({ email: 'h@x.com' }) } };
  await createBooking(req, r);
  expect(r.status).toHaveBeenCalledWith(400);
});

test('a DIFFERENT host booking this service still works (no false positive) → 201', async () => {
  wireSupabase({
    service: { id: 's1', title: 'SEO', duration: 30, price: 500, meeting_mode: 'online' },
    host: { id: 'h1', email: 'h@x.com', phone: '7904109359' },
    avail: { timezone: 'Asia/Kolkata' },
    // Booker u2 is a real third party — different id, email and phone.
    guest: { id: 'u2', name: 'Other', email: 'other@x.com', phone: '8888888888' },
  });
  const r = res();
  const req = { user: { id: 'u2' }, body: { service_id: 's1', guest_name: 'Other', scheduled_at: '2099-01-01T05:00:00.000Z' } };
  await createBooking(req, r);
  expect(r.status).toHaveBeenCalledWith(201);
});

describe('F8 — own-hold resume (exclusion constraint is the guest\'s own pending hold)', () => {
  const conflict = { code: '23P01', message: 'conflicting key value violates exclusion constraint "bookings_no_overlap"' };

  test('returns the guest\'s OWN unpaid hold (200 + manage_token) instead of a false 409', async () => {
    const ownHold = { id: 'held-1', status: 'pending', payment_status: 'unpaid', guest_id: 'u1', guest_email: 'g@x.com', guest_phone: '9990001111', customer_total: 11.8 };
    wireSupabase({
      service: { id: 's1', title: 'SEO', duration: 30, price: 0, meeting_mode: 'online' },
      host: { id: 'h1', email: 'h@x.com', phone: '7904109359' },
      avail: { timezone: 'Asia/Kolkata' },
      insertError: conflict,
      holds: [ownHold],
    });
    const r = res();
    const req = { user: { id: 'u1' }, body: { service_id: 's1', guest_name: 'G', guest_email: 'g@x.com', scheduled_at: '2099-01-01T05:00:00.000Z' } };
    await createBooking(req, r);
    expect(r.status).toHaveBeenCalledWith(200);
    const body = r.json.mock.calls[0][0];
    expect(body).toMatchObject({ id: 'held-1', resumed: true });
    expect(body.manage_token).toBeTruthy();
  });

  test('a genuine third-party conflict (no matching own hold) still returns 409', async () => {
    // The only hold at the slot belongs to a DIFFERENT guest — not ours.
    const othersHold = { id: 'held-x', status: 'pending', payment_status: 'unpaid', guest_id: 'someone-else', guest_email: 'x@x.com', guest_phone: '8888888888' };
    wireSupabase({
      service: { id: 's1', title: 'SEO', duration: 30, price: 0, meeting_mode: 'online' },
      host: { id: 'h1', email: 'h@x.com', phone: '7904109359' },
      avail: { timezone: 'Asia/Kolkata' },
      insertError: conflict,
      holds: [othersHold],
    });
    const r = res();
    const req = { user: { id: 'u1' }, body: { service_id: 's1', guest_name: 'G', guest_email: 'g@x.com', scheduled_at: '2099-01-01T05:00:00.000Z' } };
    await createBooking(req, r);
    expect(r.status).toHaveBeenCalledWith(409);
  });
});
