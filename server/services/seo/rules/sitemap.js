// server/services/seo/rules/sitemap.js
// Detection only. Site-level: indexable, live, non-noindex pages absent from the sitemap. Runs once per audit.
function siteCheck(ctx) {
  const out = [];
  for (const p of ctx.pages) {
    if (!p.pageType || !ctx.SHOULD_INDEX_TYPES.has(p.pageType)) continue; // only audit indexable page types
    if (p.httpStatus !== 200) continue;
    if (p.robots && p.robots.includes('noindex')) continue;
    if (!ctx.sitemapUrls.has(p.url)) out.push({ ruleKey: 'sitemap.missing_indexable', affectedUrl: p.url, evidence: { url: p.url } });
  }
  return out;
}
module.exports = { siteCheck };
