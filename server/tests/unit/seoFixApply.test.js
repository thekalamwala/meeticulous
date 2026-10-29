// server/tests/unit/seoFixApply.test.js — Phase 3 apply/retest guards.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/seo/seoFixService', () => ({ getFix: jest.fn() }));
jest.mock('../../services/seo/seoCrawler', () => ({ crawlOne: jest.fn() }));

const apply = require('../../services/seo/fixes/apply');
const fixSvc = require('../../services/seo/seoFixService');
const crawler = require('../../services/seo/seoCrawler');

const OLD_ENV = process.env.SEO_FIX_DRY_RUN;
afterEach(() => { process.env.SEO_FIX_DRY_RUN = OLD_ENV; jest.clearAllMocks(); });

const fix = (over = {}) => ({ id: 'f1', status: 'approved', target: 'meta_builder', page_type: 'static', field: 'canonical', url: 'https://bookasloth.com/pricing', old_value: null, new_value: 'https://bookasloth.com/pricing', rule_key: 'technical.missing_canonical', ...over });

describe('resolved()', () => {
  test('true when the fix rule no longer fires', () => {
    expect(apply.resolved(fix({ rule_key: 'onpage.missing_h1' }), { ruleKeys: ['onpage.missing_title'] })).toBe(true);
    expect(apply.resolved(fix({ rule_key: 'onpage.missing_h1' }), { ruleKeys: ['onpage.missing_h1'] })).toBe(false);
  });
});

describe('applyFix guards', () => {
  test('refuses a non-approved fix', async () => {
    fixSvc.getFix.mockResolvedValue(fix({ status: 'proposed' }));
    expect(await apply.applyFix('f1')).toMatchObject({ ok: false, reason: expect.stringContaining('not approved') });
  });
  test('DRY_RUN blocks any apply', async () => {
    process.env.SEO_FIX_DRY_RUN = 'true';
    fixSvc.getFix.mockResolvedValue(fix());
    expect(await apply.applyFix('f1')).toMatchObject({ ok: false, dryRun: true });
  });
  test('code/content target returns requiresPr (never written server-side)', async () => {
    process.env.SEO_FIX_DRY_RUN = 'false';
    fixSvc.getFix.mockResolvedValue(fix({ target: 'meta_builder' }));
    expect(await apply.applyFix('f1')).toMatchObject({ ok: false, requiresPr: true });
  });
  test('db_field with no configured column is refused (never touches UGC)', async () => {
    process.env.SEO_FIX_DRY_RUN = 'false';
    fixSvc.getFix.mockResolvedValue(fix({ target: 'db_field', page_type: 'host', field: 'meta_description', new_value: 'x' }));
    expect(await apply.applyFix('f1')).toMatchObject({ ok: false, requiresConfig: true });
  });
});

describe('retest', () => {
  test('re-crawls one URL and returns status/health/ruleKeys', async () => {
    crawler.crawlOne.mockResolvedValue({
      url: 'https://bookasloth.com/pricing', pageType: 'static', httpStatus: 200, bodyCrawled: true,
      title: 'Pricing — Book A Sloth', metaDescription: 'd'.repeat(150), canonical: 'https://bookasloth.com/pricing',
      robots: 'index', h1: ['Our pricing'], headings: [{ tag: 'h1', text: 'Our pricing' }], wordCount: 400,
      links: { internal: [], external: [] }, images: [], jsonLd: [{ '@type': 'WebPage' }], inSitemap: true,
    });
    const r = await apply.retest('https://bookasloth.com/pricing', 'static', true);
    expect(r.status).toBeDefined();
    expect(typeof r.health).toBe('number');
    expect(Array.isArray(r.ruleKeys)).toBe(true);
  });
});
