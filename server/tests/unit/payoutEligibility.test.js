'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
const { supabaseAdmin } = require('../../config/supabase');
const { isPayoutEligible } = require('../../services/payoutEligibility');

// kyc_submissions.select(...).eq(...).maybeSingle()
const kycChain = (result) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.eq = jest.fn(() => c);
  c.maybeSingle = () => Promise.resolve(result);
  return c;
};
const mockKyc = (result) => supabaseAdmin.from.mockImplementation(() => kycChain(result));

beforeEach(() => jest.clearAllMocks());

test('eligible when KYC approved + linked account + activated', async () => {
  mockKyc({ data: { status: 'approved', razorpay_account_id: 'acc_1', route_activation_status: 'activated' } });
  const r = await isPayoutEligible('h1');
  expect(r.eligible).toBe(true);
  expect(r.reasons).toEqual([]);
  expect(r.accountId).toBe('acc_1');
});

test('NOT eligible when account exists but activation is needs_clarification', async () => {
  mockKyc({ data: { status: 'approved', razorpay_account_id: 'acc_1', route_activation_status: 'needs_clarification' } });
  const r = await isPayoutEligible('h1');
  expect(r.eligible).toBe(false);
  expect(r.reasons).toContain('not_activated');
});

test('NOT eligible when KYC not approved', async () => {
  mockKyc({ data: { status: 'pending', razorpay_account_id: 'acc_1', route_activation_status: 'activated' } });
  const r = await isPayoutEligible('h1');
  expect(r.eligible).toBe(false);
  expect(r.reasons).toContain('kyc_not_approved');
});

test('NOT eligible when there is no linked account', async () => {
  mockKyc({ data: { status: 'approved', razorpay_account_id: null, route_activation_status: null } });
  const r = await isPayoutEligible('h1');
  expect(r.eligible).toBe(false);
  expect(r.reasons).toEqual(expect.arrayContaining(['no_linked_account', 'not_activated']));
});

test('no KYC row → not eligible with all reasons', async () => {
  mockKyc({ data: null });
  const r = await isPayoutEligible('h1');
  expect(r.eligible).toBe(false);
  expect(r.reasons).toEqual(expect.arrayContaining(['kyc_not_approved', 'no_linked_account', 'not_activated']));
});

test('missing route_activation_status column (v3.97 not applied) → fail-safe not_activated', async () => {
  let call = 0;
  supabaseAdmin.from.mockImplementation(() => {
    call += 1;
    // First select (with activation column) errors 42703; retry select resolves.
    return call === 1
      ? kycChain({ data: null, error: { code: '42703', message: 'column route_activation_status does not exist' } })
      : kycChain({ data: { status: 'approved', razorpay_account_id: 'acc_1' } });
  });
  const r = await isPayoutEligible('h1');
  expect(r.eligible).toBe(false);
  expect(r.reasons).toContain('not_activated');
  expect(r.accountId).toBe('acc_1');
});
