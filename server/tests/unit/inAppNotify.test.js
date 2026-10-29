// Unit test for inAppNotify — the dedupe / race / schema-fallback logic that the
// booking/kyc/onboarding paths now depend on. Existing suites pass THROUGH this
// code but don't assert its branches; this pins them.

let mockExisting;      // dedupe pre-check result: { id } | null
let mockInsertErrors;  // shifted once per insert() call ({ code|message } | undefined)
let mockInserted;      // captured insert rows
let mockUpdatePatch;   // last update() payload (resolveInApp)
let mockUpdateResult;  // rows returned by update().…​.select()
let mockUpdateError;   // error for update().…​.select()
let mockBgPromise;     // promise returned by the backgrounded fn
const mockBroadcast = jest.fn();

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq() { return this; },
        limit() { return this; },
        maybeSingle: async () => ({ data: mockExisting }),
      }),
      insert: (row) => {
        mockInserted.push(row);
        return Promise.resolve({ error: mockInsertErrors.shift() || null });
      },
      update: (patch) => {
        mockUpdatePatch = patch;
        const c = {};
        c.eq = () => c;
        c.is = () => c;
        c.select = () => Promise.resolve({ data: mockUpdateResult, error: mockUpdateError });
        c.then = (res) => res({ data: mockUpdateResult, error: mockUpdateError }); // awaited fallback path
        return c;
      },
    }),
  },
}));

// Run the "background" task inline so the test can await it.
jest.mock('../../utils/background', () => ({
  runInBackground: (_label, fn) => { mockBgPromise = fn(); },
}));

jest.mock('../../utils/realtimeBroadcast', () => ({
  broadcastTopic: (...args) => mockBroadcast(...args),
}));

const { inAppNotify, resolveInApp } = require('../../utils/inAppNotify');

const flush = async () => { if (mockBgPromise) await mockBgPromise; };

beforeEach(() => {
  mockExisting = null;
  mockInsertErrors = [];
  mockInserted = [];
  mockUpdatePatch = null;
  mockUpdateResult = [];
  mockUpdateError = null;
  mockBgPromise = null;
  mockBroadcast.mockClear();
});

test('no-ops (no background work) when required fields are missing', () => {
  inAppNotify({ userId: 'u1' }); // no type/title
  expect(mockBgPromise).toBeNull();
  expect(mockInserted).toHaveLength(0);
});

test('inserts and broadcasts when there is no dedupe match', async () => {
  inAppNotify({ userId: 'u1', role: 'host', type: 'X', title: 'T', dedupeKey: 'k1' });
  await flush();
  expect(mockInserted).toHaveLength(1);
  expect(mockInserted[0].dedupe_key).toBe('k1');
  expect(mockBroadcast).toHaveBeenCalledTimes(1);
});

test('skips the insert when a row with the same (user, dedupe_key) exists', async () => {
  mockExisting = { id: 'n1' };
  inAppNotify({ userId: 'u1', type: 'X', title: 'T', dedupeKey: 'k1' });
  await flush();
  expect(mockInserted).toHaveLength(0);
  expect(mockBroadcast).not.toHaveBeenCalled();
});

test('treats a 23505 unique-race as a benign no-op (no broadcast)', async () => {
  mockInsertErrors = [{ code: '23505', message: 'duplicate key value' }];
  inAppNotify({ userId: 'u1', type: 'X', title: 'T', dedupeKey: 'k1' });
  await flush();
  expect(mockInserted).toHaveLength(1);
  expect(mockBroadcast).not.toHaveBeenCalled();
});

test('schema fallback: retries without dedupe_key when the column is missing', async () => {
  mockInsertErrors = [{ message: 'column in_app_notifications.dedupe_key does not exist' }, null];
  inAppNotify({ userId: 'u1', type: 'X', title: 'T', dedupeKey: 'k1' });
  await flush();
  expect(mockInserted).toHaveLength(2);
  expect(mockInserted[0].dedupe_key).toBe('k1');        // first attempt carries the key
  expect('dedupe_key' in mockInserted[1]).toBe(false);  // retry drops it
  expect(mockBroadcast).toHaveBeenCalledTimes(1);       // still delivered
});

// ── resolveInApp ──────────────────────────────────────────────────────────────

test('resolveInApp no-ops without a match key', () => {
  resolveInApp({ userId: 'u1' }); // neither type nor dedupeKey
  expect(mockBgPromise).toBeNull();
});

test('resolveInApp marks the matching notice read + resolved and pings the bell', async () => {
  mockUpdateResult = [{ id: 'n1' }];
  resolveInApp({ userId: 'u1', type: 'KYC_REJECTED' });
  await flush();
  expect(mockUpdatePatch.read_at).toBeTruthy();
  expect(mockUpdatePatch.resolved_at).toBeTruthy();
  expect(mockBroadcast).toHaveBeenCalledWith(expect.any(String), 'notification', { resolved: true, type: 'KYC_REJECTED' });
});

test('resolveInApp with nothing to resolve does not ping', async () => {
  mockUpdateResult = []; // no matching unresolved rows
  resolveInApp({ userId: 'u1', type: 'KYC_REJECTED' });
  await flush();
  expect(mockBroadcast).not.toHaveBeenCalled();
});
