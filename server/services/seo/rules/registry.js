// server/services/seo/rules/registry.js
// Central metadata for every rule. Detection lives in the group modules;
// severity/category/confidence/autoFixable/title live here (one place).
const REGISTRY = {
  // on-page
  'onpage.missing_title':        { category: 'onpage', severity: 'P1', confidence: 1,   autoFixable: false, title: 'Missing <title>' },
  'onpage.title_length':         { category: 'onpage', severity: 'P3', confidence: 0.9, autoFixable: false, title: 'Title too long (truncated in results)' },
  'onpage.duplicate_title':      { category: 'onpage', severity: 'P2', confidence: 0.9, autoFixable: false, title: 'Duplicate title across pages' },
  'onpage.missing_description':  { category: 'onpage', severity: 'P2', confidence: 1,   autoFixable: true,  title: 'Missing meta description' },
  'onpage.description_length':   { category: 'onpage', severity: 'P3', confidence: 0.9, autoFixable: true,  title: 'Meta description too long (truncated)' },
  'onpage.duplicate_description':{ category: 'onpage', severity: 'P3', confidence: 0.9, autoFixable: false, title: 'Duplicate meta description across pages' },
  'onpage.missing_h1':           { category: 'onpage', severity: 'P2', confidence: 1,   autoFixable: false, title: 'Missing H1' },
  'onpage.multiple_h1':          { category: 'onpage', severity: 'P3', confidence: 1,   autoFixable: false, title: 'Multiple H1 tags' },
  'onpage.title_h1_mismatch':    { category: 'onpage', severity: 'P4', confidence: 0.6, autoFixable: false, title: 'Title / H1 mismatch' },
  'onpage.unrendered_title':     { category: 'onpage', severity: 'P1', confidence: 0.9, autoFixable: false, title: 'Serves the generic site title (page not prerendered)' },
  // technical
  'technical.non_200':            { category: 'technical', severity: 'P0', confidence: 1,   autoFixable: false, title: 'Non-200 / unreachable' },
  'technical.redirect':           { category: 'technical', severity: 'P3', confidence: 0.9, autoFixable: false, title: 'URL redirects' },
  'technical.slow_response':      { category: 'technical', severity: 'P3', confidence: 0.7, autoFixable: false, title: 'Slow response' },
  'technical.missing_canonical':  { category: 'technical', severity: 'P2', confidence: 1,   autoFixable: false, title: 'Missing canonical' },
  'technical.canonical_to_other': { category: 'technical', severity: 'P2', confidence: 0.7, autoFixable: false, title: 'Canonical points elsewhere' },
  'technical.missing_viewport':   { category: 'technical', severity: 'P3', confidence: 1,   autoFixable: false, title: 'Missing viewport meta' },
  // indexability
  'indexability.unexpected_noindex':         { category: 'indexability', severity: 'P0', confidence: 0.8, autoFixable: false, title: 'Unexpected noindex on indexable page' },
  'indexability.error_url_in_sitemap':       { category: 'indexability', severity: 'P1', confidence: 1,   autoFixable: false, title: 'Error/redirect URL in sitemap' },
  'indexability.canonical_sitemap_mismatch': { category: 'indexability', severity: 'P2', confidence: 0.8, autoFixable: false, title: 'Canonical ≠ sitemap URL' },
  'indexability.soft_404':                   { category: 'indexability', severity: 'P1', confidence: 0.6, autoFixable: false, title: 'Soft 404 (200 but thin)' },
  'indexability.prerender_regression':       { category: 'indexability', severity: 'P0', confidence: 0.7, autoFixable: false, title: 'Prerender regression (homepage title)' },
  // links / images / structured data / sitemap
  'links.broken_internal':     { category: 'links',          severity: 'P1', confidence: 1,   autoFixable: false, title: 'Broken internal link' },
  'links.orphan_page':         { category: 'internal_linking', severity: 'P2', confidence: 0.7, autoFixable: false, title: 'Orphan page (no internal links)' },
  'images.missing_alt':        { category: 'onpage',         severity: 'P3', confidence: 1,   autoFixable: true,  title: 'Images missing alt text' },
  'schema.missing':            { category: 'structured_data', severity: 'P3', confidence: 0.7, autoFixable: false, title: 'No structured data' },
  'schema.invalid_json':       { category: 'structured_data', severity: 'P2', confidence: 1,   autoFixable: false, title: 'Invalid JSON-LD' },
  'schema.wrong_type':         { category: 'structured_data', severity: 'P3', confidence: 0.6, autoFixable: false, title: 'Missing expected schema type' },
  'sitemap.missing_indexable': { category: 'indexability',   severity: 'P2', confidence: 0.8, autoFixable: false, title: 'Indexable page missing from sitemap' },
  // content quality (Phase 1, spec §1f/§1g) — advisory, never auto-acts
  'content.generic_h1':               { category: 'content',  severity: 'P3', confidence: 0.7, autoFixable: false, title: 'Generic H1' },
  'content.template_heavy':           { category: 'content',  severity: 'P3', confidence: 0.5, autoFixable: false, title: 'Template-heavy / low unique content' },
  'content.potential_cannibalization':{ category: 'content',  severity: 'P3', confidence: 0.5, autoFixable: false, title: 'Potential keyword cannibalization' },
  // semantic / AI readiness (Phase 1, spec §1e) — SEO quality signals, not ranking factors
  'semantic.jsonld_untyped':   { category: 'semantic', severity: 'P3', confidence: 0.7, autoFixable: false, title: 'JSON-LD present but untyped' },
  'semantic.no_headings':      { category: 'semantic', severity: 'P3', confidence: 0.8, autoFixable: false, title: 'No heading structure' },
  'semantic.heading_skip':     { category: 'semantic', severity: 'P4', confidence: 0.6, autoFixable: false, title: 'Heading level skipped' },
  // Google Search Console (gsc-sync → seo_gsc_urls)
  'gsc.google_chose_different_canonical': { category: 'indexability', severity: 'P1', confidence: 0.9, autoFixable: false, title: 'Google chose a different canonical' },
  'gsc.soft_404':               { category: 'indexability', severity: 'P1', confidence: 0.9, autoFixable: false, title: 'Google reports soft 404' },
  'gsc.crawled_not_indexed':    { category: 'indexability', severity: 'P2', confidence: 0.8, autoFixable: false, title: 'Crawled — currently not indexed (GSC)' },
  'gsc.indexable_mismatch':     { category: 'indexability', severity: 'P2', confidence: 0.7, autoFixable: false, title: 'We flag indexable but Google has not indexed it' },
  'gsc.discovered_not_indexed': { category: 'indexability', severity: 'P4', confidence: 0.6, autoFixable: false, title: 'Discovered — not yet indexed (GSC)' },
};
module.exports = { REGISTRY };
