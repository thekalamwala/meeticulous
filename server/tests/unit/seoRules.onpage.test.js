// server/tests/unit/seoRules.onpage.test.js
const { check } = require('../../services/seo/rules/onpage');
const { buildContext } = require('../../services/seo/rules/index');

const page = (over = {}) => ({
  url: 'https://bookasloth.com/jane', pageType: 'host', httpStatus: 200,
  title: 'A Great Coach You Should Book Today Right Now Here', metaDescription: 'x'.repeat(150),
  h1: ['A Great Coach You Should Book Today Right Now Here'], ...over,
});

describe('onpage rules', () => {
  test('flags missing title', () => {
    const ctx = buildContext([page({ title: null })], new Set());
    const keys = check(page({ title: null }), ctx).map((i) => i.ruleKey);
    expect(keys).toContain('onpage.missing_title');
  });

  test('flags a title that is too long (truncation risk), not a short one', () => {
    // Too long → flagged (Google truncates ~60 chars).
    const longP = page({ title: 'x'.repeat(90) });
    expect(check(longP, buildContext([longP], new Set())).map((i) => i.ruleKey)).toContain('onpage.title_length');
    // Short → NOT flagged (spec §20: no minimum length gate).
    const shortP = page({ title: 'Short' });
    expect(check(shortP, buildContext([shortP], new Set())).map((i) => i.ruleKey)).not.toContain('onpage.title_length');
  });

  test('flags a description that is too long, not a short one', () => {
    const longP = page({ metaDescription: 'x'.repeat(200) });
    expect(check(longP, buildContext([longP], new Set())).map((i) => i.ruleKey)).toContain('onpage.description_length');
    const shortP = page({ metaDescription: 'Short and sweet.' });
    expect(check(shortP, buildContext([shortP], new Set())).map((i) => i.ruleKey)).not.toContain('onpage.description_length');
  });

  test('flags duplicate titles across pages', () => {
    const p1 = page({ url: 'https://bookasloth.com/a', title: 'Same Title Here For Both Pages OK Yes Sure Indeed' });
    const p2 = page({ url: 'https://bookasloth.com/b', title: 'Same Title Here For Both Pages OK Yes Sure Indeed' });
    const ctx = buildContext([p1, p2], new Set());
    expect(check(p1, ctx).map((i) => i.ruleKey)).toContain('onpage.duplicate_title');
  });

  test('flags multiple H1', () => {
    const ctx = buildContext([page({ h1: ['one', 'two'] })], new Set());
    expect(check(page({ h1: ['one', 'two'] }), ctx).map((i) => i.ruleKey)).toContain('onpage.multiple_h1');
  });

  test('a failed-fetch page (httpStatus null) yields no on-page issues', () => {
    const p = page({ httpStatus: null, title: null, metaDescription: null, h1: [] });
    const ctx = buildContext([p], new Set());
    expect(check(p, ctx)).toEqual([]);
  });

  test('a bodiless (bodyCrawled:false) page with h1:[] does not fire missing_h1 or title_h1_mismatch', () => {
    const p = page({ bodyCrawled: false, h1: [] });
    const ctx = buildContext([p], new Set());
    const keys = check(p, ctx).map((i) => i.ruleKey);
    expect(keys).not.toContain('onpage.missing_h1');
    expect(keys).not.toContain('onpage.title_h1_mismatch');
  });

  test('a bodiless page fires title_length only for a too-long title (resolver-provided title stays valid)', () => {
    const short = page({ bodyCrawled: false, h1: [], title: 'Short' });
    const long = page({ bodyCrawled: false, h1: [], title: 'x'.repeat(90) });
    const ctx = buildContext([short, long], new Set());
    expect(check(short, ctx).map((i) => i.ruleKey)).not.toContain('onpage.title_length');
    expect(check(long, ctx).map((i) => i.ruleKey)).toContain('onpage.title_length');
  });

  // Back-compat: existing 2-arg callers (no GSC map) must still work.
  test('buildContext without a 3rd arg still works and defaults gscByUrl to an empty Map', () => {
    const ctx = buildContext([page()], new Set());
    expect(ctx.gscByUrl).toBeInstanceOf(Map);
    expect(ctx.gscByUrl.size).toBe(0);
  });
});
