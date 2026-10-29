// supabase config throws without a service_role key; this suite exercises the
// pure URL/entry mappers plus fetchProfessions (its .from is stubbed per test).
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));

const { supabaseAdmin } = require('../../config/supabase');
const {
  toLastmod, hostUrl, serviceUrl, staticEntries, hostEntries, serviceEntries, professionEntries, blogEntries,
  fetchProfessions, fetchBlogs,
} = require('../../services/sitemapService');

const SITE = 'https://bookasloth.com';

describe('url builders', () => {
  test('hostUrl joins site + username', () => {
    expect(hostUrl(SITE, 'john-doe')).toBe('https://bookasloth.com/john-doe');
  });
  test('serviceUrl joins site + username + slug', () => {
    expect(serviceUrl(SITE, 'john-doe', 'business-consultation'))
      .toBe('https://bookasloth.com/john-doe/business-consultation');
  });
  test('trailing slash on site is normalised away', () => {
    expect(hostUrl('https://bookasloth.com/', 'jane')).toBe('https://bookasloth.com/jane');
  });
});

describe('toLastmod', () => {
  test('returns the YYYY-MM-DD date portion of an ISO timestamp', () => {
    expect(toLastmod('2026-06-20T14:33:00.000Z')).toBe('2026-06-20');
  });
  test('returns undefined for missing/invalid input', () => {
    expect(toLastmod(null)).toBeUndefined();
    expect(toLastmod('not-a-date')).toBeUndefined();
  });
});

describe('staticEntries', () => {
  test('includes the homepage as an absolute URL', () => {
    const entries = staticEntries(SITE);
    expect(entries.some(e => e.loc === 'https://bookasloth.com/')).toBe(true);
  });
  test('every entry is an absolute URL under the site', () => {
    for (const e of staticEntries(SITE)) {
      expect(e.loc.startsWith('https://bookasloth.com/')).toBe(true);
    }
  });
  test('includes the marketing clusters (LPs, features, help docs, wall of love)', () => {
    const locs = new Set(staticEntries(SITE).map((e) => e.loc));
    for (const path of [
      '/compare/setmore-alternative', '/compare/acuity-alternative', '/compare/simplybook-alternative',
      '/compare/zoho-bookings-alternative', '/features/payments', '/features/online-scheduling',
      '/help/docs', '/help/docs/what-is-book-a-sloth', '/wall-of-love',
      '/careers/mern-stack-developer',
    ]) {
      expect(locs.has(`https://bookasloth.com${path}`)).toBe(true);
    }
  });
});

describe('hostEntries', () => {
  test('maps a host row to a profile URL with lastmod', () => {
    const entries = hostEntries([{ username: 'john-doe', updated_at: '2026-06-20T10:00:00Z' }], SITE);
    expect(entries).toEqual([
      { loc: 'https://bookasloth.com/john-doe', lastmod: '2026-06-20', changefreq: 'weekly', priority: '0.7' },
    ]);
  });
  test('skips rows with no username', () => {
    expect(hostEntries([{ username: null, updated_at: '2026-06-20T10:00:00Z' }], SITE)).toEqual([]);
  });
});

describe('serviceEntries', () => {
  const rows = [
    { slug: 'consult', updated_at: '2026-06-20T10:00:00Z', profiles: { username: 'john-doe' } },
    { slug: 'no-host', updated_at: '2026-06-20T10:00:00Z', profiles: { username: null } }, // unresolvable
    { slug: null, updated_at: '2026-06-20T10:00:00Z', profiles: { username: 'john-doe' } }, // no slug
  ];
  test('maps a service to /username/slug and skips unresolvable rows', () => {
    expect(serviceEntries(rows, SITE)).toEqual([
      { loc: 'https://bookasloth.com/john-doe/consult', lastmod: '2026-06-20', changefreq: 'weekly', priority: '0.8' },
    ]);
  });
});

describe('professionEntries', () => {
  test('leads with the /services root entry (no lastmod)', () => {
    const entries = professionEntries([], SITE);
    expect(entries).toEqual([
      { loc: 'https://bookasloth.com/services', changefreq: 'weekly', priority: '0.6' },
    ]);
  });
  test('adds one URL per profession row with lastmod', () => {
    const rows = [
      { slug: 'therapy', updated_at: '2026-06-20T10:00:00Z' },
      { slug: 'coaching', updated_at: '2026-06-15T10:00:00Z' },
    ];
    expect(professionEntries(rows, SITE)).toEqual([
      { loc: 'https://bookasloth.com/services', changefreq: 'weekly', priority: '0.6' },
      { loc: 'https://bookasloth.com/services/therapy', lastmod: '2026-06-20', changefreq: 'weekly', priority: '0.6' },
      { loc: 'https://bookasloth.com/services/coaching', lastmod: '2026-06-15', changefreq: 'weekly', priority: '0.6' },
    ]);
  });
});

describe('blogEntries', () => {
  test('maps published posts to /blog/:slug', () => {
    const rows = [
      { slug: 'zero-commission-bet', published_at: '2026-06-25T10:00:00Z', updated_at: '2026-06-28T10:00:00Z' },
    ];
    expect(blogEntries(rows, SITE)).toEqual([
      { loc: 'https://bookasloth.com/blog/zero-commission-bet', lastmod: '2026-06-28', changefreq: 'monthly', priority: '0.6' },
    ]);
  });

  test('falls back to published_at when a post has never been edited', () => {
    const rows = [{ slug: 'hello-world', published_at: '2026-04-30T10:00:00Z', updated_at: null }];
    expect(blogEntries(rows, SITE)[0].lastmod).toBe('2026-04-30');
  });

  test('drops rows with no slug rather than emitting /blog/undefined', () => {
    expect(blogEntries([{ slug: null }, undefined], SITE)).toEqual([]);
    expect(blogEntries([], SITE)).toEqual([]);
    expect(blogEntries(null, SITE)).toEqual([]);
  });
});

describe('fetchBlogs', () => {
  // Mirrors blogController's public read: status + future-date gate, so the
  // sitemap never lists a scheduled post the API still 404s.
  const chain = (resolved) => {
    const obj = {};
    ['select', 'eq', 'lte', 'not', 'order'].forEach((m) => { obj[m] = jest.fn().mockReturnValue(obj); });
    obj.then = (resolve, reject) => Promise.resolve(resolved).then(resolve, reject);
    return obj;
  };

  test('filters to published, gates future dates, and returns rows', async () => {
    const c = chain({ data: [{ slug: 'a', published_at: '2026-07-01T00:00:00Z', updated_at: null }], error: null });
    supabaseAdmin.from.mockReturnValue(c);
    await expect(fetchBlogs()).resolves.toEqual([{ slug: 'a', published_at: '2026-07-01T00:00:00Z', updated_at: null }]);
    expect(supabaseAdmin.from).toHaveBeenCalledWith('blogs');
    expect(c.eq).toHaveBeenCalledWith('status', 'published');
    expect(c.lte).toHaveBeenCalledWith('published_at', expect.any(String));
  });

  test('propagates a query error instead of silently emitting an empty sitemap', async () => {
    supabaseAdmin.from.mockReturnValue(chain({ data: null, error: { message: 'boom' } }));
    await expect(fetchBlogs()).rejects.toBeDefined();
  });
});

describe('fetchProfessions', () => {
  // Awaitable fluent chain: .select()/.eq() return `this`; awaiting resolves `resolved`.
  const awaitable = (resolved) => {
    const obj = {};
    ['select', 'eq'].forEach((m) => { obj[m] = jest.fn().mockReturnValue(obj); });
    obj.then = (resolve, reject) => Promise.resolve(resolved).then(resolve, reject);
    return obj;
  };

  test('excludes professions whose categories row is not active (directory 404s them)', async () => {
    supabaseAdmin.from.mockImplementation((table) =>
      table === 'service_categories'
        ? awaitable({
            data: [
              { primary_category: 'therapy', updated_at: '2026-06-20T10:00:00Z' },
              // profession disabled in `categories` → its rows must be dropped
              { primary_category: 'astrology', updated_at: '2026-06-21T10:00:00Z' },
            ],
            error: null,
          })
        : awaitable({ data: [{ slug: 'therapy' }], error: null })
    );

    const rows = await fetchProfessions();

    expect(rows).toEqual([{ slug: 'therapy', updated_at: '2026-06-20T10:00:00Z' }]);
  });
});
