// server/tests/unit/seoRules.indexability.test.js
const tech = require('../../services/seo/rules/technical');
const idx = require('../../services/seo/rules/indexability');
const { buildContext } = require('../../services/seo/rules/index');

const base = (o = {}) => ({ url: 'https://meeticulous.com/jane', pageType: 'host', httpStatus: 200,
  canonical: 'https://meeticulous.com/jane', redirectChain: [], responseMs: 100, viewport: 'w', wordCount: 500, robots: 'index, follow', title: 'Jane', ...o });

describe('technical + indexability rules', () => {
  test('non_200 fires on 404', () => {
    const ctx = buildContext([], new Set());
    expect(tech.check(base({ httpStatus: 404 }), ctx).map((i) => i.ruleKey)).toContain('technical.non_200');
  });
  test('unexpected_noindex fires when robots has noindex', () => {
    const ctx = buildContext([], new Set());
    expect(idx.check(base({ robots: 'noindex, follow' }), ctx).map((i) => i.ruleKey)).toContain('indexability.unexpected_noindex');
  });
  test('prerender_regression fires when title equals homepage title', () => {
    const home = { url: 'https://meeticulous.com/', pageType: 'static', title: 'Meeticulous' };
    const p = base({ title: 'Meeticulous', pageType: 'service' });
    const ctx = buildContext([home, p], new Set());
    expect(idx.check(p, ctx).map((i) => i.ruleKey)).toContain('indexability.prerender_regression');
  });
  // Shell title = a title shared by >= 5 pages (the un-prerendered SPA fallback).
  const shellPages = (n) => Array.from({ length: n }, (_, i) => ({ url: `https://meeticulous.com/services/p${i}`, pageType: 'static', httpStatus: 200, bodyCrawled: true, title: 'Meeticulous — the calm way to sell your time' }));
  test('unrendered_title fires for a page serving the shared shell title (>=5 pages)', () => {
    const home = { url: 'https://meeticulous.com/', pageType: 'static', httpStatus: 200, title: 'Meeticulous — home (prerendered)' };
    const pages = shellPages(6);
    const ctx = buildContext([home, ...pages], new Set());
    expect(idx.check(pages[0], ctx).map((i) => i.ruleKey)).toContain('onpage.unrendered_title');
  });
  test('unrendered_title does NOT fire when only a few pages share a title (real dup, not shell)', () => {
    const pages = shellPages(2); // below the >=5 shell threshold
    const ctx = buildContext(pages, new Set());
    expect(idx.check(pages[0], ctx).map((i) => i.ruleKey)).not.toContain('onpage.unrendered_title');
  });
  test('unrendered_title does NOT fire for the prerendered homepage (unique title)', () => {
    const home = base({ url: 'https://meeticulous.com/', pageType: 'static', title: 'Meeticulous — home (prerendered)', bodyCrawled: true });
    const ctx = buildContext([home, ...shellPages(6)], new Set());
    expect(idx.check(home, ctx).map((i) => i.ruleKey)).not.toContain('onpage.unrendered_title');
  });
  test('error_url_in_sitemap fires for a 404 that is in the sitemap', () => {
    const ctx = buildContext([], new Set(['https://meeticulous.com/jane']));
    expect(idx.check(base({ httpStatus: 404, inSitemap: true }), ctx).map((i) => i.ruleKey)).toContain('indexability.error_url_in_sitemap');
  });
  test('soft_404 does NOT fire for a bodiless (bodyCrawled:false) page with wordCount 0', () => {
    const ctx = buildContext([], new Set());
    expect(idx.check(base({ wordCount: 0, bodyCrawled: false }), ctx).map((i) => i.ruleKey)).not.toContain('indexability.soft_404');
  });
  test('soft_404 STILL fires for a crawled (bodyCrawled:true or unset) 200 page with wordCount 0', () => {
    const ctx = buildContext([], new Set());
    expect(idx.check(base({ wordCount: 0, bodyCrawled: true }), ctx).map((i) => i.ruleKey)).toContain('indexability.soft_404');
    expect(idx.check(base({ wordCount: 0 }), ctx).map((i) => i.ruleKey)).toContain('indexability.soft_404');
  });
});
