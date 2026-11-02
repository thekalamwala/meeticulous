// server/tests/unit/seoAdminController.test.js
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: jest.fn((res, err) => res.status(500).json({ message: err?.message })) }));
jest.mock('../../services/seo/seoCrawler', () => ({ start: jest.fn(async () => 'crawlX') }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));
jest.mock('../../services/seo/gscClient', () => ({ isConfigured: jest.fn(() => true) }));
jest.mock('../../services/seo/gscSync', () => ({ run: jest.fn(() => Promise.resolve({ upserted: 0 })) }));

const { supabaseAdmin } = require('../../config/supabase');
const crawler = require('../../services/seo/seoCrawler');
const gscClient = require('../../services/seo/gscClient');
const gscSync = require('../../services/seo/gscSync');
const ctrl = require('../../controllers/seoAdminController');

const makeQuery = (result) => {
  const q = {}; ['select', 'eq', 'order', 'limit', 'range', 'single', 'insert', 'maybeSingle'].forEach((m) => (q[m] = jest.fn(() => q)));
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return q;
};
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('getOverview returns the latest crawl + scores', async () => {
  supabaseAdmin.from.mockImplementation((t) => {
    if (t === 'seo_crawls') return makeQuery({ data: [{ id: 'c1', status: 'done', page_count: 5, issue_count: 3 }], error: null });
    if (t === 'seo_score_snapshots') return makeQuery({ data: [{ overall: 88 }], error: null });
    if (t === 'seo_issues') return makeQuery({ data: [{ severity: 'P0' }], error: null });
    return makeQuery({ data: [], error: null });
  });
  const r = res();
  await ctrl.getOverview({ query: {} }, r);
  expect(r.json).toHaveBeenCalled();
  expect(r.json.mock.calls[0][0].crawl.id).toBe('c1');
});

test('postCrawl kicks off a crawl and returns the id', async () => {
  const r = res();
  await ctrl.postCrawl({ admin: { id: 'admin1' }, body: {} }, r);
  expect(crawler.start).toHaveBeenCalledWith({ trigger: 'manual', triggeredBy: 'admin1' });
  expect(r.json.mock.calls[0][0].crawlId).toBe('crawlX');
});

test('getGsc returns gsc rows + configured flag', async () => {
  supabaseAdmin.from.mockImplementation((t) => {
    if (t === 'seo_gsc_urls') return makeQuery({ data: [{ url: 'https://meeticulous.com/x', impressions: 42 }], error: null });
    return makeQuery({ data: [], error: null });
  });
  const r = res();
  await ctrl.getGsc({ query: {} }, r);
  expect(r.json).toHaveBeenCalledWith({ gsc: [{ url: 'https://meeticulous.com/x', impressions: 42 }], configured: true });
});

test('getGsc fails soft to an empty array when the query errors', async () => {
  supabaseAdmin.from.mockImplementation(() => makeQuery({ data: null, error: new Error('relation does not exist') }));
  const r = res();
  await ctrl.getGsc({ query: {} }, r);
  expect(r.json).toHaveBeenCalledWith({ gsc: [], configured: true });
});

test('postGscSync starts the sync when configured', async () => {
  gscClient.isConfigured.mockReturnValue(true);
  const r = res();
  await ctrl.postGscSync({}, r);
  expect(r.json).toHaveBeenCalledWith({ configured: true, started: true });
  expect(gscSync.run).toHaveBeenCalled();
});

test('postGscSync no-ops when GSC is not configured', async () => {
  gscClient.isConfigured.mockReturnValue(false);
  const r = res();
  await ctrl.postGscSync({}, r);
  expect(r.json).toHaveBeenCalledWith({ configured: false, started: false });
  expect(gscSync.run).not.toHaveBeenCalled();
});
