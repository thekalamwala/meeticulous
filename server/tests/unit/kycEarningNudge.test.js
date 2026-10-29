'use strict';
// Deferred-KYC nudge: fire once when a host first earns and isn't payout-ready.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/inAppNotify', () => ({ inAppNotify: jest.fn() }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue({ ok: true }) }));

const { supabaseAdmin } = require('../../config/supabase');
const { inAppNotify } = require('../../utils/inAppNotify');
const NotificationEngine = require('../../services/notificationEngine');
const { maybeSendFirstEarningKycNudge } = require('../../services/kycEarningNudge');

const HOST = { id: 'h1', email: 'host@example.com', name: 'Asha Rao' };
const PAID = { id: 'b1', vendor_amount: 500 };

// Wire from('kyc_submissions') and from('in_app_notifications') reads.
function wire({ kyc = null, existingNudge = null }) {
  supabaseAdmin.from.mockImplementation((table) => {
    const row = table === 'kyc_submissions' ? kyc : existingNudge;
    const c = {};
    c.select = jest.fn(() => c);
    c.eq = jest.fn(() => c);
    c.limit = jest.fn(() => c);
    c.maybeSingle = jest.fn(() => Promise.resolve({ data: row, error: null }));
    return c;
  });
}

beforeEach(() => jest.clearAllMocks());

test('sends email + in-app the first time a host earns without KYC', async () => {
  wire({ kyc: null, existingNudge: null });
  const r = await maybeSendFirstEarningKycNudge({ host: HOST, booking: PAID });
  expect(r).toEqual({ sent: true });
  expect(inAppNotify).toHaveBeenCalledTimes(1);
  expect(inAppNotify.mock.calls[0][0]).toMatchObject({ userId: 'h1', role: 'host', type: 'KYC_EARN_NUDGE' });
  expect(NotificationEngine.send).toHaveBeenCalledTimes(1);
  const sent = NotificationEngine.send.mock.calls[0][0];
  expect(sent.event).toBe('KYC_EARN_NUDGE');
  expect(sent.data.email).toBe('host@example.com');
  expect(sent.data.emailData).toMatchObject({ earned_amount: '₹500' });
});

test('skips a free (₹0) booking — nothing earned', async () => {
  wire({});
  const r = await maybeSendFirstEarningKycNudge({ host: HOST, booking: { id: 'b0', vendor_amount: 0 } });
  expect(r).toEqual({ sent: false, reason: 'free_booking' });
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('skips a payout-ready host (approved / has Route account)', async () => {
  wire({ kyc: { status: 'approved', razorpay_account_id: 'acc_x' } });
  const r = await maybeSendFirstEarningKycNudge({ host: HOST, booking: PAID });
  expect(r).toEqual({ sent: false, reason: 'payout_ready' });
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('dedups — a host already nudged is not nudged again', async () => {
  wire({ kyc: null, existingNudge: { id: 'n1' } });
  const r = await maybeSendFirstEarningKycNudge({ host: HOST, booking: PAID });
  expect(r).toEqual({ sent: false, reason: 'already_nudged' });
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('never throws — a send error resolves to reason:error', async () => {
  wire({ kyc: null, existingNudge: null });
  NotificationEngine.send.mockRejectedValueOnce(new Error('provider down'));
  const r = await maybeSendFirstEarningKycNudge({ host: HOST, booking: PAID });
  expect(r).toEqual({ sent: false, reason: 'error' });
});
