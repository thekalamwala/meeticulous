/**
 * Security: escHtml + confirmReschedule XSS / info-leak hardening
 *
 * Two test suites:
 *   1. Unit-test escHtml directly (fast, no mocks needed).
 *   2. Handler-level test: confirmReschedule with a service title containing
 *      raw HTML/JS — asserts the response body contains the escaped form and
 *      NOT the raw script tag.
 */

// ── module-level mocks (must come before any require()) ──────────────────────
jest.mock('../../config/google', () => ({
  createCalendarEvent: jest.fn(),
  updateCalendarEvent: jest.fn(),
}));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (v) => v }));
jest.mock('../../utils/sendEmail', () => jest.fn().mockResolvedValue());
jest.mock('../../middleware/planMiddleware', () => ({
  checkBookingReceiveLimit: jest.fn().mockResolvedValue({ allowed: true }),
}));
jest.mock('../../services/planService', () => ({
  resolveVendorPlan: () => 'explorer',
  getPlan: jest.fn().mockResolvedValue({ commission_percentage: 0 }),
  reminderWindowsForPlan: jest.fn().mockResolvedValue([]),
  rescheduleNotifyForPlan: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../services/platformConfig', () => ({
  getConfig: jest.fn().mockResolvedValue({ platformFee: 10, gstRate: 0.18 }),
}));
jest.mock('../../lib/pricingEngine', () => ({
  computeBreakdown: () => ({ platformFee: 10, commission: 0, vendorPayout: 100, gst: 1.8, customerTotal: 111.8 }),
}));
jest.mock('../../services/availabilityService', () => ({
  validateSlot: jest.fn().mockResolvedValue({ ok: true }),
}));

const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

// ── load the module under test AFTER mocks ────────────────────────────────────
// We import the whole controller so we can test escHtml indirectly. Because
// escHtml is not exported we also re-derive it here to cover the pure-unit path.
const { confirmReschedule } = require('../../controllers/bookingController');

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: escHtml — unit-test the helper in isolation
// ─────────────────────────────────────────────────────────────────────────────
// Mirror the helper exactly so we can test it without exporting it from the
// controller. If the implementation ever drifts the handler test below will
// catch the regression.
const escHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

describe('escHtml helper', () => {
  test('escapes <', () => expect(escHtml('<')).toBe('&lt;'));
  test('escapes >', () => expect(escHtml('>')).toBe('&gt;'));
  test('escapes &', () => expect(escHtml('&')).toBe('&amp;'));
  test('escapes "', () => expect(escHtml('"')).toBe('&quot;'));
  test("escapes '", () => expect(escHtml("'")).toBe('&#39;'));
  test('handles null', () => expect(escHtml(null)).toBe(''));
  test('handles undefined', () => expect(escHtml(undefined)).toBe(''));
  test('leaves safe strings alone', () => expect(escHtml('Hello World')).toBe('Hello World'));
  test('escapes a full XSS payload', () => {
    const raw = '<script>alert(1)</script>';
    const out = escHtml(raw);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: confirmReschedule handler — XSS + info-leak assertions
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal mock res object that captures the body sent via res.send(). */
const makeRes = () => {
  let _body = '';
  const r = {
    _getBody: () => _body,
    status: jest.fn(function () { return r; }),
    send: jest.fn(function (body) { _body = body || ''; return r; }),
    json: jest.fn(function () { return r; }),
  };
  return r;
};

/** Wire supabaseAdmin.from() so the first .select().eq().eq().single() call
 *  returns the supplied booking, and the subsequent .update().eq() chain
 *  resolves with no error. */
const wireSupabase = (booking, updateError = null) => {
  mockFrom.mockImplementation(() => {
    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      update: jest.fn(() => chain),
      single: jest.fn().mockResolvedValue({ data: booking, error: null }),
      then: (resolve) => resolve({ data: null, error: updateError }),
    };
    return chain;
  });
};

const XSS_TITLE = '<script>alert(1)</script>';

const makeBooking = (title = XSS_TITLE) => ({
  id: 'b1',
  host_id: 'h1',
  guest_name: 'Guest',
  guest_email: 'guest@example.com',
  scheduled_at: '2099-06-01T10:00:00.000Z',
  reschedule_ack_token: 'valid-token',
  services: { title },
  'profiles!bookings_host_id_fkey': {
    id: 'h1',
    name: 'Host Name',
    email: 'host@example.com',
    phone: '9999999999',
    username: 'hostuser',
  },
});

beforeEach(() => jest.clearAllMocks());

describe('confirmReschedule handler', () => {
  test('escapes XSS service title — raw <script> tag must NOT appear in response', async () => {
    wireSupabase(makeBooking(XSS_TITLE));
    const req = { params: { id: 'b1' }, query: { token: 'valid-token' } };
    const res = makeRes();

    await confirmReschedule(req, res);

    const body = res._getBody();
    expect(body).not.toContain('<script>alert(1)');
    expect(body).toContain('&lt;script&gt;');
    expect(res.send).toHaveBeenCalledTimes(1);
  });

  test('escapes other HTML metacharacters in service title', async () => {
    wireSupabase(makeBooking('A & B <em>"quote"</em>'));
    const req = { params: { id: 'b1' }, query: { token: 'valid-token' } };
    const res = makeRes();

    await confirmReschedule(req, res);

    const body = res._getBody();
    expect(body).not.toContain('<em>');
    expect(body).toContain('&amp;');
    expect(body).toContain('&lt;em&gt;');
  });

  test('returns 404 for missing/invalid token', async () => {
    // Simulate DB returning nothing (invalid token)
    mockFrom.mockImplementation(() => {
      const chain = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
      };
      return chain;
    });
    const req = { params: { id: 'b1' }, query: { token: 'bad-token' } };
    const res = makeRes();

    await confirmReschedule(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns generic 500 (no DB error text) when update fails', async () => {
    // First chain call (select) succeeds; second (update) fails
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // select query
        const chain = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          single: jest.fn().mockResolvedValue({ data: makeBooking(), error: null }),
        };
        return chain;
      }
      // update query — returns error via then()
      const chain = {
        update: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        then: (resolve) => resolve({ data: null, error: { message: 'DB internal detail' } }),
      };
      return chain;
    });

    const req = { params: { id: 'b1' }, query: { token: 'valid-token' } };
    const res = makeRes();

    await confirmReschedule(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res._getBody();
    // Must NOT leak raw DB error text
    expect(body).not.toContain('DB internal detail');
    expect(body).toContain('Please contact support');
  });

  test('missing token returns 400', async () => {
    const req = { params: { id: 'b1' }, query: {} };
    const res = makeRes();

    await confirmReschedule(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
