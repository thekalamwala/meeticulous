/**
 * markHalted must send the host a transactional SUBSCRIPTION_HALTED notice
 * (email + in-app) — a failed renewal used to be silent. crmSubEvent is fully
 * try/caught so it can't affect this; we return a null CRM lookup so it no-ops.
 */
'use strict';

const HOST = { id: 'host-1', name: 'Asha Rao', email: 'asha@x.com', plan: 'creator' };

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (table) => {
      if (table === 'profiles') {
        return {
          // markHalted: update(...).eq(...).select(...) → the updated host row
          update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [HOST], error: null }) }) }),
          // crmSubEvent: select('id').eq(...).maybeSingle() → null → it returns early
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) };
    },
  },
}));
jest.mock('../../services/planService', () => ({ normalizeSlug: (s) => s, getPlan: jest.fn() }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn(() => Promise.resolve({})) }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/posthog', () => ({ capture: jest.fn(), resolveGuestId: jest.fn() }));

const { send: notifySend } = require('../../services/notificationEngine');
const svc = require('../../services/subscriptionService');

beforeEach(() => jest.clearAllMocks());

test('markHalted notifies the host — email + in-app SUBSCRIPTION_HALTED', async () => {
  await svc.markHalted({ id: 'sub_x' });

  const call = notifySend.mock.calls.find((c) => c[0].event === 'SUBSCRIPTION_HALTED');
  expect(call).toBeTruthy();
  const { data } = call[0];
  expect(data.recipientUserId).toBe('host-1');   // the right host
  expect(data.email).toBe('asha@x.com');          // email channel
  expect(data.inApp).toBeTruthy();                // in-app channel
  expect(data.inApp.title).toMatch(/renewal/i);
  expect(data.inApp.link).toBe('/dashboard/upgrade');
  expect(data.emailData.plan_name).toBe('creator');
});

test('markHalted with no matching host sends nothing', async () => {
  // Re-mock profiles.update to return an empty row set for this case.
  const { supabaseAdmin } = require('../../config/supabase');
  const spy = jest.spyOn(supabaseAdmin, 'from').mockImplementation((table) => {
    if (table === 'profiles') {
      return {
        update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }),
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
      };
    }
    return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) };
  });
  await svc.markHalted({ id: 'sub_none' });
  expect(notifySend.mock.calls.find((c) => c[0].event === 'SUBSCRIPTION_HALTED')).toBeUndefined();
  spy.mockRestore();
});
