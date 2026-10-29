// server/services/seo/rules/gsc.js
// Detection only. Reads ctx.gscByUrl (Map url→seo_gsc_urls row) populated by
// the crawler from the seo-sync'd table. No GSC data for this url (creds
// unset / table empty / not yet synced) → emit nothing (graceful).
const norm = (u) => (u || '').replace(/\/$/, '').toLowerCase();
const cs = (g) => (g.coverage_state || '').toLowerCase();
const isIndexed = (state) => /^\s*indexed\b/.test(state) || state.includes('submitted and indexed'); // Google says indexed

function check(p, ctx) {
  const g = ctx.gscByUrl && ctx.gscByUrl.get(p.url);
  if (!g) return [];
  const out = [];
  const push = (ruleKey, evidence) => out.push({ ruleKey, affectedUrl: p.url, evidence });

  if (g.google_canonical && norm(g.google_canonical) !== norm(p.url) &&
      (!g.user_canonical || norm(g.google_canonical) !== norm(g.user_canonical))) {
    push('gsc.google_chose_different_canonical', { googleCanonical: g.google_canonical, userCanonical: g.user_canonical });
  }
  if (cs(g).includes('soft 404')) {
    push('gsc.soft_404', { coverageState: g.coverage_state });
  }
  if (cs(g).includes('crawled') && cs(g).includes('not indexed')) {
    push('gsc.crawled_not_indexed', { coverageState: g.coverage_state });
  }
  if (cs(g).includes('discovered') && cs(g).includes('not indexed')) {
    push('gsc.discovered_not_indexed', { coverageState: g.coverage_state });
  }
  if (p.indexable === true && g.coverage_state && !isIndexed(cs(g))) {
    push('gsc.indexable_mismatch', { coverageState: g.coverage_state, ourIndexable: true });
  }
  return out;
}
module.exports = { check };
