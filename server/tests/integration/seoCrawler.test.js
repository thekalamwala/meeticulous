// server/tests/integration/seoCrawler.test.js
jest.mock('../../services/seo/seoFetch', () => ({
  fetchUrl: jest.fn(async (url) => ({
    status: 200, finalUrl: url, redirectChain: [], responseMs: 50, contentType: 'text/html',
    headers: {}, body: `<title>${url}</title><h1>${url}</h1><meta name="description" content="${'d'.repeat(150)}">`, error: null,
  })),
}));
jest.mock('../../controllers/prerenderController', () => ({
  resolveProfileMeta: jest.fn(async (username) => ({
    status: 200,
    buildHtmlArgs: { title: `host:${username}`, description: 'd'.repeat(150), canonical: `https://bookasloth.com/${username}`, robots: 'index,follow', jsonLd: { '@type': 'ProfilePage' } },
    payload: { host: { name: 'Jane', username, bio: 'I coach founders on hiring and early team building.' }, services: [] },
  })),
  resolveServiceMeta: jest.fn(async (username, slug) => ({
    status: 200,
    buildHtmlArgs: { title: `service:${username}/${slug}`, description: 'd'.repeat(150), canonical: `https://bookasloth.com/${username}/${slug}`, robots: 'index,follow', jsonLd: { '@type': 'Service' } },
  })),
}));
jest.mock('../../services/seo/seoPersist', () => ({
  createCrawl: jest.fn(async () => 'crawl1'),
  finishCrawl: jest.fn(async () => {}),
  saveResults: jest.fn(async () => {}),
}));
jest.mock('../../services/sitemapService', () => ({
  STATIC_ROUTES: [{ path: '/', changefreq: 'daily', priority: 1 }],
  staticEntries: () => [{ loc: 'https://bookasloth.com/' }],
  hostUrl: (s, u) => `${s}/${u}`, serviceUrl: (s, u, sl) => `${s}/${u}/${sl}`,
  fetchHosts: async () => [{ username: 'jane', updated_at: null }],
  fetchServices: async () => [{ slug: 'intro', profiles: { username: 'jane' } }],
  fetchBlogs: async () => [{ slug: 'post-1' }],
  fetchProfessions: async () => [{ slug: 'life-coach' }],
}));
jest.mock('../../utils/jobLock', () => ({ runLocked: jest.fn((name, fn) => fn()) }));
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));

const { supabaseAdmin } = require('../../config/supabase');
const persist = require('../../services/seo/seoPersist');
const { runLocked } = require('../../utils/jobLock');
const { fetchUrl } = require('../../services/seo/seoFetch');
const { resolveProfileMeta, resolveServiceMeta } = require('../../controllers/prerenderController');
const { run, seedUrls } = require('../../services/seo/seoCrawler');

const selectResolves = (result) => ({ select: jest.fn(() => Promise.resolve(result)) });

describe('seoCrawler', () => {
  beforeEach(() => {
    // Default: no GSC data synced yet — loadGscMap resolves to an empty map.
    supabaseAdmin.from.mockImplementation(() => selectResolves({ data: [], error: null }));
  });

  test('seedUrls includes static, host, service, blog URLs', async () => {
    const urls = await seedUrls();
    const list = urls.map((u) => u.url);
    expect(list).toContain('https://bookasloth.com/'); // homepage keeps its trailing slash (no bare-apex 301)
    expect(list).toContain('https://bookasloth.com/jane');
    expect(list).toContain('https://bookasloth.com/jane/intro');
    expect(list).toContain('https://bookasloth.com/blog/post-1');
    // Professions audit /services/:slug (the published sitemap URL), not /for/:slug.
    expect(list).toContain('https://bookasloth.com/services/life-coach');
    expect(list).toContain('https://bookasloth.com/services'); // hub that links all /services/:slug (de-orphans them)
    expect(list).not.toContain('https://bookasloth.com/for/life-coach');
  });
  test('run() crawls, scores and persists', async () => {
    const id = await run({ trigger: 'manual' });
    expect(id).toBe('crawl1');
    expect(persist.saveResults).toHaveBeenCalledTimes(1);
    const [, pages, issues, scores] = persist.saveResults.mock.calls[0];
    expect(pages.length).toBeGreaterThan(0);
    expect(Array.isArray(issues)).toBe(true);
    expect(scores.overall).toBeLessThanOrEqual(100);
  });

  // Regression: staticEntries' homepage loc AND an explicit add() both resolved to the
  // homepage — seeded twice, doubling titleCounts/descCounts and fabricating duplicate-title
  // issues against the homepage every crawl. Assert it now appears exactly once.
  test('seedUrls seeds the homepage exactly once (no static+explicit dupe)', async () => {
    const urls = await seedUrls();
    const list = urls.map((u) => u.url);
    const homepageHits = list.filter((u) => u === 'https://bookasloth.com' || u === 'https://bookasloth.com/');
    expect(homepageHits.length).toBe(1);
  });

  // Regression: a 200 page with no robots meta defaulted `noindex` to null, and
  // `null === false` is false, so normal pages were persisted indexable:false.
  test('indexable is true for a 200 page with no robots meta', async () => {
    await run({ trigger: 'manual' });
    const calls = persist.saveResults.mock.calls;
    const pages = calls[calls.length - 1][1];
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.every((p) => p.indexable === true)).toBe(true);
  });

  // Regression: runLocked returns undefined (no throw) when a crawl is already in-flight
  // or another instance holds the lease. run()/start() must not leave the row 'running'
  // forever, and must not persist a partial/empty result for the skipped tick.
  test('when the lock is skipped, the crawl is marked skipped and nothing is persisted', async () => {
    const saveResultsCallsBefore = persist.saveResults.mock.calls.length;
    runLocked.mockImplementationOnce(() => undefined);
    const id = await run({ trigger: 'manual' });
    expect(id).toBe('crawl1');
    expect(persist.finishCrawl).toHaveBeenLastCalledWith('crawl1', { status: 'skipped' });
    expect(persist.saveResults.mock.calls.length).toBe(saveResultsCallsBefore);
  });

  // Regression (Finding 1): runIfDue's outer lock in server.js and _execute's inner
  // lock must NOT share a name — same name collides in jobLock's _inFlight guard
  // (inner call sees itself already "in flight" and returns undefined), so the
  // nightly crawl silently skipped every tick. Assert the inner lock uses a distinct
  // name.
  test('_execute uses a lock name distinct from the outer seo-crawl lock', async () => {
    runLocked.mockClear();
    await run({ trigger: 'manual' });
    const names = runLocked.mock.calls.map((call) => call[0]);
    expect(names).toContain('seo-crawl-exec');
    expect(names).not.toContain('seo-crawl');
  });

  // Two-mode fetch: host/service pages get their meta from the in-process
  // prerender resolver (no Cloudflare bot-UA 403 risk); static/blog pages still
  // go through the real HTTP fetch.
  test('host/service pages use the prerender resolver, not seoFetch; static/blog still use seoFetch', async () => {
    fetchUrl.mockClear();
    resolveProfileMeta.mockClear();
    resolveServiceMeta.mockClear();
    await run({ trigger: 'manual' });

    expect(resolveProfileMeta).toHaveBeenCalledWith('jane');
    expect(resolveServiceMeta).toHaveBeenCalledWith('jane', 'intro');

    const fetchedUrls = fetchUrl.mock.calls.map((c) => c[0]);
    expect(fetchedUrls).toContain('https://bookasloth.com/');
    expect(fetchedUrls).toContain('https://bookasloth.com/blog/post-1');
    expect(fetchedUrls).not.toContain('https://bookasloth.com/jane');
    expect(fetchedUrls).not.toContain('https://bookasloth.com/jane/intro');

    const calls = persist.saveResults.mock.calls;
    const pages = calls[calls.length - 1][1];
    const hostPage = pages.find((p) => p.url === 'https://bookasloth.com/jane');
    const servicePage = pages.find((p) => p.url === 'https://bookasloth.com/jane/intro');
    expect(hostPage.title).toBe('host:jane');
    expect(hostPage.httpStatus).toBe(200);
    expect(hostPage.indexable).toBe(true);
    expect(servicePage.title).toBe('service:jane/intro');
    expect(servicePage.httpStatus).toBe(200);
    expect(servicePage.indexable).toBe(true);
  });

  // bodyCrawled flag: resolver-built (host/service) pages are meta shells with no
  // crawled body; fetched (static/blog) pages have real body content.
  test('host/service pages are bodyCrawled:false; static/blog pages are bodyCrawled:true', async () => {
    await run({ trigger: 'manual' });
    const calls = persist.saveResults.mock.calls;
    const pages = calls[calls.length - 1][1];
    const hostPage = pages.find((p) => p.url === 'https://bookasloth.com/jane');
    const servicePage = pages.find((p) => p.url === 'https://bookasloth.com/jane/intro');
    const blogPage = pages.find((p) => p.url === 'https://bookasloth.com/blog/post-1');
    expect(hostPage.bodyCrawled).toBe(false);
    expect(servicePage.bodyCrawled).toBe(false);
    expect(blogPage.bodyCrawled).toBe(true);
  });

  // Host/service word_count comes from the DB content model (not a hardcoded 0), and
  // because the page stays bodyCrawled:false it must not trip the soft-404 rule.
  test('host pages persist the content-model word count without new rule noise', async () => {
    await run({ trigger: 'manual' });
    const calls = persist.saveResults.mock.calls;
    const pages = calls[calls.length - 1][1];
    const issues = calls[calls.length - 1][2];
    const hostPage = pages.find((p) => p.url === 'https://bookasloth.com/jane');
    expect(hostPage.wordCount).toBe(hostPage.contentModel.wordCount);
    expect(hostPage.wordCount).toBeGreaterThan(0);
    const hostRules = issues.filter((i) => i.affectedUrl === hostPage.url).map((i) => i.ruleKey);
    expect(hostRules).not.toContain('indexability.soft_404');
  });

  // GSC integration (chunk 2): buildContext loads seo_gsc_urls → rules/gsc.js
  // turns a coverage anomaly into an issue for that url.
  test('a seo_gsc_urls row for a crawled url produces a gsc.* issue', async () => {
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'seo_gsc_urls') {
        return selectResolves({ data: [{ url: 'https://bookasloth.com/jane', coverage_state: 'Soft 404' }], error: null });
      }
      return selectResolves({ data: [], error: null });
    });
    await run({ trigger: 'manual' });
    const calls = persist.saveResults.mock.calls;
    const issues = calls[calls.length - 1][2];
    const hostIssues = issues.filter((i) => i.affectedUrl === 'https://bookasloth.com/jane');
    expect(hostIssues.map((i) => i.ruleKey)).toContain('gsc.soft_404');
  });

  // Fail-soft: loadGscMap must never crash the crawl (missing table / creds / query error).
  test('a failing seo_gsc_urls query does not crash the crawl (fail-soft, no gsc issues)', async () => {
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'seo_gsc_urls') throw new Error('relation "seo_gsc_urls" does not exist');
      return selectResolves({ data: [], error: null });
    });
    const id = await run({ trigger: 'manual' });
    expect(id).toBe('crawl1');
    const calls = persist.saveResults.mock.calls;
    const issues = calls[calls.length - 1][2];
    expect(issues.some((i) => i.ruleKey.startsWith('gsc.'))).toBe(false);
  });
});
