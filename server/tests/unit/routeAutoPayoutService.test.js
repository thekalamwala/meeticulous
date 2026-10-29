'use strict';
/**
 * routeAutoPayoutService — Phase 2 automatic held-transfer at capture.
 *
 * Guarantees under test:
 *   • DORMANT in fee_only_mode — no transfer.
 *   • No linked account → skipped (money stays owed), NOT an error.
 *   • Creates a payment-linked HELD transfer (on_hold:true, future on_hold_until,
 *     rupees→paise) and records the id + hold time on the booking.
 *   • Idempotent; never throws.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/razorpayConfig', () => ({
  isConfigured: jest.fn(() => Promise.resolve(true)),
  getClient: jest.fn(),
}));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../services/ledger/postingService', () => ({ post: jest.fn(() => Promise.resolve()) }));
jest.mock('../../services/ledger/journalTemplates', () => ({ payoutEntry: jest.fn(() => ({ lines: [] })) }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn() }));
// finalizeReleasedTransfer now fires a fire-and-forget host notification; keep it
// out of this unit's supabase/background surface.
jest.mock('../../utils/inAppNotify', () => ({ inAppNotify: jest.fn() }));
jest.mock('../../services/payoutEmails', () => ({ sendPayoutSent: jest.fn(() => Promise.resolve()), sendVerificationNeeded: jest.fn(() => Promise.resolve()), sendPayoutFailed: jest.fn(() => Promise.resolve()), sendEarningReversed: jest.fn(() => Promise.resolve()) }));

const { supabaseAdmin } = require('../../config/supabase');
const razorpayConfig = require('../../services/razorpayConfig');
const platformConfig = require('../../services/platformConfig');
const svc = require('../../services/routeAutoPayoutService');

let state;
const wireSupabase = () => {
  state = { linkedAccountId: 'acc_HOST', bookingRow: null, updateError: null, updates: [] };
  supabaseAdmin.from.mockImplementation((table) => {
    const c = {};
    c.select = jest.fn(() => c);
    c.update = jest.fn((patch) => { state.updates.push(patch); return c; });
    c.eq = jest.fn(() => c);
    c.is = jest.fn(() => c);
    c.maybeSingle = jest.fn(() => {
      if (table === 'kyc_submissions') return Promise.resolve({ data: { razorpay_account_id: state.linkedAccountId }, error: null });
      if (table === 'services') return Promise.resolve({ data: { duration: 30 }, error: null });
      if (table === 'bookings') return Promise.resolve({ data: state.bookingRow, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    // Thenable so `await update().eq()` (patchBooking) resolves to { error }.
    c.then = (resolve) => resolve({ error: state.updateError });
    return c;
  });
};
const merged = () => Object.assign({}, ...state.updates);

// A booking scheduled 2h in the future, 30-min service.
const booking = (over = {}) => ({
  id: 'bk-1', host_id: 'host-1', service_id: 'svc-1',
  scheduled_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
  services: { duration: 30 },
  razorpay_transfer_id: null,
  ...over,
});

const clientWith = (transfer) => ({ payments: { transfer: jest.fn(() => Promise.resolve({ items: [transfer] })) } });

beforeEach(() => {
  jest.clearAllMocks();
  platformConfig.getConfig.mockResolvedValue({ feeOnlyMode: false });
  wireSupabase();
});

describe('createHeldTransferForBooking gating', () => {
  test('no-op in fee_only_mode', async () => {
    platformConfig.getConfig.mockResolvedValue({ feeOnlyMode: true });
    const res = await svc.createHeldTransferForBooking(booking(), { paymentId: 'pay_1', vendorAmount: 9.28 });
    expect(res).toEqual({ ok: false, skipped: 'fee_only_mode' });
    expect(razorpayConfig.getClient).not.toHaveBeenCalled();
  });

  test('no linked account → skipped (owed), not an error', async () => {
    state.linkedAccountId = null;
    const res = await svc.createHeldTransferForBooking(booking(), { paymentId: 'pay_1', vendorAmount: 9.28 });
    expect(res).toEqual({ ok: false, skipped: 'no_linked_account' });
  });

  test('nothing owed → skipped', async () => {
    const res = await svc.createHeldTransferForBooking(booking(), { paymentId: 'pay_1', vendorAmount: 0 });
    expect(res).toEqual({ ok: false, skipped: 'no_payout_due' });
  });

  test('below Razorpay ₹1 reversal floor → skipped (un-reversible if held)', async () => {
    const res = await svc.createHeldTransferForBooking(booking(), { paymentId: 'pay_1', vendorAmount: 0.93 });
    expect(res).toEqual({ ok: false, skipped: 'below_min_transfer' });
    expect(razorpayConfig.getClient).not.toHaveBeenCalled();
  });

  test('idempotent — booking already has a transfer', async () => {
    const res = await svc.createHeldTransferForBooking(booking({ razorpay_transfer_id: 'trf_x' }), { paymentId: 'pay_1', vendorAmount: 9.28 });
    expect(res).toMatchObject({ ok: true, skipped: 'already_transferred' });
    expect(razorpayConfig.getClient).not.toHaveBeenCalled();
  });
});

describe('createHeldTransferForBooking happy path', () => {
  test('creates a held transfer and records id + hold time', async () => {
    const client = clientWith({ id: 'trf_1', status: 'pending' });
    razorpayConfig.getClient.mockResolvedValue(client);

    const res = await svc.createHeldTransferForBooking(booking(), { paymentId: 'pay_1', vendorAmount: 9.28 });
    expect(res).toMatchObject({ ok: true, transferId: 'trf_1', status: 'pending' });

    // payment-linked transfer, held, future on_hold_until, rupees→paise
    const [paymentId, body] = client.payments.transfer.mock.calls[0];
    expect(paymentId).toBe('pay_1');
    const tr = body.transfers[0];
    expect(tr).toMatchObject({ account: 'acc_HOST', amount: 928, currency: 'INR', on_hold: true });
    expect(tr.on_hold_until).toBeGreaterThan(Math.floor(Date.now() / 1000));

    // persisted bookkeeping
    expect(merged()).toMatchObject({ razorpay_transfer_id: 'trf_1', transfer_status: 'pending' });
    expect(merged().transfer_hold_until).toBeTruthy();
  });

  test('a Razorpay error is swallowed and recorded transfer_status=failed', async () => {
    const client = { payments: { transfer: jest.fn(() => Promise.reject({ error: { description: 'transfer not allowed' } })) } };
    razorpayConfig.getClient.mockResolvedValue(client);
    const res = await svc.createHeldTransferForBooking(booking(), { paymentId: 'pay_1', vendorAmount: 9.28 });
    expect(res).toEqual({ ok: false, error: 'transfer not allowed' });
    expect(merged()).toMatchObject({ transfer_status: 'failed', transfer_error: 'transfer not allowed' });
  });
});

const { post } = require('../../services/ledger/postingService');

describe('releaseHeldTransfer (customer confirmed)', () => {
  test('releases the hold, posts SETTLEMENT ledger, marks processed', async () => {
    const edit = jest.fn(() => Promise.resolve({ id: 'trf_1', status: 'processed' }));
    razorpayConfig.getClient.mockResolvedValue({ transfers: { edit } });

    const bk = { id: 'bk-1', host_id: 'host-1', vendor_amount: 9.28, razorpay_transfer_id: 'trf_1', transfer_status: 'pending' };
    const res = await svc.releaseHeldTransfer(bk);

    expect(res).toEqual({ ok: true, released: true });
    expect(edit).toHaveBeenCalledWith('trf_1', { on_hold: false });
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'SETTLEMENT', sourceId: 'bk-1' }));
    expect(merged()).toMatchObject({ transfer_status: 'processed' });
    expect(merged().transfer_released_at).toBeTruthy();
  });

  test('no-op when there is no held transfer', async () => {
    const res = await svc.releaseHeldTransfer({ id: 'bk-2' });
    expect(res).toEqual({ ok: false, skipped: 'no_transfer' });
    expect(post).not.toHaveBeenCalled();
  });

  test('already released → skipped, no double ledger', async () => {
    const res = await svc.releaseHeldTransfer({ id: 'bk-3', razorpay_transfer_id: 'trf_9', transfer_status: 'processed' });
    expect(res).toEqual({ ok: true, skipped: 'already_released' });
    expect(post).not.toHaveBeenCalled();
  });
});

describe('reverseHeldTransfer (dispute / cancel / report)', () => {
  test('reverses the transfer and marks reversed', async () => {
    const reverse = jest.fn(() => Promise.resolve({ id: 'rvsl_1' }));
    razorpayConfig.getClient.mockResolvedValue({ transfers: { reverse } });
    const res = await svc.reverseHeldTransfer(
      { id: 'bk-1', razorpay_transfer_id: 'trf_1', transfer_status: 'pending' },
      { reason: 'booking cancelled' },
    );
    expect(res).toEqual({ ok: true, reversed: true });
    expect(reverse).toHaveBeenCalledWith('trf_1', {});
    expect(merged()).toMatchObject({ transfer_status: 'reversed', transfer_error: 'booking cancelled' });
  });

  test('no-op when there is no transfer / already reversed', async () => {
    expect(await svc.reverseHeldTransfer({ id: 'b' })).toEqual({ ok: false, skipped: 'no_transfer' });
    expect(await svc.reverseHeldTransfer({ id: 'b', razorpay_transfer_id: 'trf', transfer_status: 'reversed' }))
      .toEqual({ ok: true, skipped: 'already_reversed' });
  });

  test('reverseByPaymentId finds the booking and reverses', async () => {
    state.bookingRow = { id: 'bk-1', razorpay_transfer_id: 'trf_1', transfer_status: 'pending' };
    razorpayConfig.getClient.mockResolvedValue({ transfers: { reverse: jest.fn(() => Promise.resolve({ id: 'rvsl' })) } });
    const res = await svc.reverseByPaymentId('pay_1', 'dispute');
    expect(res).toEqual({ ok: true, reversed: true });
    expect(merged()).toMatchObject({ transfer_status: 'reversed' });
  });
});

describe('handleBookingTransferWebhook', () => {
  test('processed → finalises the booking payout once', async () => {
    state.bookingRow = { id: 'bk-1', host_id: 'host-1', vendor_amount: 9.28, razorpay_transfer_id: 'trf_1', transfer_status: 'pending' };
    const res = await svc.handleBookingTransferWebhook({ id: 'trf_1', status: 'processed' });
    expect(res).toEqual({ handled: true });
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'SETTLEMENT', sourceId: 'bk-1' }));
    expect(merged()).toMatchObject({ transfer_status: 'processed' });
  });

  test('reversed → records status, no ledger', async () => {
    state.bookingRow = { id: 'bk-1', host_id: 'host-1', vendor_amount: 9.28, razorpay_transfer_id: 'trf_1', transfer_status: 'pending' };
    const res = await svc.handleBookingTransferWebhook({ id: 'trf_1', status: 'reversed', error: { description: 'refunded' } });
    expect(res).toEqual({ handled: true });
    expect(post).not.toHaveBeenCalled();
    expect(merged()).toMatchObject({ transfer_status: 'reversed', transfer_error: 'refunded' });
  });

  test('unknown transfer id → not a booking transfer', async () => {
    state.bookingRow = null;
    const res = await svc.handleBookingTransferWebhook({ id: 'trf_x', status: 'processed' });
    expect(res).toEqual({ handled: false, reason: 'not_a_booking_transfer' });
  });
});

const { inAppNotify } = require('../../utils/inAppNotify');

describe('applyTransferSettlement (v3.124 bank-settlement leg)', () => {
  test('settled → records status, stamps settled_at once, notifies host', async () => {
    state.bookingRow = { id: 'bk-1', host_id: 'host-1', vendor_amount: 9.28 };
    const res = await svc.applyTransferSettlement({ id: 'trf_1', settlement_status: 'settled', recipient_settlement_id: 'setl_1' });
    expect(res).toMatchObject({ settled: true, firstSettle: true });
    expect(merged()).toMatchObject({ transfer_settlement_status: 'settled', recipient_settlement_id: 'setl_1' });
    expect(merged().transfer_settled_at).toBeTruthy();
    expect(inAppNotify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'host-1', type: 'PAYOUT_UPDATE' }));
  });

  test('pending → records status only, no settled_at, no notify', async () => {
    const res = await svc.applyTransferSettlement({ id: 'trf_1', settlement_status: 'pending' });
    expect(res).toMatchObject({ settled: false, status: 'pending' });
    expect(merged()).toMatchObject({ transfer_settlement_status: 'pending' });
    expect(merged().transfer_settled_at).toBeUndefined();
    expect(inAppNotify).not.toHaveBeenCalled();
  });

  test('settled but already stamped (atomic claim returns no row) → no duplicate notify', async () => {
    state.bookingRow = null;   // the is-null claim matched nothing → already settled earlier
    const res = await svc.applyTransferSettlement({ id: 'trf_1', settlement_status: 'settled' });
    expect(res).toMatchObject({ settled: true, firstSettle: false });
    expect(inAppNotify).not.toHaveBeenCalled();
  });

  test('schema fallback — v3.124 columns missing → skipped, never throws', async () => {
    state.updateError = { code: '42703', message: 'column "transfer_settlement_status" does not exist' };
    const res = await svc.applyTransferSettlement({ id: 'trf_1', settlement_status: 'settled' });
    expect(res).toEqual({ skipped: 'schema' });
  });
});

describe('handleSettlementWebhook (settlement.processed)', () => {
  test('fetches transfers for the recipient settlement and settles each booking', async () => {
    state.bookingRow = { id: 'bk-1', host_id: 'host-1', vendor_amount: 9.28 };
    const all = jest.fn(() => Promise.resolve({ items: [{ id: 'trf_1', settlement_status: 'settled', recipient_settlement_id: 'setl_1' }] }));
    razorpayConfig.getClient.mockResolvedValue({ transfers: { all } });
    const res = await svc.handleSettlementWebhook({ id: 'setl_1' });
    expect(all).toHaveBeenCalledWith(expect.objectContaining({ recipient_settlement_id: 'setl_1' }));
    expect(res).toMatchObject({ handled: true, transfers: 1, settled: 1 });
  });

  test('settlement with no Route transfers (e.g. parent merchant) → harmless no-op', async () => {
    razorpayConfig.getClient.mockResolvedValue({ transfers: { all: jest.fn(() => Promise.resolve({ items: [] })) } });
    const res = await svc.handleSettlementWebhook({ id: 'setl_merchant' });
    expect(res).toEqual({ handled: true, reason: 'no_route_transfers' });
  });

  test('missing settlement id → not handled', async () => {
    expect(await svc.handleSettlementWebhook({})).toEqual({ handled: false, reason: 'no_settlement_id' });
  });
});
