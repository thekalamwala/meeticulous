// server/tests/unit/seoPhase1.test.js — Phase 1 audit additions:
// scorePage/status, pageClassify, and the semantic/content/cannibalization rules.
const { scorePage, statusFor } = require('../../services/seo/healthScore');
const pc = require('../../services/seo/pageClassify');
const semantic = require('../../services/seo/rules/semantic');
const content = require('../../services/seo/rules/content');
const cannibal = require('../../services/seo/rules/cannibalization');
const { buildContext } = require('../../services/seo/rules/index');

const ctxOf = (pages) => buildContext(pages, new Set());

describe('healthScore.scorePage + status', () => {
  test('a clean page is PASS at 100', () => {
    const sp = scorePage([], 'static');
    expect(sp.status).toBe('PASS');
    expect(sp.health).toBe(100);
  });
  test('any P0 forces FAIL even with a high score', () => {
    // one P0 on a 7-dimension page: health stays high, status must still FAIL.
    const sp = scorePage([{ severity: 'P0', category: 'indexability' }], 'static');
    expect(sp.status).toBe('FAIL');
    expect(sp.criticalCount).toBe(1);
    expect(sp.health).toBeGreaterThan(80);
  });
  test('P1/P2 without a P0 is WARNING', () => {
    expect(statusFor([{ severity: 'P2', category: 'onpage' }])).toBe('WARNING');
  });
  test('a content issue does not affect a bodiless host page (dimension not applicable)', () => {
    const sp = scorePage([{ severity: 'P3', category: 'content' }], 'host');
    expect(sp.dimensions.content).toBeUndefined();
    expect(sp.health).toBe(100);
  });
});

describe('pageClassify', () => {
  test('host pages exclude content + internal_linking dimensions', () => {
    expect(pc.dimensionsForType('host')).not.toContain('content');
    expect(pc.dimensionsForType('static')).toContain('content');
  });
  test('unknown type stays minimal, never invented', () => {
    expect(pc.dimensionsForType('mystery')).toEqual(pc.DIMENSIONS_BY_TYPE.unknown);
    expect(pc.categoryForType('mystery')).toBe('Other');
  });
});

describe('rules/semantic', () => {
  const base = { pageType: 'static', httpStatus: 200, bodyCrawled: true };
  test('no_headings fires when a body page has no headings', () => {
    const p = { ...base, url: 'https://meeticulous.com/a', headings: [], jsonLd: [] };
    expect(semantic.check(p, ctxOf([p])).map((i) => i.ruleKey)).toContain('semantic.no_headings');
  });
  test('heading_skip fires on an h1→h3 jump', () => {
    const p = { ...base, url: 'https://meeticulous.com/a', headings: [{ tag: 'h1', text: 'A' }, { tag: 'h3', text: 'B' }], jsonLd: [] };
    expect(semantic.check(p, ctxOf([p])).map((i) => i.ruleKey)).toContain('semantic.heading_skip');
  });
  test('jsonld_untyped fires when JSON-LD has no @type', () => {
    const p = { ...base, url: 'https://meeticulous.com/a', headings: [{ tag: 'h1', text: 'A' }], jsonLd: [{ name: 'x' }] };
    expect(semantic.check(p, ctxOf([p])).map((i) => i.ruleKey)).toContain('semantic.jsonld_untyped');
  });
});

describe('rules/content', () => {
  test('generic_h1 fires on a boilerplate H1', () => {
    const p = { url: 'https://meeticulous.com/a', pageType: 'static', httpStatus: 200, bodyCrawled: true, h1: ['Home'] };
    expect(content.check(p, ctxOf([p])).map((i) => i.ruleKey)).toContain('content.generic_h1');
  });
  test('template_heavy fires for two same-type pages sharing a heading signature', () => {
    const mk = (u) => ({ url: u, pageType: 'static', httpStatus: 200, bodyCrawled: true, headings: [{ tag: 'h1', text: 'Same' }, { tag: 'h2', text: 'Bits' }] });
    const a = mk('https://meeticulous.com/a'); const b = mk('https://meeticulous.com/b');
    const keys = content.siteCheck(ctxOf([a, b])).map((i) => i.ruleKey);
    expect(keys.filter((k) => k === 'content.template_heavy').length).toBe(2);
  });
});

describe('rules/cannibalization', () => {
  test('potential_cannibalization flags two near-identical titles of the same type', () => {
    const a = { url: 'https://meeticulous.com/a', pageType: 'service', httpStatus: 200, title: 'Yoga classes online private' };
    const b = { url: 'https://meeticulous.com/b', pageType: 'service', httpStatus: 200, title: 'Private online yoga classes' };
    const out = cannibal.siteCheck(ctxOf([a, b]));
    expect(out.map((i) => i.ruleKey)).toContain('content.potential_cannibalization');
    expect(out.length).toBe(2); // symmetric — one row per page
  });
  test('distinct titles do not trigger cannibalization', () => {
    const a = { url: 'https://meeticulous.com/a', pageType: 'service', httpStatus: 200, title: 'Yoga classes online' };
    const b = { url: 'https://meeticulous.com/b', pageType: 'service', httpStatus: 200, title: 'Tax filing consultation help' };
    expect(cannibal.siteCheck(ctxOf([a, b]))).toHaveLength(0);
  });
});
