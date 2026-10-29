// Unit tests for the booking-payment reconciler. supabaseAdmin, razorpayConfig
// and analytics are mocked so nothing leaves the process.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/razorpayConfig', () => ({ getClient: jest.fn() }));
jest.mock('../../utils/trackServer', () => ({ trackServer: jest.fn() }));
jest.mock('../../utils/posthog', () => ({ resolveGuestId: jest.fn(() => 'guest-1') }));
// Ledger is exercised by the shared finalizer; keep this test hermetic.
jest.mock('../../services/ledger/journalTemplates', () => ({ orderPaymentEntry: jest.fn(() => ({ description: 'ORDER_PAYMENT', lines: [] })) }));
jest.mock('../../services/ledger/postingService', () => ({ postSafe: jest.fn(() => Promise.resolve('je-1')) }));
// Confirmation + invoice generators are exercised by their own suites; mock them
// so this test stays hermetic and can assert the healed path mints an invoice.
jest.mock('../../services/bookingConfirmation', () => ({ sendBookingConfirmation: jest.fn(() => Promise.resolve()) }));
jest.mock('../../controllers/paymentController', () => ({
  generateBookingInvoice: jest.fn(() => Promise.resolve({ id: 'inv_1', access_token: 'tok_1' })),
  generateCommissionInvoice: jest.fn(() => Promise.resolve(null)),
}));

const { supabaseAdmin } = require('../../config/supabase');
const razorpayConfig = require('../../services/razorpayConfig');
const { trackServer } = require('../../utils/trackServer');
const { sendBookingConfirmation } = require('../../services/bookingConfirmation');
const paymentController = require('../../controllers/paymentController');
const reconciler = require('../../services/bookingPaymentReconciler');

// A chain whose terminal awaited value resolves to `result`. Every builder
// method returns the same chain; awaiting it (.then) yields `result`.
const makeChain = (result) => {
  const chain = {};
  for (const m of ['select', 'update', 'eq', 'neq', 'lt', 'gt', 'is', 'not', 'in', 'order', 'limit']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.then = (resolve) => resolve(result);
  return chain;
};

const stuckBooking = {
  id: 'b1', razorpay_order_id: 'order_1', host_id: 'v1',
  guest_id: 'g1', guest_email: 'g@example.com', customer_total: 500,
  services: { title: 'Consult' },
};

beforeEach(() => jest.clearAllMocks());

test('confirms a stuck booking whose order Razorpay reports as captured', async () => {
  // First .from('bookings') = the scan; second = the update. Sequence the two.
  supabaseAdmin.from
    .mockReturnValueOnce(makeChain({ data: [stuckBooking], error: null }))   // scan
    .mockReturnValueOnce(makeChain({ data: [{ ...stuckBooking }], error: null })); // update→paid

  razorpayConfig.getClient.mockResolvedValue({
    orders: { fetchPayments: jest.fn().mockResolvedValue({ items: [{ id: 'pay_1', status: 'captured' }] }) },
  });

  const r = await reconciler.reconcile();

  expect(r).toEqual({ checked: 1, healed: 1 });
  expect(trackServer).toHaveBeenCalledTimes(1);
  expect(trackServer.mock.calls[0][1]).toBe('booking_paid');
  expect(trackServer.mock.calls[0][2].source).toBe('reconciler');
  expect(trackServer.mock.calls[0][2].razorpay_payment_id).toBe('pay_1');
});

test('mints the GST + commission invoices on the healed path and passes the invoiceRef to confirmation', async () => {
  supabaseAdmin.from
    .mockReturnValueOnce(makeChain({ data: [stuckBooking], error: null }))            // scan
    .mockReturnValueOnce(makeChain({ data: [{ ...stuckBooking }], error: null }));    // update→paid

  razorpayConfig.getClient.mockResolvedValue({
    orders: { fetchPayments: jest.fn().mockResolvedValue({ items: [{ id: 'pay_1', status: 'captured' }] }) },
  });

  const r = await reconciler.reconcile();

  expect(r).toEqual({ checked: 1, healed: 1 });
  expect(paymentController.generateBookingInvoice).toHaveBeenCalledTimes(1);
  expect(paymentController.generateCommissionInvoice).toHaveBeenCalledTimes(1);
  // The tokenized ref (not null) reaches the confirmation email — the whole point of #643.
  expect(sendBookingConfirmation).toHaveBeenCalledWith(
    expect.objectContaining({ invoiceRef: { id: 'inv_1', token: 'tok_1' } }),
  );
});

test('leaves a booking untouched when the order has no captured payment', async () => {
  supabaseAdmin.from.mockReturnValueOnce(makeChain({ data: [stuckBooking], error: null }));
  razorpayConfig.getClient.mockResolvedValue({
    orders: { fetchPayments: jest.fn().mockResolvedValue({ items: [{ id: 'pay_x', status: 'failed' }] }) },
  });

  const r = await reconciler.reconcile();

  expect(r).toEqual({ checked: 1, healed: 0 });
  // only the scan query ran — no update issued
  expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  expect(trackServer).not.toHaveBeenCalled();
});

test('does not double-count when a late webhook already won the transition', async () => {
  supabaseAdmin.from
    .mockReturnValueOnce(makeChain({ data: [stuckBooking], error: null }))  // scan
    .mockReturnValueOnce(makeChain({ data: [], error: null }));             // update matched 0 rows

  razorpayConfig.getClient.mockResolvedValue({
    orders: { fetchPayments: jest.fn().mockResolvedValue({ items: [{ id: 'pay_1', status: 'captured' }] }) },
  });

  const r = await reconciler.reconcile();

  expect(r).toEqual({ checked: 1, healed: 0 });
  expect(trackServer).not.toHaveBeenCalled();
});

test('no-ops cleanly when nothing is stuck', async () => {
  supabaseAdmin.from.mockReturnValueOnce(makeChain({ data: [], error: null }));

  const r = await reconciler.reconcile();

  expect(r).toEqual({ checked: 0, healed: 0 });
  expect(razorpayConfig.getClient).not.toHaveBeenCalled();
});

test('a Razorpay error on one booking does not abort the run', async () => {
  const b2 = { ...stuckBooking, id: 'b2', razorpay_order_id: 'order_2' };
  supabaseAdmin.from
    .mockReturnValueOnce(makeChain({ data: [stuckBooking, b2], error: null })) // scan: two
    .mockReturnValueOnce(makeChain({ data: [{ ...b2 }], error: null }));        // update for b2

  razorpayConfig.getClient.mockResolvedValue({
    orders: {
      fetchPayments: jest.fn()
        .mockRejectedValueOnce(new Error('rzp 500'))                                   // b1 throws
        .mockResolvedValueOnce({ items: [{ id: 'pay_2', status: 'captured' }] }),      // b2 captured
    },
  });

  const r = await reconciler.reconcile();

  expect(r).toEqual({ checked: 2, healed: 1 });
  expect(trackServer).toHaveBeenCalledTimes(1);
});
