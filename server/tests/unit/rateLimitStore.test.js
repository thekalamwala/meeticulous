// Unit tests for the optional Postgres rate-limit store. `pg` is mocked so no
// real DB is touched. Covers the default-off contract and, when enabled, the
// store behaviour + shared pool.

const mockQuery = jest.fn();
const mockPoolInstance = { query: mockQuery, on: jest.fn(), end: jest.fn().mockResolvedValue() };
const MockPool = jest.fn(() => mockPoolInstance);
jest.mock('pg', () => ({ Pool: MockPool }));

const OLD_ENV = process.env;

function loadFresh(env = {}) {
  jest.resetModules();
  process.env = { ...OLD_ENV };
  delete process.env.RATE_LIMIT_STORE_URL;
  Object.assign(process.env, env);
  return require('../../middleware/rateLimitStore');
}

beforeEach(() => {
  mockQuery.mockReset();
  MockPool.mockClear();
  mockPoolInstance.on.mockClear();
});
afterAll(() => { process.env = OLD_ENV; });

describe('makeRateLimitStore — default off', () => {
  test('returns undefined when RATE_LIMIT_STORE_URL is unset (→ in-memory)', () => {
    const { makeRateLimitStore } = loadFresh({ RATE_LIMIT_STORE_URL: '' });
    expect(makeRateLimitStore('auth')).toBeUndefined();
    expect(MockPool).not.toHaveBeenCalled(); // no pool created
  });
});

describe('makeRateLimitStore — enabled', () => {
  const URL = 'postgresql://u:p@host:5432/db';

  test('returns a store and does not open a pool until first query', () => {
    const { makeRateLimitStore } = loadFresh({ RATE_LIMIT_STORE_URL: URL });
    const store = makeRateLimitStore('auth');
    expect(store).toBeDefined();
    expect(typeof store.increment).toBe('function');
    expect(MockPool).not.toHaveBeenCalled(); // lazy
  });

  test('increment runs the atomic upsert and maps the result', async () => {
    const { makeRateLimitStore } = loadFresh({ RATE_LIMIT_STORE_URL: URL });
    const store = makeRateLimitStore('api');
    store.init({ windowMs: 60000 });
    const reset = new Date('2026-06-19T00:01:00Z');
    mockQuery.mockResolvedValueOnce({ rows: [{ hits: 3, expires_at: reset.toISOString() }] });

    const r = await store.increment('1.2.3.4');

    expect(r.totalHits).toBe(3);
    expect(r.resetTime).toEqual(reset);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO rate_limit_hits/);
    expect(sql).toMatch(/ON CONFLICT \(prefix, key\) DO UPDATE/);
    expect(params).toEqual(['api', '1.2.3.4', 60000]);
  });

  test('all limiters share ONE pool', async () => {
    const { makeRateLimitStore } = loadFresh({ RATE_LIMIT_STORE_URL: URL });
    const a = makeRateLimitStore('auth');
    const b = makeRateLimitStore('payment');
    mockQuery.mockResolvedValue({ rows: [{ hits: 1, expires_at: new Date().toISOString() }] });

    await a.increment('k');
    await b.increment('k');

    expect(MockPool).toHaveBeenCalledTimes(1); // single shared pool
  });

  test('resetKey and resetAll issue scoped deletes', async () => {
    const { makeRateLimitStore } = loadFresh({ RATE_LIMIT_STORE_URL: URL });
    const store = makeRateLimitStore('otp');
    mockQuery.mockResolvedValue({ rows: [] });

    await store.resetKey('5.6.7.8');
    expect(mockQuery.mock.calls[0][0]).toMatch(/DELETE FROM rate_limit_hits WHERE prefix = \$1 AND key = \$2/);
    expect(mockQuery.mock.calls[0][1]).toEqual(['otp', '5.6.7.8']);

    await store.resetAll();
    expect(mockQuery.mock.calls[1][0]).toMatch(/DELETE FROM rate_limit_hits WHERE prefix = \$1/);
    expect(mockQuery.mock.calls[1][1]).toEqual(['otp']);
  });

  test('distinct prefixes keep buckets separate', async () => {
    const { makeRateLimitStore } = loadFresh({ RATE_LIMIT_STORE_URL: URL });
    mockQuery.mockResolvedValue({ rows: [{ hits: 1, expires_at: new Date().toISOString() }] });

    await makeRateLimitStore('auth').increment('ip');
    await makeRateLimitStore('admin').increment('ip');

    expect(mockQuery.mock.calls[0][1][0]).toBe('auth');
    expect(mockQuery.mock.calls[1][1][0]).toBe('admin');
  });
});

describe('cleanupExpired', () => {
  test('is a no-op (returns 0, no pool) when the store is off', async () => {
    const { cleanupExpired } = loadFresh({ RATE_LIMIT_STORE_URL: '' });
    expect(await cleanupExpired()).toBe(0);
    expect(MockPool).not.toHaveBeenCalled();
  });

  test('deletes expired rows and returns the count when enabled', async () => {
    const { cleanupExpired } = loadFresh({ RATE_LIMIT_STORE_URL: 'postgresql://u:p@host:5432/db' });
    mockQuery.mockResolvedValueOnce({ rowCount: 7 });

    const n = await cleanupExpired();

    expect(n).toBe(7);
    expect(mockQuery.mock.calls[0][0]).toMatch(/DELETE FROM rate_limit_hits WHERE expires_at < now\(\)/);
  });
});
