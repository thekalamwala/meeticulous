// server/services/seo/rules/content.js
// Detection only (spec §1f). Content-quality signals. NO arbitrary word-count
// minimum — thin/empty pages are already caught by indexability.soft_404. These
// are net-new: a generic H1, and template-heavy pages that share an identical
// heading signature (low unique content). Needs a real body → skips meta-only
// host/service pages.
const GENERIC_H1 = new Set([
  'home', 'welcome', 'welcome!', 'services', 'service', 'profile', 'blog',
  'dashboard', 'page', 'untitled', 'meeticulous',
]);

function check(p, ctx) {
  const out = [];
  const at = p.url;
  const push = (ruleKey, evidence) => out.push({ ruleKey, affectedUrl: at, evidence });
  if (!p.pageType || !ctx.SHOULD_INDEX_TYPES.has(p.pageType)) return out;
  if (p.httpStatus !== 200 || p.bodyCrawled === false) return out;

  if (p.h1 && p.h1.length === 1) {
    const h = p.h1[0].trim().toLowerCase();
    if (GENERIC_H1.has(h)) push('content.generic_h1', { h1: p.h1[0] });
  }
  return out;
}

// A heading signature = the ordered heading texts. Two full-body pages of the same
// type sharing an identical signature are template scaffolding with no unique
// content (spec §1f "template-heavy"). Advisory — never auto-acts.
function signature(p) {
  return (p.headings || []).map((h) => (h.text || '').trim().toLowerCase()).filter(Boolean).join(' > ');
}
function siteCheck(ctx) {
  const out = [];
  const byType = new Map(); // `${pageType}::${signature}` -> [urls]
  for (const p of ctx.pages) {
    if (p.httpStatus !== 200 || p.bodyCrawled === false) continue;
    const sig = signature(p);
    if (!sig) continue;
    const key = `${p.pageType}::${sig}`;
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key).push(p.url);
  }
  for (const [key, urls] of byType) {
    if (urls.length < 2) continue;
    for (const url of urls) out.push({ ruleKey: 'content.template_heavy', affectedUrl: url, evidence: { count: urls.length, others: urls.filter((u) => u !== url).slice(0, 5) } });
  }
  return out;
}
module.exports = { check, siteCheck };
