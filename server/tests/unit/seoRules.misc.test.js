// server/tests/unit/seoRules.misc.test.js
const links = require('../../services/seo/rules/links');
const images = require('../../services/seo/rules/images');
const schema = require('../../services/seo/rules/structuredData');
const sitemap = require('../../services/seo/rules/sitemap');
const { buildContext } = require('../../services/seo/rules/index');

test('broken_internal fires when a linked page is 404', () => {
  const target = { url: 'https://meeticulous.com/dead', httpStatus: 404 };
  const src = { url: 'https://meeticulous.com/a', pageType: 'static', httpStatus: 200, links: { internal: ['https://meeticulous.com/dead'], external: [] }, images: [] };
  const ctx = buildContext([src, target], new Set());
  expect(links.check(src, ctx).map((i) => i.ruleKey)).toContain('links.broken_internal');
});
test('missing_alt fires when an image has no alt', () => {
  const p = { url: 'https://meeticulous.com/a', pageType: 'static', httpStatus: 200, images: [{ src: '/x.jpg', alt: null }], links: { internal: [], external: [] } };
  expect(images.check(p, buildContext([p], new Set())).map((i) => i.ruleKey)).toContain('images.missing_alt');
});
test('schema.missing fires with no json-ld', () => {
  const p = { url: 'https://meeticulous.com/a', pageType: 'blog', httpStatus: 200, jsonLd: [], images: [], links: { internal: [], external: [] } };
  expect(schema.check(p, buildContext([p], new Set())).map((i) => i.ruleKey)).toContain('schema.missing');
});
test('sitemap.missing_indexable fires for a 200 indexable page not in the sitemap', () => {
  const p = { url: 'https://meeticulous.com/a', pageType: 'static', httpStatus: 200, robots: 'index', images: [], links: { internal: [], external: [] } };
  const ctx = buildContext([p], new Set()); // empty sitemap set
  expect(sitemap.siteCheck(ctx).map((i) => i.ruleKey)).toContain('sitemap.missing_indexable');
});
test('broken_internal does NOT flag an internal link to an uncrawled (non-sitemap) target', () => {
  const src = { url: 'https://meeticulous.com/a', pageType: 'static', httpStatus: 200, links: { internal: ['https://meeticulous.com/login'], external: [] }, images: [] };
  const ctx = buildContext([src], new Set()); // /login never crawled → absent from ctx.pages
  expect(links.check(src, ctx).map((i) => i.ruleKey)).not.toContain('links.broken_internal');
});
test('orphan_page does NOT fire for a bodiless (bodyCrawled:false) host page (inbound links are SPA-rendered)', () => {
  const host = { url: 'https://meeticulous.com/@alice', pageType: 'host', httpStatus: 200, inSitemap: true, bodyCrawled: false, images: [], links: { internal: [], external: [] } };
  const ctx = buildContext([host], new Set());
  expect(links.check(host, ctx).map((i) => i.ruleKey)).not.toContain('links.orphan_page');
});
test('orphan_page does NOT fire for a bodiless (bodyCrawled:false) service page (inbound links are SPA-rendered)', () => {
  const service = { url: 'https://meeticulous.com/@alice/massage', pageType: 'service', httpStatus: 200, inSitemap: true, bodyCrawled: false, images: [], links: { internal: [], external: [] } };
  const ctx = buildContext([service], new Set());
  expect(links.check(service, ctx).map((i) => i.ruleKey)).not.toContain('links.orphan_page');
});
test('orphan_page STILL fires for a bodyCrawled:true static page not linked from any crawled page', () => {
  const orphaned = { url: 'https://meeticulous.com/static-page', pageType: 'static', httpStatus: 200, inSitemap: true, bodyCrawled: true, images: [], links: { internal: [], external: [] } };
  const ctx = buildContext([orphaned], new Set());
  expect(links.check(orphaned, ctx).map((i) => i.ruleKey)).toContain('links.orphan_page');
});
test('missing_alt skips a bodiless (bodyCrawled:false) page', () => {
  const p = { url: 'https://meeticulous.com/@alice', pageType: 'host', httpStatus: 200, bodyCrawled: false, images: [{ src: '/x.jpg', alt: null }], links: { internal: [], external: [] } };
  expect(images.check(p, buildContext([p], new Set())).map((i) => i.ruleKey)).not.toContain('images.missing_alt');
});

test('cannibalization ignores un-prerendered pages sharing the shell title (>=5)', () => {
  const cannibal = require('../../services/seo/rules/cannibalization');
  // 6 profession pages all serving the shell title — must NOT flag each other.
  const pages = Array.from({ length: 6 }, (_, i) => ({ url: `https://meeticulous.com/services/p${i}`, pageType: 'static', httpStatus: 200, title: 'Meeticulous — the calm way to sell your time' }));
  const ctx = buildContext(pages, new Set());
  expect(cannibal.siteCheck(ctx).map((i) => i.ruleKey)).not.toContain('content.potential_cannibalization');
});

test('cannibalization still flags two real pages with near-identical titles', () => {
  const cannibal = require('../../services/seo/rules/cannibalization');
  const home = { url: 'https://meeticulous.com/', pageType: 'static', httpStatus: 200, title: 'Home' };
  const a = { url: 'https://meeticulous.com/a', pageType: 'static', httpStatus: 200, title: 'Career Coaching Sessions Online' };
  const b = { url: 'https://meeticulous.com/b', pageType: 'static', httpStatus: 200, title: 'Career Coaching Sessions Online Now' };
  const ctx = buildContext([home, a, b], new Set());
  expect(cannibal.siteCheck(ctx).map((i) => i.ruleKey)).toContain('content.potential_cannibalization');
});
