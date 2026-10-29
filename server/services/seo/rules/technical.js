// server/services/seo/rules/technical.js
// Detection only. GSC SOP escalation triggers — crawl/response signals. Applies to every crawled URL (not gated by page type).
const SLOW_MS = Number(process.env.SEO_SLOW_MS) || 1500;
const normalize = (u) => (u || '').replace(/\/$/, '').toLowerCase();

function check(p, ctx) {
  const out = [];
  const at = p.url;
  const push = (ruleKey, evidence) => out.push({ ruleKey, affectedUrl: at, evidence });

  if (p.httpStatus == null || p.httpStatus >= 400) push('technical.non_200', { status: p.httpStatus, error: p.error });
  if ([301, 302, 307, 308].includes(p.httpStatus) || (p.redirectChain || []).length > 0)
    push('technical.redirect', { finalUrl: p.finalUrl });
  if (p.responseMs > SLOW_MS) push('technical.slow_response', { responseMs: p.responseMs });
  if (p.httpStatus === 200 && !p.canonical) push('technical.missing_canonical', {});
  if (p.canonical && normalize(p.canonical) !== normalize(p.finalUrl || p.url))
    push('technical.canonical_to_other', { canonical: p.canonical });
  if (p.httpStatus === 200 && !p.viewport) push('technical.missing_viewport', {});
  return out;
}
module.exports = { check };
