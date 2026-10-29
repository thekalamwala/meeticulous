'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(() => Promise.resolve({})) }));

const { supabaseAdmin } = require('../../config/supabase');
const NotificationEngine = require('../../services/notificationEngine');
const payoutEmails = require('../../services/payoutEmails');

// One chain serves both the claim (update→…→maybeSingle) and hostContact (select→…→maybeSingle).
const chain = (result) => {
  const c = {};
  for (const m of ['update', 'eq', 'is', 'select']) c[m] = jest.fn(() => c);
  c.maybeSingle = jest.fn(() => Promise.resolve(result));
  return c;
};

beforeEach(() => jest.clearAllMocks());

test('sendPayoutSent: claims the flag + emails PAYOUT_SENT when it wins', async () => {
  supabaseAdmin.from
    .mockReturnValueOnce(chain({ data: { id: 'bk1' }, error: null }))                      // claim wins
    .mockReturnValueOnce(chain({ data: { name: 'Asha Rao', email: 'a@b.com' }, error: null })); // host contact
  await payoutEmails.sendPayoutSent({ id: 'bk1', host_id: 'h1' }, 500);
  expect(NotificationEngine.send).toHaveBeenCalledWith(expect.objectContaining({
    event: 'PAYOUT_SENT',
    data: expect.objectContaining({
      email: 'a@b.com',
      emailData: expect.objectContaining({ payout_amount: '₹500.00', first_name: 'Asha' }),
    }),
  }));
});

test('sendPayoutSent: does NOT email when the claim is already taken (dedup)', async () => {
  supabaseAdmin.from.mockReturnValueOnce(chain({ data: null, error: null })); // claim lost
  await payoutEmails.sendPayoutSent({ id: 'bk1', host_id: 'h1' }, 500);
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('sendPayoutSent: no-op for a zero/absent amount', async () => {
  await payoutEmails.sendPayoutSent({ id: 'bk1', host_id: 'h1' }, 0);
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('sendPayoutSent: no email if the host has no contact email', async () => {
  supabaseAdmin.from
    .mockReturnValueOnce(chain({ data: { id: 'bk1' }, error: null }))
    .mockReturnValueOnce(chain({ data: null, error: null })); // no host row
  await payoutEmails.sendPayoutSent({ id: 'bk1', host_id: 'h1' }, 500);
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});

test('sendVerificationNeeded: claims + emails PAYOUT_VERIFICATION_NEEDED when it wins', async () => {
  supabaseAdmin.from
    .mockReturnValueOnce(chain({ data: { user_id: 'h1' }, error: null }))
    .mockReturnValueOnce(chain({ data: { name: 'Asha', email: 'a@b.com' }, error: null }));
  await payoutEmails.sendVerificationNeeded('h1');
  expect(NotificationEngine.send).toHaveBeenCalledWith(expect.objectContaining({ event: 'PAYOUT_VERIFICATION_NEEDED' }));
});

test('sendPayoutFailed: claims + emails PAYOUT_FAILED when it wins', async () => {
  supabaseAdmin.from
    .mockReturnValueOnce(chain({ data: { id: 'bk1' }, error: null }))
    .mockReturnValueOnce(chain({ data: { name: 'Asha', email: 'a@b.com' }, error: null }));
  await payoutEmails.sendPayoutFailed({ id: 'bk1', host_id: 'h1', vendor_amount: 300 }, 300);
  expect(NotificationEngine.send).toHaveBeenCalledWith(expect.objectContaining({ event: 'PAYOUT_FAILED' }));
});

test('sendEarningReversed: claims + emails EARNING_REVERSED when it wins', async () => {
  supabaseAdmin.from
    .mockReturnValueOnce(chain({ data: { id: 'bk1' }, error: null }))
    .mockReturnValueOnce(chain({ data: { name: 'Asha', email: 'a@b.com' }, error: null }));
  await payoutEmails.sendEarningReversed({ id: 'bk1', host_id: 'h1', vendor_amount: 300 });
  expect(NotificationEngine.send).toHaveBeenCalledWith(expect.objectContaining({ event: 'EARNING_REVERSED' }));
});

test('sendHolidayDelay: claims + emails PAYOUT_DELAY_HOLIDAY when it wins', async () => {
  supabaseAdmin.from
    .mockReturnValueOnce(chain({ data: { id: 'bk1' }, error: null }))
    .mockReturnValueOnce(chain({ data: { name: 'Asha', email: 'a@b.com' }, error: null }));
  await payoutEmails.sendHolidayDelay({ id: 'bk1', host_id: 'h1', vendor_amount: 500 }, { date: '2026-10-02', name: 'Gandhi Jayanti' }, '2026-10-05');
  expect(NotificationEngine.send).toHaveBeenCalledWith(expect.objectContaining({
    event: 'PAYOUT_DELAY_HOLIDAY',
    data: expect.objectContaining({ emailData: expect.objectContaining({ holiday: 'Gandhi Jayanti' }) }),
  }));
});

test('a claim error (e.g. missing column) → no email, no throw', async () => {
  supabaseAdmin.from.mockReturnValueOnce(chain({ data: null, error: { code: '42703' } }));
  await expect(payoutEmails.sendPayoutSent({ id: 'bk1', host_id: 'h1' }, 500)).resolves.toBeUndefined();
  expect(NotificationEngine.send).not.toHaveBeenCalled();
});
