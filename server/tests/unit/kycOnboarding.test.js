'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/inAppNotify', () => ({ inAppNotify: jest.fn(), resolveInApp: jest.fn() }));
jest.mock('../../services/routeAccountService', () => ({ createLinkedAccount: jest.fn(() => Promise.resolve({ ok: true })) }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const NotificationEngine = require('../../services/notificationEngine');
const { inAppNotify } = require('../../utils/inAppNotify');
const routeAccountService = require('../../services/routeAccountService');
const platformConfig = require('../../services/platformConfig');
const { isAutopilot, onKycApproved } = require('../../services/kycOnboarding');

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => jest.clearAllMocks());

test('isAutopilot reflects the platform flag', async () => {
  platformConfig.getConfig.mockResolvedValue({ routeAutopilot: true });
  expect(await isAutopilot()).toBe(true);
  platformConfig.getConfig.mockResolvedValue({ routeAutopilot: false });
  expect(await isAutopilot()).toBe(false);
});

test('isAutopilot fails safe to false on error', async () => {
  platformConfig.getConfig.mockRejectedValue(new Error('db down'));
  expect(await isAutopilot()).toBe(false);
});

test('onKycApproved notifies the host and creates the linked account', async () => {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    update: jest.fn(() => chain),                              // leads.verified_at stamp
    is: jest.fn(() => Promise.resolve({ error: null })),       // …resolves the update
    maybeSingle: jest.fn(() => Promise.resolve({ data: { id: 'k1', user_id: 'h1' } })),
  };
  supabaseAdmin.from.mockReturnValue(chain);

  onKycApproved({ userId: 'h1', email: 'a@b.com', fullName: 'Asha Rao' });
  await flush();

  expect(NotificationEngine.send).toHaveBeenCalledWith(expect.objectContaining({ event: 'KYC_APPROVED' }));
  expect(inAppNotify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'h1', type: 'KYC_APPROVED' }));
  expect(routeAccountService.createLinkedAccount).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'h1' }));
});

test('onKycApproved no-ops without a userId', () => {
  onKycApproved({});
  expect(NotificationEngine.send).not.toHaveBeenCalled();
  expect(routeAccountService.createLinkedAccount).not.toHaveBeenCalled();
});
