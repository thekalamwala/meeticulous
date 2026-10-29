const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
const featureFlags = require('../../services/featureFlags');

const wire = (rows, error = null) =>
  mockFrom.mockImplementation(() => ({ select: jest.fn().mockResolvedValue({ data: rows, error }) }));

beforeEach(() => { jest.clearAllMocks(); featureFlags.clearCache(); });

test('returns the stored enabled value', async () => {
  wire([{ key: 'reschedule', enabled: false }]);
  expect(await featureFlags.isFeatureEnabled('reschedule')).toBe(false);
});

test('fail-open: unknown key defaults to enabled', async () => {
  wire([]);
  expect(await featureFlags.isFeatureEnabled('nope')).toBe(true);
});

test('fail-open: on DB error defaults to enabled', async () => {
  wire(null, { message: 'boom' });
  expect(await featureFlags.isFeatureEnabled('reschedule')).toBe(true);
});

// Security-boundary keys must fail CLOSED — an absent row or a DB read error
// may never silently disable the guard (see FAIL_CLOSED_KEYS in featureFlags).
test('fail-closed: security key unified_login defaults to DISABLED when absent', async () => {
  wire([]);
  expect(await featureFlags.isFeatureEnabled('unified_login')).toBe(false);
});

test('fail-closed: security key unified_login is DISABLED on DB error', async () => {
  wire(null, { message: 'boom' });
  expect(await featureFlags.isFeatureEnabled('unified_login')).toBe(false);
});

test('security key still honors its explicit stored value when present', async () => {
  wire([{ key: 'unified_login', enabled: true }]);
  expect(await featureFlags.isFeatureEnabled('unified_login')).toBe(true);
  featureFlags.clearCache();
  wire([{ key: 'unified_login', enabled: false }]);
  expect(await featureFlags.isFeatureEnabled('unified_login')).toBe(false);
});

test('caches within TTL (one DB read for two calls)', async () => {
  wire([{ key: 'reschedule', enabled: true }]);
  await featureFlags.isFeatureEnabled('reschedule');
  await featureFlags.isFeatureEnabled('reschedule');
  expect(mockFrom).toHaveBeenCalledTimes(1);
});
