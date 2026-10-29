'use strict';
/**
 * routeAccountService — Razorpay Route onboarding (account → stakeholder →
 * product → settlement).
 *
 * Guarantees under test (from the service header):
 *   • DORMANT while fee_only_mode is true (the safe default) — no Razorpay call.
 *   • Resumable + idempotent — a fully-onboarded row is a no-op; a partial row
 *     resumes from the first incomplete step.
 *   • Never throws — a Razorpay failure returns { ok:false } and marks route_status
 *     'error' without bubbling up (KYC approval must never roll back).
 *   • PAN / account number are decrypted into the payloads (real AES round-trip,
 *     kycCrypto not mocked).
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/razorpayConfig', () => ({
  isConfigured: jest.fn(() => Promise.resolve(true)),
  getClient: jest.fn(),
}));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const razorpayConfig = require('../../services/razorpayConfig');
const platformConfig = require('../../services/platformConfig');
const { encrypt } = require('../../utils/kycCrypto');
const svc = require('../../services/routeAccountService');

const USER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';

// Collect every update() patch so tests can assert across the multi-step chain.
let updates;
const merged = () => Object.assign({}, ...updates);
const wireUpdateChain = ({ error = null } = {}) => {
  updates = [];
  supabaseAdmin.from.mockImplementation(() => {
    const c = {};
    c.update = jest.fn((patch) => { updates.push(patch); return c; });
    c.eq = jest.fn(() => Promise.resolve({ error }));
    return c;
  });
};

// Full Route client — every onboarding step resolves with an id.
const fullClient = () => ({
  accounts: { create: jest.fn(() => Promise.resolve({ id: 'acc_NEW' })) },
  stakeholders: { create: jest.fn(() => Promise.resolve({ id: 'sth_NEW' })) },
  products: {
    requestProductConfiguration: jest.fn(() => Promise.resolve({ id: 'acc_prd_NEW', activation_status: 'needs_clarification' })),
    edit: jest.fn(() => Promise.resolve({ id: 'acc_prd_NEW', activation_status: 'needs_clarification' })),
  },
});

const approvedKyc = (over = {}) => ({
  id: 'kyc-1',
  user_id: USER,
  status: 'approved',
  full_name: 'Asha Rao',
  email: 'asha@example.com',
  phone: '9876543210',
  pan_number: encrypt('ABCPE1234F'),
  holder_name: 'Asha Rao',
  bank_name: 'HDFC',
  account_number: encrypt('1234567890'),
  ifsc: 'HDFC0000317',
  addr_street1: '1 Test Street',
  addr_street2: 'Andheri East',
  addr_city: 'Mumbai',
  addr_state: 'Maharashtra',
  addr_postal_code: '400069',
  addr_country: 'IN',
  razorpay_account_id: null,
  razorpay_stakeholder_id: null,
  razorpay_product_id: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  platformConfig.getConfig.mockResolvedValue({ feeOnlyMode: false });
  wireUpdateChain();
});

describe('createLinkedAccount gating', () => {
  test('no-ops while fee_only_mode is true — never calls Razorpay', async () => {
    platformConfig.getConfig.mockResolvedValue({ feeOnlyMode: true });
    const res = await svc.createLinkedAccount(approvedKyc());
    expect(res).toEqual({ ok: false, skipped: 'fee_only_mode' });
    expect(razorpayConfig.getClient).not.toHaveBeenCalled();
  });

  test('skips a non-approved submission', async () => {
    const res = await svc.createLinkedAccount(approvedKyc({ status: 'pending' }));
    expect(res.skipped).toBe('not_approved');
    expect(razorpayConfig.getClient).not.toHaveBeenCalled();
  });

  test('is a no-op when already fully onboarded', async () => {
    const res = await svc.createLinkedAccount(approvedKyc({
      razorpay_account_id: 'acc_x', razorpay_stakeholder_id: 'sth_x', razorpay_product_id: 'acc_prd_x',
    }));
    expect(res).toMatchObject({ ok: true, skipped: 'already_onboarded', accountId: 'acc_x' });
    expect(razorpayConfig.getClient).not.toHaveBeenCalled();
  });
});

describe('createLinkedAccount full chain', () => {
  test('creates account + stakeholder + product and sets settlement bank', async () => {
    const client = fullClient();
    razorpayConfig.getClient.mockResolvedValue(client);

    const res = await svc.createLinkedAccount(approvedKyc());
    expect(res).toEqual({ ok: true, accountId: 'acc_NEW', stakeholderId: 'sth_NEW', productId: 'acc_prd_NEW' });

    // 1) account: compact reference_id, no legal_info, registered address.
    const acctPayload = client.accounts.create.mock.calls[0][0];
    expect(acctPayload.reference_id.length).toBeLessThanOrEqual(20);
    expect(acctPayload.legal_info).toBeUndefined();
    expect(acctPayload.profile.addresses.registered).toMatchObject({ city: 'Mumbai', postal_code: '400069' });

    // 2) stakeholder carries the decrypted individual PAN.
    const [acctIdArg, shPayload] = client.stakeholders.create.mock.calls[0];
    expect(acctIdArg).toBe('acc_NEW');
    expect(shPayload.kyc.pan).toBe('ABCPE1234F');

    // 3) product requested for 'route'.
    expect(client.products.requestProductConfiguration.mock.calls[0][1]).toMatchObject({ product_name: 'route', tnc_accepted: true });

    // 4) settlement uses the decrypted bank account.
    const [, prodIdArg, editBody] = client.products.edit.mock.calls[0];
    expect(prodIdArg).toBe('acc_prd_NEW');
    expect(editBody.settlements).toEqual({ account_number: '1234567890', ifsc_code: 'HDFC0000317', beneficiary_name: 'Asha Rao' });

    // Persisted ids across the chain.
    const state = merged();
    expect(state).toMatchObject({
      razorpay_account_id: 'acc_NEW', razorpay_stakeholder_id: 'sth_NEW',
      razorpay_product_id: 'acc_prd_NEW', route_activation_status: 'needs_clarification',
    });
  });

  test('resumes — account exists, only stakeholder/product/settlement run', async () => {
    const client = fullClient();
    razorpayConfig.getClient.mockResolvedValue(client);

    const res = await svc.createLinkedAccount(approvedKyc({ razorpay_account_id: 'acc_OLD' }));
    expect(res).toMatchObject({ ok: true, accountId: 'acc_OLD', stakeholderId: 'sth_NEW', productId: 'acc_prd_NEW' });
    expect(client.accounts.create).not.toHaveBeenCalled();
    expect(client.stakeholders.create).toHaveBeenCalledWith('acc_OLD', expect.any(Object));
  });

  test('skips (no Razorpay call) when the KYC row has no registered address', async () => {
    const client = fullClient();
    razorpayConfig.getClient.mockResolvedValue(client);
    const res = await svc.createLinkedAccount(approvedKyc({ addr_street1: '', addr_city: '' }));
    expect(res).toEqual({ ok: false, skipped: 'missing_address' });
    expect(client.accounts.create).not.toHaveBeenCalled();
  });
});

describe('createLinkedAccount failure handling', () => {
  test('a Razorpay error is swallowed and recorded as route_status error', async () => {
    const client = fullClient();
    client.accounts.create.mockRejectedValue({ error: { description: 'address invalid' } });
    razorpayConfig.getClient.mockResolvedValue(client);

    const res = await svc.createLinkedAccount(approvedKyc());
    expect(res).toEqual({ ok: false, error: 'address invalid' });
    expect(merged()).toMatchObject({ route_status: 'error', route_error: 'address invalid' });
  });

  test('missing Route columns degrade to a no-op, still no throw', async () => {
    wireUpdateChain({ error: { code: '42703', message: 'column "razorpay_stakeholder_id" does not exist' } });
    razorpayConfig.getClient.mockResolvedValue(fullClient());

    const res = await svc.createLinkedAccount(approvedKyc());
    expect(res).toMatchObject({ ok: true, accountId: 'acc_NEW' });
  });
});

describe('buildAccountPayload street2 fallback', () => {
  test('blank street2 falls back to street1 so Razorpay never 400s', () => {
    const p = svc.buildAccountPayload(approvedKyc({ addr_street2: '' }));
    expect(p.profile.addresses.registered.street2).toBe('1 Test Street');
  });

  test('a real street2 is preserved', () => {
    const p = svc.buildAccountPayload(approvedKyc());
    expect(p.profile.addresses.registered.street2).toBe('Andheri East');
  });
});
