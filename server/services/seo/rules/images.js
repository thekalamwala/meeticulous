// server/services/seo/rules/images.js
// Detection only. Image accessibility/SEO — missing alt text.
function check(p, ctx) {
  const out = [];
  if (p.httpStatus !== 200) return out;
  if (p.bodyCrawled === false) return out;

  const missing = (p.images || []).filter((img) => img.alt === null);
  if (missing.length > 0) {
    const srcs = missing.map((img) => img.src);
    out.push({ ruleKey: 'images.missing_alt', affectedUrl: p.url, evidence: { count: srcs.length, sample: srcs.slice(0, 5) } });
  }
  return out;
}
module.exports = { check };
