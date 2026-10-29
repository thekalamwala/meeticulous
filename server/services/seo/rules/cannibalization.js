// server/services/seo/rules/cannibalization.js
// Detection only (spec §1g). EVIDENCE GATHERING, not a diagnosis. Flags pairs of
// same-type pages whose titles overlap heavily — a hint two pages may compete for
// the same query. Advisory (P3, autoFixable:false): the system NEVER merges,
// redirects or deletes a page automatically. Query/ranking-overlap signals are
// deferred until GSC history is mature (per plan §1g / §1i).
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'with', 'your', 'you', 'book', 'sloth']);
const OVERLAP_MIN = Number(process.env.SEO_CANNIBAL_OVERLAP) || 0.7;

function tokens(s) {
  return new Set(String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

// ponytail: O(n²) within each page type. Fine at ~300 pages; if page count grows
// past a few thousand, bucket by shared token before pairwise-comparing.
function siteCheck(ctx) {
  const out = [];
  const byType = new Map();
  for (const p of ctx.pages) {
    if (p.httpStatus !== 200 || !p.title) continue;
    // Skip pages that weren't prerendered — they all carry the generic shell
    // <title> (ctx.shellTitle), so comparing them flags every pair as cannibalizing a
    // title that isn't really theirs. The not-prerendered gap is reported by
    // onpage.unrendered_title / indexability.prerender_regression instead.
    if (ctx.shellTitle && p.title === ctx.shellTitle) continue;
    if (!byType.has(p.pageType)) byType.set(p.pageType, []);
    byType.get(p.pageType).push({ url: p.url, toks: tokens(p.title), title: p.title });
  }
  for (const [, items] of byType) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const sim = jaccard(items[i].toks, items[j].toks);
        if (sim >= OVERLAP_MIN) {
          out.push({ ruleKey: 'content.potential_cannibalization', affectedUrl: items[i].url, evidence: { with: items[j].url, similarity: Math.round(sim * 100) / 100, title: items[i].title, otherTitle: items[j].title } });
          out.push({ ruleKey: 'content.potential_cannibalization', affectedUrl: items[j].url, evidence: { with: items[i].url, similarity: Math.round(sim * 100) / 100, title: items[j].title, otherTitle: items[i].title } });
        }
      }
    }
  }
  return out;
}
module.exports = { siteCheck };
