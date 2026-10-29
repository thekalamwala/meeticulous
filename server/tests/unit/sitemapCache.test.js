const { createSitemapCache } = require('../../utils/sitemapCache');

describe('createSitemapCache', () => {
  test('returns undefined for a missing key', () => {
    const cache = createSitemapCache({ ttlMs: 1000, now: () => 0 });
    expect(cache.get('x')).toBeUndefined();
  });

  test('returns a stored value within the TTL window', () => {
    let t = 0;
    const cache = createSitemapCache({ ttlMs: 1000, now: () => t });
    cache.set('x', '<xml/>');
    t = 999;
    expect(cache.get('x')).toBe('<xml/>');
  });

  test('expires a value once the TTL elapses', () => {
    let t = 0;
    const cache = createSitemapCache({ ttlMs: 1000, now: () => t });
    cache.set('x', '<xml/>');
    t = 1001;
    expect(cache.get('x')).toBeUndefined();
  });

  test('bust() drops every entry (a mutation invalidates the whole sitemap)', () => {
    const cache = createSitemapCache({ ttlMs: 1000, now: () => 0 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.bust();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });

  test('a falsy-but-valid cached value (empty string) is still a hit', () => {
    const cache = createSitemapCache({ ttlMs: 1000, now: () => 0 });
    cache.set('x', '');
    expect(cache.get('x')).toBe('');
    expect(cache.has('x')).toBe(true);
  });
});
