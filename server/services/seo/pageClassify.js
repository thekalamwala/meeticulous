// server/services/seo/pageClassify.js
// Thin classification layer (Phase 1, spec §1c). Declares — in ONE place — which
// scoring dimensions apply to each page type, and maps a page to its category
// label for the Site → Category → Page hierarchy. It does NOT re-implement the
// per-rule gating that already lives in each rule module (rules self-skip via
// SHOULD_INDEX_TYPES + bodyCrawled); this only tells the SCORER which dimensions
// to average for a given type, so a bodiless host page isn't marked down on
// `content`/`internal_linking` dimensions it can't have.

// The seven per-page scoring dimensions (richer than the 5 site-snapshot columns).
const DIMENSIONS = [
  'crawlability', 'indexability', 'metadata',
  'content', 'internal_linking', 'structured_data', 'semantic',
];

// Registry category → scoring dimension. Everything unmapped falls to 'metadata'
// (the on-page bucket) so a new rule can't silently vanish from the score.
const CATEGORY_DIMENSION = {
  technical: 'crawlability',
  indexability: 'indexability',
  onpage: 'metadata',
  content: 'content',
  links: 'internal_linking',
  internal_linking: 'internal_linking',
  structured_data: 'structured_data',
  semantic: 'semantic',
};

// Host/service pages are crawled meta-only (bodyCrawled:false — no body, links or
// images), so content/internal_linking/structured-body dimensions don't apply and
// must not drag their overall down. Static/blog are full-body. 'unknown' is audited
// for the basics only — never invent a richer type just to run more rules (spec §1c).
const DIMENSIONS_BY_TYPE = {
  static:  DIMENSIONS,
  blog:    DIMENSIONS,
  host:    ['crawlability', 'indexability', 'metadata', 'structured_data', 'semantic'],
  service: ['crawlability', 'indexability', 'metadata', 'structured_data', 'semantic'],
  unknown: ['crawlability', 'indexability'],
};

// Category label for the hierarchy rollups (spec §1d). One level today; kept as a
// function so a sub-category split (e.g. profession vs host) is a one-line change.
const CATEGORY_BY_TYPE = {
  static: 'Static', host: 'Profiles', service: 'Services', blog: 'Blog',
};

const dimensionForCategory = (cat) => CATEGORY_DIMENSION[cat] || 'metadata';
const dimensionsForType = (type) => DIMENSIONS_BY_TYPE[type] || DIMENSIONS_BY_TYPE.unknown;
const categoryForType = (type) => CATEGORY_BY_TYPE[type] || 'Other';

module.exports = {
  DIMENSIONS, DIMENSIONS_BY_TYPE, CATEGORY_DIMENSION,
  dimensionForCategory, dimensionsForType, categoryForType,
};
