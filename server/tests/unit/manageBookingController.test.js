/**
 * Unit tests for the public, token-authorized manage-booking controller.
 * The signed token is the auth; it resolves exactly one booking id. Cancellation
 * delegates to the shared cancelBookingRecord (mocked here).
 */
jest.mock('../../utils/httpError', () => ({ safeError: (res) => res.status(500).json({ message: 'err' }) }));
jest.mock('../../utils/manageBookingToken', () => ({ verify: jest.fn(), sign: jest.fn(() => 'signed-token') }));
jest.mock('../../controllers/bookingController', () => ({ cancelBookingRecord: jest.fn() }));
jest.mock('../../controllers/paymentController', () => ({ buildBookingOrder: jest.fn() }));
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));

const { supabaseAdmin } = require('../../config/supabase');
const manageBookingToken = require('../../utils/manageBookingToken');
const { cancelBookingRecord } = require('../../controllers/bookingController');
const { buildBookingOrder } = require('../../controllers/paymentController');
const { getByToken, cancelByToken, payByToken } = require('../../controllers/manageBookingController');

// Drive supabaseAdmin.from('bookings').select().eq().single() → { data }.
const mockBooking = (booking) => {
  supabaseAdmin.from.mockReturnValue({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: booking }) }) }),
  });
};

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

const BOOKING = {
  id: 'b1', status: 'confirmed', scheduled_at: '2026-08-01T10:00:00Z',
  meeting_mode: 'online', meeting_link: 'https://meet/x', payment_status: 'paid',
  guest_name: 'Asha', services: { title: 'Consult' }, profiles: { name: 'Dr Roy', email: 'roy@x.com' },
};

beforeEach(() => jest.clearAllMocks());

describe('getByToken', () => {
  test('401 on an invalid/expired token', async () => {
    manageBookingToken.verify.mockReturnValue(null);
    const r = res();
    await getByToken({ params: { token: 'bad' } }, r);
    expect(r.status).toHaveBeenCalledWith(401);
  });

  test('404 when the token is valid but the booking is gone', async () => {
    manageBookingToken.verify.mockReturnValue('b1');
    mockBooking(null);
    const r = res();
    await getByToken({ params: { token: 'ok' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  test('returns a safe public view (no host email) with a cancellable flag', async () => {
    manageBookingToken.verify.mockReturnValue('b1');
    mockBooking(BOOKING);
    const r = res();
    await getByToken({ params: { token: 'ok' } }, r);
    const view = r.json.mock.calls[0][0];
    expect(view).toMatchObject({ id: 'b1', service_title: 'Consult', host_name: 'Dr Roy', cancellable: true });
    expect(view).not.toHaveProperty('profiles');   // no raw host PII leaked
    expect(view.host_email).toBeUndefined();
  });
});

describe('cancelByToken', () => {
  test('cancels a live booking via the shared record helper (anonymous actor)', async () => {
    manageBookingToken.verify.mockReturnValue('b1');
    mockBooking(BOOKING);
    cancelBookingRecord.mockResolvedValue({ ...BOOKING, status: 'cancelled' });
    const r = res();
    await cancelByToken({ params: { token: 'ok' } }, r);
    expect(cancelBookingRecord).toHaveBeenCalledWith(BOOKING, { cancelledBy: 'guest', actorUserId: null });
    expect(r.json.mock.calls[0][0].status).toBe('cancelled');
  });

  test('409 on a completed booking — never cancels a closed booking', async () => {
    manageBookingToken.verify.mockReturnValue('b1');
    mockBooking({ ...BOOKING, status: 'completed' });
    const r = res();
    await cancelByToken({ params: { token: 'ok' } }, r);
    expect(r.status).toHaveBeenCalledWith(409);
    expect(cancelBookingRecord).not.toHaveBeenCalled();
  });

  test('idempotent — an already-cancelled booking returns the view, no re-cancel', async () => {
    manageBookingToken.verify.mockReturnValue('b1');
    mockBooking({ ...BOOKING, status: 'cancelled' });
    const r = res();
    await cancelByToken({ params: { token: 'ok' } }, r);
    expect(cancelBookingRecord).not.toHaveBeenCalled();
    expect(r.json.mock.calls[0][0].status).toBe('cancelled');
  });

  test('401 on an invalid token', async () => {
    manageBookingToken.verify.mockReturnValue(null);
    const r = res();
    await cancelByToken({ params: { token: 'bad' } }, r);
    expect(r.status).toHaveBeenCalledWith(401);
  });
});

describe('payByToken (F7 — resume payment from the link)', () => {
  test('401 on an invalid/expired token — no order built', async () => {
    manageBookingToken.verify.mockReturnValue(null);
    const r = res();
    await payByToken({ params: { token: 'bad' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(buildBookingOrder).not.toHaveBeenCalled();
  });

  test('404 when the token is valid but the booking is gone', async () => {
    manageBookingToken.verify.mockReturnValue('b1');
    mockBooking(null);
    const r = res();
    await payByToken({ params: { token: 'ok' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(buildBookingOrder).not.toHaveBeenCalled();
  });

  test('token possession authorizes the order — delegates to the shared builder', async () => {
    manageBookingToken.verify.mockReturnValue('b1');
    const pending = { ...BOOKING, status: 'pending', payment_status: 'unpaid' };
    mockBooking(pending);
    buildBookingOrder.mockResolvedValue({ status: 200, body: { razorpay_order_id: 'order_1', amount: 1180, key: 'rzp_key' } });
    const r = res();
    await payByToken({ params: { token: 'ok' }, body: { billing_details: { state: 'Maharashtra' } } }, r);
    expect(buildBookingOrder).toHaveBeenCalledWith(pending, { billingFromRequest: { state: 'Maharashtra' } });
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.json.mock.calls[0][0]).toMatchObject({ razorpay_order_id: 'order_1' });
  });

  test('surfaces the builder\'s own status/body (e.g. already paid)', async () => {
    manageBookingToken.verify.mockReturnValue('b1');
    mockBooking({ ...BOOKING, payment_status: 'paid' });
    buildBookingOrder.mockResolvedValue({ status: 400, body: { message: 'Already paid' } });
    const r = res();
    await payByToken({ params: { token: 'ok' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json.mock.calls[0][0]).toMatchObject({ message: 'Already paid' });
  });
});
