const cache = require('../../services/responseCache');

afterEach(async () => { await cache.clear(); });

describe('responseCache.getOrSet', () => {
  test('runs producer once, then serves cached value within TTL', async () => {
    const producer = jest.fn().mockResolvedValue({ n: 1 });
    const a = await cache.getOrSet('k1', 1000, producer);
    const b = await cache.getOrSet('k1', 1000, producer);
    expect(a).toEqual({ n: 1 });
    expect(b).toBe(a);                    // same cached reference
    expect(producer).toHaveBeenCalledTimes(1);
  });

  test('re-runs producer after TTL expiry', async () => {
    let i = 0;
    const producer = jest.fn(async () => ({ n: ++i }));
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    const a = await cache.getOrSet('k2', 100, producer);
    now.mockReturnValue(1_050);           // within TTL
    const b = await cache.getOrSet('k2', 100, producer);
    now.mockReturnValue(1_200);           // past TTL
    const c = await cache.getOrSet('k2', 100, producer);
    expect(a).toEqual({ n: 1 });
    expect(b).toEqual({ n: 1 });
    expect(c).toEqual({ n: 2 });
    expect(producer).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  test('does NOT cache a throwing producer', async () => {
    const boom = jest.fn().mockRejectedValue(new Error('db down'));
    await expect(cache.getOrSet('k3', 1000, boom)).rejects.toThrow('db down');
    const ok = jest.fn().mockResolvedValue('recovered');
    await expect(cache.getOrSet('k3', 1000, ok)).resolves.toBe('recovered');
    expect(ok).toHaveBeenCalledTimes(1);  // not shadowed by a cached error
  });
});

describe('responseCache.bust', () => {
  test('removes only keys matching the prefix', async () => {
    await cache.getOrSet('hostprofile:jane', 1000, async () => 1);
    await cache.getOrSet('hostprofile:bob', 1000, async () => 2);
    await cache.getOrSet('service:jane/x', 1000, async () => 3);
    const removed = await cache.bust('hostprofile:');
    expect(removed).toBe(2);
    expect(cache._size()).toBe(1);        // only the service: entry remains
  });
});
