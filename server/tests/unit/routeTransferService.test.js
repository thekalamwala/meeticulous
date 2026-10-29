'use strict';
/**
 * routeTransferService — Razorpay Route Phase 1 host payout (transfer-from-balance).
 *
 * Guarantees under test:
 *   • DORMANT while fee_only_mode is true — no transfer created.
 *   • Idempotent — an already-transferred payout is not re-sent; a processed
 *     transfer posts the SETTLEMENT ledger + flips to paid exactly once.
 *   • Money-safe — ledger is posted before the paid flip; a create failure records
 *     transfer_status='failed' and never throws to the caller.
 *   • rupees → paise conversion at the Razorpay boundary.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/razorpayConfig', () => ({
  isConfigured: jest.fn(() => Promise.resolve(true)),
  getClient: jest.fn(),
}));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../services/ledger/postingService', () => ({ post: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const razorpayConfig = require('../../services/razorpayConfig');
const platformConfig = require('../../services/platformConfig');
const { post } = require('../../services/ledger/postingService');
const svc = require('../../services/routeTransferService');

let state;
const wireSupabase = () => {
  state = { linkedAccountId: 'acc_HOST', payoutRow: null, updates: [], updateError: null };
  supabaseAdmin.from.mockImplementation((table) => {
    const c = {};
    c.select = jest.fn(() => c);
    c.update = jest.fn((patch) => { state.updates.push(patch); return c; });
    c.eq = jest.fn(() => c);
    c.maybeSingle = jest.fn(() => {
      if (table === 'kyc_submissions') return Promise.resolve({ data: { razorpay_account_id: state.linkedAccountId }, error: null });
      return Promise.resolve({ data: state.payoutRow, error: state.updateError });
    });
    return c;
  });
};
const merged = () => Object.assign({}, ...state.updates);

const approvedPayout = (over = {}) => ({
  id: 'po-1', host_id: 'host-1', amount: 909.76, status: 'approved',
  approved_by: 'admin-A', razorpay_transfer_id: null, ...over,
});

const clientWith = (transfer) => ({ transfers: { create: jest.fn(() => Promise.resolve(transfer)) } });

beforeEach(() => {
  jest.clearAllMocks();
  platformConfig.getConfig.mockResolvedValue({ feeOnlyMode: false });
  wireSupabase();
});

describe('releasePayout gating', () => {
  test('no-ops while fee_only_mode is true — never transfers', async () => {
    platformConfig.getConfig.mockResolvedValue({ feeOnlyMode: true });
    const res = await svc.releasePayout(approvedPayout());
    expect(res).toEqual({ ok: false, skipped: 'fee_only_mode' });
    expect(razorpayConfig.getClient).not.toHaveBeenCalled();
  });

  test('rejects a non-approved payout', async () => {
    const res = await svc.releasePayout(approvedPayout({ status: 'pending' }));
    expect(res.ok).toBe(false);
    expect(razorpayConfig.getClient).not.toHaveBeenCalled();
  });

  test('is idempotent — already-transferred payout is not re-sent', async () => {
    const res = await svc.releasePayout(approvedPayout({ razorpay_transfer_id: 'trf_x' }));
    expect(res).toEqual({ ok: true, transferId: 'trf_x', skipped: 'already_transferred' });
    expect(razorpayConfig.getClient).not.toHaveBeenCalled();
  });

  test('errors when the host has no linked account', async () => {
    state.linkedAccountId = null;
    const res = await svc.releasePayout(approvedPayout());
    expect(res).toEqual({ ok: false, error: 'host_has_no_linked_account' });
  });
});

describe('releasePayout transfer', () => {
  test('creates transfer in paise; synchronous processed → ledger + paid', async () => {
    const client = clientWith({ id: 'trf_1', status: 'processed' });
    razorpayConfig.getClient.mockResolvedValue(client);

    const res = await svc.releasePayout(approvedPayout(), { actorId: 'admin-B' });
    expect(res).toEqual({ ok: true, transferId: 'trf_1', status: 'processed' });

    // rupees → paise, destination = linked account
    expect(client.transfers.create).toHaveBeenCalledWith(expect.objectContaining({
      account: 'acc_HOST', amount: 90976, currency: 'INR',
    }));
    // ledger posted, SETTLEMENT keyed on payout id
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'SETTLEMENT', sourceId: 'po-1' }));
    // final state: transfer id stored + flipped to paid
    expect(merged()).toMatchObject({ razorpay_transfer_id: 'trf_1', status: 'paid', payment_reference: 'trf_1' });
  });

  test('pending transfer stores id but does NOT post ledger or flip to paid', async () => {
    razorpayConfig.getClient.mockResolvedValue(clientWith({ id: 'trf_2', status: 'pending' }));
    const res = await svc.releasePayout(approvedPayout());
    expect(res).toEqual({ ok: true, transferId: 'trf_2', status: 'pending' });
    expect(post).not.toHaveBeenCalled();
    expect(merged()).toMatchObject({ razorpay_transfer_id: 'trf_2', transfer_status: 'pending' });
    expect(merged().status).toBeUndefined();
  });

  test('a Razorpay error is swallowed and recorded transfer_status=failed', async () => {
    const client = { transfers: { create: jest.fn(() => Promise.reject({ error: { description: 'insufficient balance' } })) } };
    razorpayConfig.getClient.mockResolvedValue(client);
    const res = await svc.releasePayout(approvedPayout());
    expect(res).toEqual({ ok: false, error: 'insufficient balance' });
    expect(merged()).toMatchObject({ transfer_status: 'failed', transfer_error: 'insufficient balance' });
  });
});

describe('handleTransferWebhook', () => {
  test('processed → finalizes (ledger + paid) once', async () => {
    state.payoutRow = approvedPayout({ razorpay_transfer_id: 'trf_9' });
    const res = await svc.handleTransferWebhook({ id: 'trf_9', status: 'processed' });
    expect(res).toEqual({ handled: true });
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'SETTLEMENT', sourceId: 'po-1' }));
    expect(merged()).toMatchObject({ status: 'paid', payment_reference: 'trf_9' });
  });

  test('already-paid payout is not re-posted', async () => {
    state.payoutRow = approvedPayout({ razorpay_transfer_id: 'trf_9', status: 'paid' });
    const res = await svc.handleTransferWebhook({ id: 'trf_9', status: 'processed' });
    expect(res).toEqual({ handled: true, reason: 'already_paid' });
    expect(post).not.toHaveBeenCalled();
  });

  test('failed → marks transfer_status failed, no ledger', async () => {
    state.payoutRow = approvedPayout({ razorpay_transfer_id: 'trf_9' });
    const res = await svc.handleTransferWebhook({ id: 'trf_9', status: 'failed', error: { description: 'beneficiary invalid' } });
    expect(res).toEqual({ handled: true });
    expect(post).not.toHaveBeenCalled();
    expect(merged()).toMatchObject({ transfer_status: 'failed', transfer_error: 'beneficiary invalid' });
  });

  test('unknown transfer id → not handled', async () => {
    state.payoutRow = null;
    const res = await svc.handleTransferWebhook({ id: 'trf_none', status: 'processed' });
    expect(res).toEqual({ handled: false, reason: 'payout_not_found' });
  });
});
