/**
 * The one payout rail.
 *
 * The property this file exists to hold: money reaches a host by exactly one
 * mechanism. The admin release is a TRIGGER for the per-booking Route transfer,
 * not a second way out of the platform balance.
 *
 * Two assertions carry the weight — a booking already on the rail is never
 * driven again, and the rail never pays more than an admin approved. Everything
 * else here is about failing in the right direction.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/routeAutoPayoutService', () => ({
  createHeldTransferForBooking: jest.fn(),
  releaseHeldTransfer: jest.fn(),
}));

const { supabaseAdmin } = require('../../config/supabase');
const auto = require('../../services/routeAutoPayoutService');
const { releaseViaRail, payableBookings, ALREADY_MOVING } = require('../../services/payoutRail');

const HOST = 'host-1';
const booking = (over = {}) => ({
  id: `b${Math.random().toString(36).slice(2, 7)}`,
  host_id: HOST, vendor_amount: 1000, payment_status: 'paid',
  settlement_status: null, transfer_status: null,
  razorpay_transfer_id: null, razorpay_payment_id: 'pay_1',
  created_at: '2026-11-01T00:00:00Z', ...over,
});

const withBookings = (rows) => {
  const q = {
    select: () => q,
    eq: () => q,
    order: () => Promise.resolve({ data: rows, error: null }),
  };
  supabaseAdmin.from.mockReturnValue(q);
};

beforeEach(() => {
  jest.clearAllMocks();
  auto.createHeldTransferForBooking.mockImplementation(async () => ({ ok: true, transferId: 'trf_x', status: 'held' }));
  auto.releaseHeldTransfer.mockImplementation(async () => ({ ok: true, released: true }));
});

describe('only the rail moves money', () => {
  it('drives the per-booking transfer instead of a balance transfer', async () => {
    withBookings([booking({ vendor_amount: 500 })]);
    const r = await releaseViaRail({ host_id: HOST, amount: 500 });

    expect(r.ok).toBe(true);
    expect(r.paid).toBe(500);
    // The Razorpay call is made by the auto rail, never here.
    expect(auto.createHeldTransferForBooking).toHaveBeenCalledTimes(1);
    expect(auto.releaseHeldTransfer).toHaveBeenCalledTimes(1);
  });

  it('releases a booking that already has a held transfer without creating another', async () => {
    withBookings([booking({ transfer_status: 'failed', razorpay_transfer_id: 'trf_old', vendor_amount: 500 })]);
    await releaseViaRail({ host_id: HOST, amount: 500 });
    // 'failed' re-creates (the auto rail adopts an existing transfer if there is
    // one); it must not be skipped as if the money had gone.
    expect(auto.createHeldTransferForBooking).toHaveBeenCalled();
  });
});

describe('a booking already on the rail is never driven again', () => {
  it.each([...ALREADY_MOVING])('skips transfer_status %s', async (status) => {
    // This is the double-pay guard. settlementService used to carry a matching
    // exclusion because two mechanisms could both pay the same booking; with
    // one mechanism the judgement lives here, once.
    withBookings([booking({ transfer_status: status })]);
    const r = await releaseViaRail({ host_id: HOST, amount: 1000 });
    expect(auto.createHeldTransferForBooking).not.toHaveBeenCalled();
    expect(auto.releaseHeldTransfer).not.toHaveBeenCalled();
    expect(r.paid).toBe(0);
  });

  it('reports no payable bookings as not-ok, without calling it a failure', async () => {
    withBookings([booking({ transfer_status: 'processed' })]);
    const r = await releaseViaRail({ host_id: HOST, amount: 1000 });
    // Usually means the automatic release already paid them. Not a success,
    // not a transfer error — the caller has to be able to tell them apart.
    expect(r).toMatchObject({ ok: false, paid: 0, results: [] });
  });
});

describe('never more than was approved', () => {
  it('stops before a booking that would overshoot', async () => {
    withBookings([booking({ vendor_amount: 600 }), booking({ vendor_amount: 600 })]);
    const r = await releaseViaRail({ host_id: HOST, amount: 1000 });
    // Transfers cannot be part-released, so one booking is taken and the rest
    // stays owed. Paying ₹1,200 against a ₹1,000 approval is the failure this
    // prevents.
    expect(r.paid).toBe(600);
    expect(r.shortfall).toBe(400);
    expect(r.bookings).toBe(1);
  });

  it('pays exactly when the bookings add up', async () => {
    withBookings([booking({ vendor_amount: 400 }), booking({ vendor_amount: 600 })]);
    const r = await releaseViaRail({ host_id: HOST, amount: 1000 });
    expect(r.paid).toBe(1000);
    expect(r.shortfall).toBe(0);
  });

  it('takes the oldest money first', async () => {
    const old = booking({ vendor_amount: 500, created_at: '2026-01-01T00:00:00Z' });
    const recent = booking({ vendor_amount: 500, created_at: '2026-11-01T00:00:00Z' });
    withBookings([old, recent]); // query orders ascending; preserved here
    await releaseViaRail({ host_id: HOST, amount: 500 });
    expect(auto.createHeldTransferForBooking.mock.calls[0][0].id).toBe(old.id);
  });
});

describe('what is excluded from the rail', () => {
  it('ignores unpaid, cancelled, not-eligible and zero-value bookings', async () => {
    withBookings([
      booking({ payment_status: 'unpaid' }),
      booking({ settlement_status: 'cancelled' }),
      booking({ settlement_status: 'not_eligible' }),
      booking({ vendor_amount: 0 }),
    ]);
    expect(await payableBookings(HOST)).toEqual([]);
  });

  it('treats a negative vendor_amount as nothing owed', async () => {
    // Only reachable through a corrupted row, but a negative here would
    // otherwise let the loop pay a booking and reduce the running total.
    withBookings([booking({ vendor_amount: -500 })]);
    expect(await payableBookings(HOST)).toEqual([]);
  });
});

describe('failing in the right direction', () => {
  it('refuses a payout with no host or no amount', async () => {
    const r = await releaseViaRail({ amount: 0 });
    expect(r).toMatchObject({ ok: false, error: 'invalid_payout' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('keeps going when one booking fails, and reports it', async () => {
    withBookings([booking({ vendor_amount: 400 }), booking({ vendor_amount: 400 })]);
    auto.releaseHeldTransfer
      .mockResolvedValueOnce({ ok: false, error: 'razorpay down' })
      .mockResolvedValueOnce({ ok: true, released: true });

    const r = await releaseViaRail({ host_id: HOST, amount: 800 });
    // One failure must not strand the rest of a host's money.
    expect(r.paid).toBe(400);
    expect(r.results.some((x) => x.reason === 'razorpay down')).toBe(true);
  });

  it('counts nothing as paid when the transfer could not be created', async () => {
    withBookings([booking({ vendor_amount: 400 })]);
    auto.createHeldTransferForBooking.mockResolvedValue({ ok: false, error: 'no_linked_account' });
    const r = await releaseViaRail({ host_id: HOST, amount: 400 });
    expect(r.paid).toBe(0);
    expect(auto.releaseHeldTransfer).not.toHaveBeenCalled();
  });
});
