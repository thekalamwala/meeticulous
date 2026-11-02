// server/tests/unit/seoRules.gsc.test.js
const { check } = require('../../services/seo/rules/gsc');
const { buildContext } = require('../../services/seo/rules/index');

const url = 'https://meeticulous.com/jane';
const page = (over = {}) => ({ url, pageType: 'host', httpStatus: 200, indexable: true, ...over });

const ctxFor = (gscRow) => buildContext([page()], new Set(), gscRow ? new Map([[url, gscRow]]) : new Map());

describe('gsc rules', () => {
  test('no GSC data for the url → zero gsc.* issues', () => {
    const ctx = ctxFor(null);
    expect(check(page(), ctx)).toEqual([]);
  });

  test('Google chose a different canonical', () => {
    const ctx = ctxFor({ google_canonical: 'https://meeticulous.com/other', user_canonical: null });
    const keys = check(page(), ctx).map((i) => i.ruleKey);
    expect(keys).toContain('gsc.google_chose_different_canonical');
  });

  test('matching google_canonical does not fire', () => {
    const ctx = ctxFor({ google_canonical: url });
    expect(check(page(), ctx).map((i) => i.ruleKey)).not.toContain('gsc.google_chose_different_canonical');
  });

  test('soft 404 coverage state', () => {
    const ctx = ctxFor({ coverage_state: 'Soft 404' });
    expect(check(page(), ctx).map((i) => i.ruleKey)).toContain('gsc.soft_404');
  });

  test('crawled - currently not indexed', () => {
    const ctx = ctxFor({ coverage_state: 'Crawled - currently not indexed' });
    const keys = check(page(), ctx).map((i) => i.ruleKey);
    expect(keys).toContain('gsc.crawled_not_indexed');
  });

  test('discovered - currently not indexed', () => {
    const ctx = ctxFor({ coverage_state: 'Discovered - currently not indexed' });
    const keys = check(page(), ctx).map((i) => i.ruleKey);
    expect(keys).toContain('gsc.discovered_not_indexed');
  });

  test('indexable_mismatch: we say indexable, Google has not indexed it', () => {
    const ctx = ctxFor({ coverage_state: 'Crawled - currently not indexed' });
    const keys = check(page({ indexable: true }), ctx).map((i) => i.ruleKey);
    expect(keys).toContain('gsc.indexable_mismatch');
  });

  test('Submitted and indexed → zero gsc.* issues', () => {
    const ctx = ctxFor({ coverage_state: 'Submitted and indexed', google_canonical: url });
    expect(check(page(), ctx)).toEqual([]);
  });

  test('Indexed, though blocked by robots.txt → zero gsc.* issues (indexed state variant)', () => {
    const ctx = ctxFor({ coverage_state: 'Indexed, though blocked by robots.txt', google_canonical: url });
    const keys = check(page({ indexable: true }), ctx).map((i) => i.ruleKey);
    expect(keys).not.toContain('gsc.indexable_mismatch');
  });

  test('Crawled - currently not indexed still fires indexable_mismatch', () => {
    const ctx = ctxFor({ coverage_state: 'Crawled - currently not indexed' });
    const keys = check(page({ indexable: true }), ctx).map((i) => i.ruleKey);
    expect(keys).toContain('gsc.indexable_mismatch');
  });
});
