// Exercises the Redis backend of responseCache with an in-memory fake client
// (no live server). The fake honors the exact command shapes the cache uses:
// get / set(k,v,'PX',ttl) / scan(cursor,'MATCH',pat,'COUNT',n) / del(...keys).

const kv = new Map();
const setCalls = [];

const fakeRedis = {
  async get(k) { return kv.has(k) ? kv.get(k) : null; },
  async set(k, v, px, ttl) { setCalls.push({ k, v, px, ttl }); kv.set(k, v); return 'OK'; },
  async scan(cursor, _match, pattern, _count, _n) {
    const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    const keys = [...kv.keys()].filter((k) => re.test(k));
    return ['0', keys];
  },
  async del(...keys) { let n = 0; for (const k of keys) if (kv.delete(k)) n++; return n; },
};

jest.mock('../../services/redisClient', () => ({ getRedis: () => fakeRedis, _reset: () => {} }));

const cache = require('../../services/responseCache');

afterEach(async () => { await cache.clear(); kv.clear(); setCalls.length = 0; });

describe('responseCache (Redis backend)', () => {
  test('caches through Redis: producer runs once, value served from store', async () => {
    const producer = jest.fn().mockResolvedValue({ n: 7 });
    const a = await cache.getOrSet('hostprofile:jane', 1000, producer);
    // let the fire-and-forget SET settle
    await new Promise((r) => setImmediate(r));
    const b = await cache.getOrSet('hostprofile:jane', 1000, producer);
    expect(a).toEqual({ n: 7 });
    expect(b).toEqual({ n: 7 });          // deep-equal (JSON round-trip), not same ref
    expect(producer).toHaveBeenCalledTimes(1);
    expect(setCalls[0]).toMatchObject({ k: 'rc:hostprofile:jane', px: 'PX', ttl: 1000 });
  });

  test('bust removes only matching-prefix keys via SCAN/DEL', async () => {
    await cache.getOrSet('hostprofile:jane', 1000, async () => 1);
    await cache.getOrSet('hostprofile:bob', 1000, async () => 2);
    await cache.getOrSet('service:jane/x', 1000, async () => 3);
    await new Promise((r) => setImmediate(r)); // let SETs settle

    const removed = await cache.bust('hostprofile:');
    expect(removed).toBe(2);
    expect([...kv.keys()]).toEqual(['rc:service:jane/x']);
  });

  test('fail-open: a Redis get error falls back to the producer', async () => {
    const spy = jest.spyOn(fakeRedis, 'get').mockRejectedValueOnce(new Error('down'));
    const value = await cache.getOrSet('hostprofile:x', 1000, async () => ({ ok: true }));
    expect(value).toEqual({ ok: true });
    spy.mockRestore();
  });
});
