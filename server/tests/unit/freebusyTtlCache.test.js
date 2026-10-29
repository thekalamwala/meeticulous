/**
 * FreeBusy latency cache (perf #4): computeSlots reuses a recent successful
 * FreeBusy fetch (< TTL) instead of hitting Google on every poll, while
 * validateSlot (the booking-time hard check) always fetches live.
 */
process.env.FREEBUSY_CACHE_TTL_MS = '60000';

const mockGetFreeBusy = jest.fn();
jest.mock('../../config/google', () => ({ getFreeBusy: (...a) => mockGetFreeBusy(...a) }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (v) => v }));

const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

const availabilityService = require('../../services/availabilityService');

// Wire supabase: no platform bookings, and a cache row with the given fetched_at.
const wire = ({ cacheFetchedAt }) => {
  mockFrom.mockImplementation((table) => {
    if (table === 'google_freebusy_cache') {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => Promise.resolve({
          data: cacheFetchedAt
            ? { busy: [{ start: '2099-06-01T05:00:00.000Z', end: '2099-06-01T05:30:00.000Z' }], fetched_at: cacheFetchedAt }
            : null,
        }),
        upsert: () => Promise.resolve({ error: null }),
      };
      return chain;
    }
    // bookings (getPlatformBusy) → none
    const chain = {
      select: () => chain, eq: () => chain, neq: () => chain, gte: () => chain,
      lte: () => Promise.resolve({ data: [], error: null }),
    };
    return chain;
  });
};

const ALL_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const availability = {
  timezone: 'Asia/Kolkata',
  weekly_schedule: Object.fromEntries(ALL_DAYS.map((d) => [d, [{ start: '09:00', end: '18:00' }]])),
};
const host = { id: 'h1', google_calendar_connected: true, google_refresh_token: 'r', google_access_token: 'a' };
const service = { id: 's1', duration: 30, grace_period_minutes: 10 };
const NOW = new Date('2099-06-01T00:00:00.000Z'); // far future so slots aren't filtered as past

beforeEach(() => {
  jest.clearAllMocks();
  mockGetFreeBusy.mockResolvedValue([]);
});

test('computeSlots: fresh cache hit skips the live Google fetch', async () => {
  wire({ cacheFetchedAt: new Date().toISOString() }); // fresh
  await availabilityService.computeSlots({ host, service, availability, dateStr: '2099-06-01', now: NOW });
  expect(mockGetFreeBusy).not.toHaveBeenCalled();
});

test('computeSlots: stale cache falls through to a live Google fetch', async () => {
  wire({ cacheFetchedAt: new Date(Date.now() - 5 * 60_000).toISOString() }); // 5 min old > 60s TTL
  await availabilityService.computeSlots({ host, service, availability, dateStr: '2099-06-01', now: NOW });
  expect(mockGetFreeBusy).toHaveBeenCalledTimes(1);
});

test('computeSlots: no cache row falls through to a live Google fetch', async () => {
  wire({ cacheFetchedAt: null });
  await availabilityService.computeSlots({ host, service, availability, dateStr: '2099-06-01', now: NOW });
  expect(mockGetFreeBusy).toHaveBeenCalledTimes(1);
});

test('validateSlot: ignores a fresh cache and always fetches live', async () => {
  wire({ cacheFetchedAt: new Date().toISOString() }); // fresh — would be reused by computeSlots
  await availabilityService.validateSlot({
    host, service, availability, scheduledAtUTC: '2099-06-01T05:00:00.000Z', now: NOW,
  });
  expect(mockGetFreeBusy).toHaveBeenCalledTimes(1);
});
