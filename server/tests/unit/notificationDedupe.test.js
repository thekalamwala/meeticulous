// Guards the dedupe that stops the nudge tracks re-sending every cron tick.
// The bug it replaces queried columns that do not exist (`event`,
// `metadata->>booking_id`, `recipient_user_id`), errored every call, was read as
// "not sent", and re-sent forever. These assert the real columns + fail-closed.

let mockFilters;
let mockResult;

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: () => {
      mockFilters = { eq: {}, gte: null };
      const chain = {
        select: () => chain,
        limit: () => chain,
        eq: (col, val) => { mockFilters.eq[col] = val; return chain; },
        gte: (col, val) => { mockFilters.gte = [col, val]; return chain; },
        then: (res, rej) => Promise.resolve(mockResult).then(res, rej),
      };
      return chain;
    },
  },
}));

const { alreadyNotified } = require('../../utils/notificationDedupe');

beforeEach(() => { mockFilters = undefined; mockResult = { data: [], error: null }; });

test('queries event_key (not the non-existent `event` column)', async () => {
  await alreadyNotified({ event: 'HOST_DORMANT_30D', destination: 'a@x.com', sinceDays: 14 });
  expect(mockFilters.eq).toHaveProperty('event_key', 'HOST_DORMANT_30D');
  expect(mockFilters.eq).not.toHaveProperty('event');
  expect(mockFilters.eq).toHaveProperty('destination', 'a@x.com');
  expect(mockFilters.gte[0]).toBe('created_at');
});

test('per-entity match uses payload->>dedupe_key', async () => {
  await alreadyNotified({ event: 'GUEST_REVIEW_NUDGE', dedupeKey: 'review:bk1' });
  expect(mockFilters.eq).toHaveProperty('payload->>dedupe_key', 'review:bk1');
});

test('true when a matching row exists, false when none', async () => {
  mockResult = { data: [{ id: 1 }], error: null };
  expect(await alreadyNotified({ event: 'E' })).toBe(true);
  mockResult = { data: [], error: null };
  expect(await alreadyNotified({ event: 'E' })).toBe(false);
});

test('FAILS CLOSED: a query error reports already-sent, never a re-send', async () => {
  mockResult = { data: null, error: { message: 'boom' } };
  expect(await alreadyNotified({ event: 'E', destination: 'a@x.com' })).toBe(true);
});

test('no event = already-handled (never sends)', async () => {
  expect(await alreadyNotified({})).toBe(true);
});
