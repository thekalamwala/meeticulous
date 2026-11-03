/**
 * proTasteNudges — stage selection + one-send-per-stage behaviour.
 */
const mockState = { hosts: [], firstAt: null, sentKeys: new Set(), inserts: [] };
jest.mock('../../config/supabase', () => {
  const from = (table) => {
    const filters = {};
    const q = {
      select: () => q, in: () => q, gte: () => q, not: () => q,
      eq: (k, v) => { filters[k] = v; return q; },
      limit: async () => {
        if (table === 'profiles') return { data: mockState.hosts };
        if (table === 'in_app_notifications') return { data: mockState.sentKeys.has(filters.dedupe_key) ? [{ id: 1 }] : [] };
        return { data: [] };
      },
      insert: async (row) => { mockState.inserts.push(row); mockState.sentKeys.add(row.dedupe_key); return { error: null }; },
      then: (r) => r({ count: 3 }),
    };
    return q;
  };
  return { supabaseAdmin: { from: jest.fn(from) } };
});
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(async () => ({})) }));
jest.mock('../../services/proTaste', () => ({
  ...jest.requireActual('../../services/proTaste'),
  firstBookingAt: jest.fn(async () => mockState.firstAt),
}));
jest.mock('../../services/foundingSpots', () => ({ getFoundingStatus: jest.fn(async () => ({ open: true, left: 27 })) }));

const NotificationEngine = require('../../services/notificationEngine');
const { processProTasteNudges, stageFor } = require('../../services/proTasteNudges');

const DAY = 86400000;
const NOW = Date.parse('2027-03-01T06:00:00Z');

beforeEach(() => {
  mockState.hosts = [{ id: 'h1', name: 'Asha Rao', email: 'a@x.in', phone: '9', plan: 'free' }];
  mockState.sentKeys = new Set();
  mockState.inserts = [];
  NotificationEngine.send.mockClear();
});

test('stageFor maps days to stages', () => {
  expect(stageFor(0)[0]).toBe('started');
  expect(stageFor(44)[0]).toBe('started');
  expect(stageFor(45)[0]).toBe('day45');
  expect(stageFor(57)[0]).toBe('ending');
  expect(stageFor(60)[0]).toBe('ended');
  expect(stageFor(80)).toBeNull();
});

test('ending stage: bell + email/WhatsApp once, then deduped', async () => {
  mockState.firstAt = new Date(NOW - 56 * DAY).toISOString();
  await processProTasteNudges({ now: NOW });
  expect(mockState.inserts).toHaveLength(1);
  expect(mockState.inserts[0].dedupe_key).toBe('pro_taste:ending');
  expect(NotificationEngine.send).toHaveBeenCalledTimes(1);
  const { event, data } = NotificationEngine.send.mock.calls[0][0];
  expect(event).toBe('PRO_TASTE_ENDING');
  expect(data.phone).toBe('9');
  expect(data.emailData.spots_line).toContain('27 of 100');

  await processProTasteNudges({ now: NOW });
  expect(NotificationEngine.send).toHaveBeenCalledTimes(1);
});

test('day45 stage is bell-only; paid and not-yet-booked hosts get nothing', async () => {
  mockState.firstAt = new Date(NOW - 46 * DAY).toISOString();
  await processProTasteNudges({ now: NOW });
  expect(mockState.inserts).toHaveLength(1);
  expect(NotificationEngine.send).not.toHaveBeenCalled();

  mockState.inserts = [];
  mockState.hosts = [{ id: 'h2', plan: 'premium', email: 'p@x.in' }];
  await processProTasteNudges({ now: NOW });
  mockState.hosts = [{ id: 'h3', plan: 'free', email: 'f@x.in' }];
  mockState.firstAt = null;
  await processProTasteNudges({ now: NOW });
  expect(mockState.inserts).toHaveLength(0);
});
