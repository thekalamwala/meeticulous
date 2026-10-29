// server/services/seo/rules/structuredData.js
// Detection only. JSON-LD presence/validity/type per page type. 'static' has no expected type — skipped.
const EXPECTED_TYPES = {
  host: ['Person', 'ProfilePage'],
  service: ['Service', 'Product'],
  blog: ['Article', 'BlogPosting'],
};
const typesOf = (entry) => {
  const t = entry && entry['@type'];
  if (!t) return [];
  return Array.isArray(t) ? t : [t];
};

function check(p, ctx) {
  const out = [];
  const at = p.url;
  const push = (ruleKey, evidence) => out.push({ ruleKey, affectedUrl: at, evidence });
  if (!p.pageType || !ctx.SHOULD_INDEX_TYPES.has(p.pageType)) return out; // only audit indexable page types
  if (p.httpStatus !== 200) return out;

  const jsonLd = p.jsonLd || [];
  const invalidCount = jsonLd.filter((e) => e && e.__invalid).length;
  if (invalidCount > 0) push('schema.invalid_json', { count: invalidCount });

  const expected = EXPECTED_TYPES[p.pageType]; // no entry for 'static' -> not schema-expected
  // Structured data is only *expected* on entity pages (host/service/blog). Generic
  // static/legal pages (privacy, terms, LP...) legitimately have none — don't flag them.
  if (!expected) return out;
  if (jsonLd.length === 0) { push('schema.missing', {}); return out; }
  const found = jsonLd.flatMap(typesOf);
  if (!found.some((t) => expected.includes(t))) push('schema.wrong_type', { expected, found });
  return out;
}
module.exports = { check };
