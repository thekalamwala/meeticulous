// server/services/seo/rules/onpage.js
// Detection only. We flag a title/description only when it's long enough to be
// TRUNCATED in results — there is NO minimum. A short title or description is not
// a defect (spec §20: no arbitrary length gates); "too short" was crying wolf on
// ~400 healthy pages. Google truncates titles near ~60 chars and descriptions
// near ~160, so those are the only bands that map to real harm (lost SERP text).
const TITLE_MAX = 60, DESC_MAX = 160;

function check(p, ctx) {
  const out = [];
  const at = p.url;
  const push = (ruleKey, evidence) => out.push({ ruleKey, affectedUrl: at, evidence });
  if (!p.pageType || !ctx.SHOULD_INDEX_TYPES.has(p.pageType)) return out; // only audit indexable page types
  if (p.httpStatus !== 200) return out;                  // on-page rules need a real page (null/undefined/0 = fetch failed, not indexable)

  if (!p.title) push('onpage.missing_title', {});
  else {
    if (p.title.length > TITLE_MAX) push('onpage.title_length', { length: p.title.length, max: TITLE_MAX });
    if ((ctx.titleCounts.get(p.title) || 0) > 1) push('onpage.duplicate_title', { title: p.title, count: ctx.titleCounts.get(p.title) });
  }
  if (!p.metaDescription) push('onpage.missing_description', {});
  else {
    if (p.metaDescription.length > DESC_MAX) push('onpage.description_length', { length: p.metaDescription.length, max: DESC_MAX });
    if ((ctx.descCounts.get(p.metaDescription) || 0) > 1) push('onpage.duplicate_description', { count: ctx.descCounts.get(p.metaDescription) });
  }
  if (p.bodyCrawled !== false) {
    if (!p.h1 || p.h1.length === 0) push('onpage.missing_h1', {});
    else if (p.h1.length > 1) push('onpage.multiple_h1', { count: p.h1.length });
    // A brand/section suffix in the title ("Heading | Book A Sloth") is correct SEO,
    // not a mismatch — flag only when neither string contains the other (they're
    // about genuinely different things).
    if (p.title && p.h1 && p.h1.length === 1) {
      const t = p.title.toLowerCase(), h = p.h1[0].toLowerCase();
      if (!t.includes(h) && !h.includes(t)) push('onpage.title_h1_mismatch', { title: p.title, h1: p.h1[0] });
    }
  }
  return out;
}
module.exports = { check };
