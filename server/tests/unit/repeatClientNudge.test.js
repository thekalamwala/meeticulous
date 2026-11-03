'use strict';
// Repeat-client nudge: a free host's guest books again → one bell about rebook automation.

const mockState = { prior: 0 };
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => {
      const c = {};
      c.select = () => c; c.eq = () => c; c.neq = () => c;
      c.in = () => Promise.resolve({ count: mockState.prior });
      c.maybeSingle = () => Promise.resolve({ data: { plan: 'free' } });
      return c;
    }),
  },
}));
jest.mock('../../utils/inAppNotify', () => ({ inAppNotify: jest.fn() }));

const { inAppNotify } = require('../../utils/inAppNotify');
const { maybeNudgeRepeatClient, DEDUPE_KEY } = require('../../services/repeatClientNudge');

const BOOKING = { id: 'b2', host_id: 'h1', guest_phone: '+919', guest_name: 'Priya Shah' };

beforeEach(() => { jest.clearAllMocks(); mockState.prior = 0; });

test('repeat guest on a free plan → one deduped bell', async () => {
  mockState.prior = 1;
  expect(await maybeNudgeRepeatClient({ host: { plan: 'free' }, booking: BOOKING })).toEqual({ sent: true });
  const call = inAppNotify.mock.calls[0][0];
  expect(call.title).toBe('Priya booked again 🎉');
  expect(call.dedupeKey).toBe(DEDUPE_KEY);
  expect(call.link).toContain('src=repeat_client');
});

test('first visit → nothing', async () => {
  expect(await maybeNudgeRepeatClient({ host: { plan: 'free' }, booking: BOOKING })).toEqual({ sent: false, reason: 'first_visit' });
  expect(inAppNotify).not.toHaveBeenCalled();
});

test('paid host → nothing', async () => {
  mockState.prior = 3;
  expect(await maybeNudgeRepeatClient({ host: { plan: 'premium' }, booking: BOOKING })).toEqual({ sent: false, reason: 'paid_plan' });
});

test('host row without plan → loads it (free) and nudges', async () => {
  mockState.prior = 1;
  expect(await maybeNudgeRepeatClient({ host: { name: 'x' }, booking: BOOKING })).toEqual({ sent: true });
});
