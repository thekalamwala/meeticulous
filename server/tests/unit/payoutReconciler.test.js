'use strict';

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/razorpayConfig', () => ({ getClient: jest.fn() }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../services/payoutEligibility', () => ({ isPayoutEligible: jest.fn() }));
jest.mock('../../services/routeAutoPayoutService', () => ({
  createHeldTransferForBooking: jest.fn(),
  finalizeReleasedTransfer: jest.fn(),
  applyTransferSettlement: jest.fn(() => Promise.resolve({ settled: false })),
}));
jest.mock('../../services/routeAccountService', () => ({ createLinkedAccount: jest.fn() }));
jest.mock('../../services/payoutEmails', () => ({
  sendPayoutSent: jest.fn(() => Promise.resolve()), sendVerificationNeeded: jest.fn(() => Promise.resolve()),
  sendPayoutFailed: jest.fn(() => Promise.resolve()), sendEarningReversed: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../utils/adminAlert', () => ({ adminAlert: jest.fn(() => Promise.resolve({ sent: true })) }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const razorpayConfig = require('../../services/razorpayConfig');
const platformConfig = require('../../services/platformConfig');
const { isPayoutEligible } = require('../../services/payoutEligibility');
const routeAuto = require('../../services/routeAutoPayoutService');
const routeAccountService = require('../../services/routeAccountService');
const { adminAlert } = require('../../utils/adminAlert');
const { reconcile } = require('../../services/payoutReconciler');

// Read terminals resolve from readQueue in order (activation list, owed list, stuck
// list); any chain that calls .update() resolves as a write ({error:null}).
let readQueue = [];
const makeChain = () => {
  const c = { _write: false };
  for (const m of ['select', 'eq', 'is', 'not', 'lt', 'limit', 'in']) c[m] = jest.fn(() => c);
  c.update = jest.fn(() => { c._write = true; return c; });
  c.maybeSingle = () => Promise.resolve(readQueue.shift() || { data: null });
  c.upsert = jest.fn(() => { c._write = true; return Promise.resolve({ data: null, error: null }); });
  c.then = (resolve) => resolve(c._write ? { data: null, error: null } : (readQueue.shift() || { data: [] }));
  return c;
};

// Reads in order: activation refresh, missing-account sweep, owed scan, stuck scan
// (all kyc_submissions/bookings). Default each to [].
const setReads = ({ activations = [], needAccounts = [], owed = [], stuck = [] } = {}) => {
  readQueue = [{ data: activations }, { data: needAccounts }, { data: owed }, { data: stuck }];
};

beforeEach(() => {
  jest.clearAllMocks();
  readQueue = [];
  reconcile._resetAlertThrottle();
  supabaseAdmin.from.mockImplementation(() => makeChain());
  razorpayConfig.getClient.mockResolvedValue({ transfers: { fetch: jest.fn(), edit: jest.fn() }, products: { fetch: jest.fn() } });
  routeAccountService.createLinkedAccount.mockResolvedValue({ ok: false });
});

const owedBooking = (o = {}) => ({
  id: 'bk1', host_id: 'h1', scheduled_at: new Date().toISOString(), service_id: 'svc1',
  razorpay_payment_id: 'pay_1', vendor_amount: 10, settlement_status: 'eligible_for_settlement',
  transfer_status: null, transfer_attempts: 0, services: { duration: 30 }, ...o,
});

test('mode "off" is a no-op — no queries, no money, no alert', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'off' });
  const r = await reconcile();
  expect(r.skipped).toBe('off');
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
  expect(routeAuto.createHeldTransferForBooking).not.toHaveBeenCalled();
  expect(adminAlert).not.toHaveBeenCalled();
});

test('observe: settlement leg is synced from Razorpay, but no money moves (free-Render backfill path)', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'observe' });
  const fetch = jest.fn(() => Promise.resolve({ id: 'trf_1', status: 'processed', on_hold: false, settlement_status: 'settled', recipient_settlement_id: 'setl_1' }));
  const edit = jest.fn();
  razorpayConfig.getClient.mockResolvedValue({ transfers: { fetch, edit }, products: { fetch: jest.fn() } });
  setReads({ stuck: [{ id: 'bk9', host_id: 'h1', vendor_amount: 10, razorpay_transfer_id: 'trf_1', transfer_status: 'processed', transfer_hold_until: '2000-01-01', settlement_status: 'eligible_for_settlement' }] });

  const r = await reconcile();
  expect(fetch).toHaveBeenCalledWith('trf_1');                                     // read
  expect(routeAuto.applyTransferSettlement).toHaveBeenCalledWith(expect.objectContaining({ id: 'trf_1', settlement_status: 'settled' }));
  expect(edit).not.toHaveBeenCalled();                                            // no hold lifted
  expect(routeAuto.finalizeReleasedTransfer).not.toHaveBeenCalled();              // no ledger / money
  expect(r.released).toBe(0);
  expect(r.finalized).toBe(0);
});

test('observe: an ONBOARDED host stuck at activation is counted + alerted, no transfer created', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'observe' });
  isPayoutEligible.mockResolvedValue({ eligible: false, reasons: ['not_activated'], accountId: 'acc_1' });
  setReads({ owed: [owedBooking()] });
  const r = await reconcile();
  expect(r.owedBlocked).toBe(1);
  expect(r.owedBlockedActionable).toBe(1);
  expect(r.created).toBe(0);
  expect(routeAuto.createHeldTransferForBooking).not.toHaveBeenCalled();
  expect(adminAlert).toHaveBeenCalledWith(expect.objectContaining({ key: 'payout_reconcile_blocked' }));
});

test('a host who has NOT onboarded (no account/KYC) is owed but does NOT trigger an ops alert', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'observe' });
  isPayoutEligible.mockResolvedValue({ eligible: false, reasons: ['kyc_not_approved', 'no_linked_account', 'not_activated'], accountId: null });
  setReads({ owed: [owedBooking()] });
  const r = await reconcile();
  expect(r.owedBlocked).toBe(1);
  expect(r.owedBlockedActionable).toBe(0);
  expect(adminAlert).not.toHaveBeenCalled();
});

test('live: owed money to an ELIGIBLE host creates the held transfer', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'live' });
  isPayoutEligible.mockResolvedValue({ eligible: true, reasons: [] });
  routeAuto.createHeldTransferForBooking.mockResolvedValue({ ok: true, transferId: 'trf_new' });
  setReads({ owed: [owedBooking()] });
  const r = await reconcile();
  expect(r.created).toBe(1);
  expect(routeAuto.createHeldTransferForBooking).toHaveBeenCalledTimes(1);
  expect(adminAlert).not.toHaveBeenCalled();
});

test('a payout below the ₹1 floor is skipped entirely (no eligibility check, no attempt)', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'live' });
  setReads({ owed: [owedBooking({ vendor_amount: 0.5 })] });
  const r = await reconcile();
  expect(r.candidates).toBe(0);
  expect(isPayoutEligible).not.toHaveBeenCalled();
});

test('cancelled / not_eligible bookings are skipped', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'live' });
  setReads({ owed: [owedBooking({ settlement_status: 'cancelled' })] });
  const r = await reconcile();
  expect(r.candidates).toBe(0);
  expect(isPayoutEligible).not.toHaveBeenCalled();
});

test('a retry-capped booking is blocked (not attempted) and alerts', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'live' });
  setReads({ owed: [owedBooking({ transfer_attempts: 5 })] });
  const r = await reconcile();
  expect(r.blocked).toBe(1);
  expect(routeAuto.createHeldTransferForBooking).not.toHaveBeenCalled();
  expect(adminAlert).toHaveBeenCalled();
});

test('eligibility is checked once per host, not once per booking', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'live' });
  isPayoutEligible.mockResolvedValue({ eligible: true, reasons: [] });
  routeAuto.createHeldTransferForBooking.mockResolvedValue({ ok: true, transferId: 'trf' });
  setReads({ owed: [owedBooking({ id: 'bk1' }), owedBooking({ id: 'bk2' })] }); // two bookings, same host h1
  const r = await reconcile();
  expect(r.created).toBe(2);
  expect(isPayoutEligible).toHaveBeenCalledTimes(1);
});

test('live: a matured held transfer is RELEASED and finalized from Razorpay truth', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'live' });
  const fetch = jest.fn().mockResolvedValue({ status: 'processed', on_hold: true });
  const edit = jest.fn().mockResolvedValue({});
  razorpayConfig.getClient.mockResolvedValue({ transfers: { fetch, edit }, products: { fetch: jest.fn() } });
  routeAuto.finalizeReleasedTransfer.mockResolvedValue();
  setReads({ stuck: [{ id: 'bk9', host_id: 'h1', vendor_amount: 10, razorpay_transfer_id: 'trf_9', transfer_status: 'pending', transfer_hold_until: '2000-01-01', settlement_status: 'eligible_for_settlement' }] });
  const r = await reconcile();
  expect(fetch).toHaveBeenCalledWith('trf_9');
  expect(edit).toHaveBeenCalledWith('trf_9', { on_hold: false });
  expect(routeAuto.finalizeReleasedTransfer).toHaveBeenCalledTimes(1);
  expect(r.released).toBe(1);
  expect(r.finalized).toBe(1);
});

test('live: a transfer mis-marked processed while still on_hold is RELEASED, not re-finalized', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'live' });
  const fetch = jest.fn().mockResolvedValue({ status: 'processed', on_hold: true });
  const edit = jest.fn().mockResolvedValue({});
  razorpayConfig.getClient.mockResolvedValue({ transfers: { fetch, edit }, products: { fetch: jest.fn() } });
  setReads({ stuck: [{ id: 'bk9', host_id: 'h1', vendor_amount: 10, razorpay_transfer_id: 'trf_9', transfer_status: 'processed', transfer_hold_until: '2000-01-01', settlement_status: 'eligible_for_settlement' }] });
  const r = await reconcile();
  expect(edit).toHaveBeenCalledWith('trf_9', { on_hold: false });
  expect(r.released).toBe(1);
  expect(routeAuto.finalizeReleasedTransfer).not.toHaveBeenCalled(); // already processed
  expect(r.stuck).toBe(0); // 'processed' is not counted as stuck
});

test('observe does NOT finalize stuck transfers (no money movement)', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'observe' });
  setReads({ stuck: [{ id: 'bk9', razorpay_transfer_id: 'trf_9', transfer_status: 'pending', transfer_hold_until: '2000-01-01', settlement_status: 'eligible_for_settlement' }] });
  const r = await reconcile();
  expect(r.stuck).toBe(1);
  expect(routeAuto.finalizeReleasedTransfer).not.toHaveBeenCalled();
});

test('creates missing linked accounts for approved KYC hosts with no account', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'observe' });
  routeAccountService.createLinkedAccount.mockResolvedValue({ ok: true, accountId: 'acc_new' });
  setReads({ needAccounts: [{ id: 'k1', user_id: 'h1', status: 'approved' }] });
  const r = await reconcile();
  expect(routeAccountService.createLinkedAccount).toHaveBeenCalledTimes(1);
  expect(r.accountsCreated).toBe(1);
});

test('activation refresh flips a needs_clarification account to activated from Razorpay', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'observe' });
  const productFetch = jest.fn().mockResolvedValue({ activation_status: 'activated' });
  razorpayConfig.getClient.mockResolvedValue({ transfers: { fetch: jest.fn() }, products: { fetch: productFetch } });
  setReads({ activations: [{ id: 'k1', razorpay_account_id: 'acc_1', razorpay_product_id: 'prod_1', route_activation_status: 'needs_clarification' }] });
  const r = await reconcile();
  expect(productFetch).toHaveBeenCalledWith('acc_1', 'prod_1');
  expect(r.refreshed).toBe(1);
  expect(r.activated).toBe(1);
});

test('live: a stuck transfer that released on a CANCELLED booking is flagged for clawback, not finalized', async () => {
  platformConfig.getConfig.mockResolvedValue({ payoutReconcilerMode: 'live' });
  const fetch = jest.fn().mockResolvedValue({ status: 'processed', on_hold: false });
  const edit = jest.fn();
  razorpayConfig.getClient.mockResolvedValue({ transfers: { fetch, edit }, products: { fetch: jest.fn() } });
  setReads({ stuck: [{ id: 'bkc', razorpay_transfer_id: 'trf_c', transfer_status: 'pending', transfer_hold_until: '2000-01-01', settlement_status: 'cancelled' }] });
  const r = await reconcile();
  expect(r.clawbackNeeded).toBe(1);
  expect(r.finalized).toBe(0);
  expect(edit).not.toHaveBeenCalled(); // never release a cancelled booking
  expect(routeAuto.finalizeReleasedTransfer).not.toHaveBeenCalled();
  expect(adminAlert).toHaveBeenCalled();
});
