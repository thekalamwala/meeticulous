// server/services/seo/rules/indexability.js
// Detection only. GSC SOP escalation triggers — indexability signals.
const SOFT_MIN = Number(process.env.SEO_SOFT_404_WORDS) || 100;
const normalize = (u) => (u || '').replace(/\/$/, '').toLowerCase();

function check(p, ctx) {
  const out = [];
  const at = p.url;
  const push = (ruleKey, evidence) => out.push({ ruleKey, affectedUrl: at, evidence });
  if (!p.pageType || !ctx.SHOULD_INDEX_TYPES.has(p.pageType)) return out; // only audit indexable page types

  if (p.httpStatus === 200 && p.robots && p.robots.includes('noindex'))
    push('indexability.unexpected_noindex', { robots: p.robots });
  if (p.inSitemap && (p.httpStatus == null || p.httpStatus >= 400 || (p.redirectChain || []).length > 0))
    push('indexability.error_url_in_sitemap', { status: p.httpStatus });
  if (p.inSitemap && p.canonical && normalize(p.canonical) !== normalize(p.url))
    push('indexability.canonical_sitemap_mismatch', { canonical: p.canonical });
  if (p.httpStatus === 200 && p.wordCount < SOFT_MIN && !(p.robots && p.robots.includes('noindex')) && p.bodyCrawled !== false)
    push('indexability.soft_404', { wordCount: p.wordCount });
  if ((p.pageType === 'host' || p.pageType === 'service') && p.title && ctx.homepageTitle && p.title === ctx.homepageTitle)
    push('indexability.prerender_regression', { title: p.title });
  // A body-crawled page (static/blog) that serves the generic SHELL <title> — the one
  // shared by many pages (ctx.shellTitle) — was not prerendered for non-JS clients:
  // the crawler, AI/search bots and social scrapers all see the fallback site title,
  // not a page-specific one. One actionable issue per page (not the noise of pairwise
  // cannibalization on an identical title). e.g. /services/:slug profession pages.
  if (p.httpStatus === 200 && p.bodyCrawled !== false && p.title && ctx.shellTitle
      && p.title === ctx.shellTitle
      && p.pageType !== 'host' && p.pageType !== 'service')
    push('onpage.unrendered_title', { title: p.title });
  return out;
}
module.exports = { check };
