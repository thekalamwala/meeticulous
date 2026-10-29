// server/services/seo/rules/links.js
// Detection only. Internal link health — broken targets + orphaned pages.
// links.broken_external is deferred to P4 (external HEAD checks add crawl surface) — YAGNI.
const normalize = (u) => (u || '').replace(/\/$/, '');

function check(p, ctx) {
  const out = [];
  const at = p.url;
  const push = (ruleKey, evidence) => out.push({ ruleKey, affectedUrl: at, evidence });
  if (!p.pageType || !ctx.SHOULD_INDEX_TYPES.has(p.pageType)) return out; // only audit indexable page types
  if (p.httpStatus !== 200) return out;

  for (const href of p.links?.internal || []) {
    // ponytail: linear find is fine at audit scale (hundreds of pages); index ctx.pages by URL if this profiles hot.
    const target = ctx.pages.find((pg) => normalize(pg.url) === normalize(href));
    // Only flag a target we actually crawled — httpStatus==null there means "fetch failed" (seoFetch.js).
    // A target absent from ctx.pages was simply never crawled (e.g. non-sitemap app route), not broken.
    if (target && (target.httpStatus == null || target.httpStatus >= 400)) push('links.broken_internal', { href });
  }

  // orphan-ness is undeterminable for bodiless pages (meta-shell only, no crawled inbound links); skip to avoid false positives.
  if (p.inSitemap && !ctx.internalLinkTargets.has(normalize(p.url)) && p.bodyCrawled !== false) push('links.orphan_page', {});
  return out;
}
module.exports = { check };
