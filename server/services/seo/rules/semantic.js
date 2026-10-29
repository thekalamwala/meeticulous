// server/services/seo/rules/semantic.js
// Detection only (spec §1e). AI/machine-readiness signals derivable from the crawl.
// These are SEO QUALITY signals, not claimed Google ranking factors. Only net-new
// checks live here — JSON-LD presence (schema.missing) and expected-type
// (schema.wrong_type) already belong to structuredData.js; we don't duplicate them.
function check(p, ctx) {
  const out = [];
  const at = p.url;
  const push = (ruleKey, evidence) => out.push({ ruleKey, affectedUrl: at, evidence });
  if (!p.pageType || !ctx.SHOULD_INDEX_TYPES.has(p.pageType)) return out;
  if (p.httpStatus !== 200) return out;

  // JSON-LD present but every node is untyped → machines can't classify the entity.
  // Distinct from schema.missing (zero nodes) and schema.wrong_type (wrong @type).
  const nodes = (p.jsonLd || []).filter((n) => n && !n.__invalid);
  if (nodes.length && nodes.every((n) => !n['@type'])) push('semantic.jsonld_untyped', { count: nodes.length });

  // Heading-structure checks need a real body (host/service are meta-only).
  if (p.bodyCrawled === false) return out;
  const headings = p.headings || [];
  if (headings.length === 0) { push('semantic.no_headings', {}); return out; }
  // Level skip: document should start at h1 and never jump a level (h1→h3).
  const levels = headings.map((h) => Number(String(h.tag).replace('h', '')) || 0).filter(Boolean);
  if (levels.length) {
    let prev = levels[0];
    if (prev > 1) push('semantic.heading_skip', { firstLevel: prev });
    else {
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] - prev > 1) { push('semantic.heading_skip', { from: prev, to: levels[i] }); break; }
        prev = levels[i];
      }
    }
  }
  return out;
}
module.exports = { check };
