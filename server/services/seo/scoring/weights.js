// server/services/seo/scoring/weights.js
// Page-type weight profiles for the SEO and GEO scores. Each column sums to 100.
// Rationale + evidence levels: docs/seo-scoring-framework.md. Do not tweak weights
// without updating that doc — it is the audit trail for why a page scores what it does.

// page_type -> profile key
const PROFILE_BY_TYPE = {
  static: 'content', unknown: 'content',
  blog: 'blog', service: 'service', host: 'profile',
};

const SEO = {
  content: { indexability: 18, canonical: 10, metadata: 16, content: 20, internal_linking: 12, structured_data: 6, media: 5, search_performance: 13 },
  blog:    { indexability: 16, canonical: 8,  metadata: 14, content: 22, internal_linking: 12, structured_data: 6, media: 4, search_performance: 18 },
  service: { indexability: 18, canonical: 10, metadata: 18, content: 12, internal_linking: 10, structured_data: 12, media: 5, search_performance: 15 },
  profile: { indexability: 18, canonical: 10, metadata: 18, content: 12, internal_linking: 10, structured_data: 12, media: 5, search_performance: 15 },
};

const GEO = {
  content: { crawler_access: 18, extractability: 15, entity_clarity: 15, answer_coverage: 15, structure: 12, evidence: 12, structured_data: 8, freshness: 5 },
  blog:    { crawler_access: 16, extractability: 14, entity_clarity: 14, answer_coverage: 16, structure: 12, evidence: 12, structured_data: 6, freshness: 10 },
  service: { crawler_access: 18, extractability: 14, entity_clarity: 18, answer_coverage: 14, structure: 10, evidence: 12, structured_data: 10, freshness: 4 },
  profile: { crawler_access: 18, extractability: 14, entity_clarity: 20, answer_coverage: 12, structure: 10, evidence: 12, structured_data: 10, freshness: 4 },
};

const profileFor = (type) => PROFILE_BY_TYPE[type] || 'content';
const seoWeights = (type) => SEO[profileFor(type)];
const geoWeights = (type) => GEO[profileFor(type)];

module.exports = { PROFILE_BY_TYPE, SEO, GEO, profileFor, seoWeights, geoWeights };
