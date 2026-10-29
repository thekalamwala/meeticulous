// server/services/seo/scoring/index.js
// v2 page scorer: SEO + GEO scores, per-dimension "why not 100" breakdowns, and one
// prioritized fix queue (Impact × Confidence × Ease). Pure — the read layer supplies
// the page row, its issues, GSC data and the robots map. See docs/seo-scoring-framework.md.
const { extract } = require('./signals');
const seo = require('./seoScore');
const geo = require('./geoScore');

const CONF = { official: 1.0, proxy: 0.7, industry: 0.6, heuristic: 0.5 };
// Ease of applying the typical fix for a dimension (1 = trivial, lower = harder).
const EASE = {
  indexability: 0.9, canonical: 0.9, metadata: 1.0, media: 1.0, structured_data: 0.85,
  internal_linking: 0.7, search_performance: 0.5, content: 0.4,
  crawler_access: 0.9, extractability: 0.5, entity_clarity: 0.7, answer_coverage: 0.4,
  structure: 0.6, evidence: 0.4, freshness: 0.9,
};
const tierOf = (p) => (p >= 8 ? 'HIGH' : p >= 3 ? 'MEDIUM' : 'LOW');

function recsFrom(axis, result) {
  const out = [];
  for (const d of result.dimensions) {
    if (!d.fix || d.lost <= 0) continue;
    const confidence = CONF[d.evidence] ?? 0.6;
    const ease = EASE[d.key] ?? 0.6;
    const priority = d.lost * confidence * ease;
    out.push({ axis, dimension: d.key, label: d.label, title: d.fix, reason: d.reason, impact: d.lost, confidence: Number(confidence.toFixed(2)), ease, evidence: d.evidence, priority: Number(priority.toFixed(2)), tier: tierOf(priority) });
  }
  // Caps are high-impact by construction — surface them above dimension nits.
  for (const c of result.caps) {
    out.push({ axis, dimension: 'cap', label: 'Score cap', title: c.reason, reason: `Score capped at ${c.cap}. ${c.reason}`, impact: 100 - c.cap, confidence: 1, ease: 0.8, evidence: 'official', priority: Number(((100 - c.cap) * 0.8).toFixed(2)), tier: 'HIGH' });
  }
  return out;
}

// page: a seo_crawl_pages row (with raw_signals). ctx: { issues, gsc, queries, robots }.
function scorePage(page, ctx = {}) {
  const issues = ctx.issues || [];
  const sig = extract(page, { gsc: ctx.gsc, queries: ctx.queries, robots: ctx.robots });
  const seoResult = seo.score(sig, issues);
  const geoResult = geo.score(sig, issues);
  const recommendations = [...recsFrom('SEO', seoResult), ...recsFrom('GEO', geoResult)]
    .sort((a, b) => b.priority - a.priority);
  return {
    seo: seoResult,
    geo: geoResult,
    recommendations,
    signals: {
      bodySource: sig.bodySource, wordCount: sig.wordCount, internalOut: sig.internalOut,
      hasEntitySchema: sig.hasEntitySchema, hasAuthor: sig.hasAuthor,
      stats: sig.stats, quotes: sig.quotes, externalCitations: sig.externalCitations,
      intentCoverage: sig.intentCoverage, extractable: sig.extractable,
    },
  };
}

module.exports = { scorePage };
