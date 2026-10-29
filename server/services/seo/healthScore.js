// Deterministic health scoring. Never AI-generated.
// Two layers (spec §1b): a hard PASS/WARNING/FAIL status (the source of truth for
// whether a page is OK) and a supporting 0–100 health score. A 95/100 page still
// FAILs if it has a critical (P0) issue — the score never overrides the status.
const { dimensionForCategory, dimensionsForType } = require('./pageClassify');

const PENALTY = { P0: 40, P1: 20, P2: 10, P3: 4, P4: 1 };
// Site-snapshot categories are the seo_score_snapshots columns — do NOT rename or
// drop (persisted contract). `content` is a real bucket now (was an onpage alias).
const CATEGORIES = ['technical', 'onpage', 'indexability', 'internal_linking', 'content'];
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

// ── Site-level snapshot score (persisted per crawl) ──────────────────────────
function score(issues = []) {
  const deducted = {}; const breakdown = {};
  for (const c of CATEGORIES) { deducted[c] = 0; breakdown[c] = []; }
  for (const i of issues) {
    const c = CATEGORIES.includes(i.category) ? i.category : 'onpage'; // semantic/links/schema fold into onpage at site level
    deducted[c] += PENALTY[i.severity] ?? 1;
    breakdown[c].push({ ruleKey: i.ruleKey, severity: i.severity, penalty: PENALTY[i.severity] ?? 1 });
  }
  const technical = clamp(100 - deducted.technical);
  const onpage = clamp(100 - deducted.onpage);
  const indexability = clamp(100 - deducted.indexability);
  const internal_linking = clamp(100 - deducted.internal_linking);
  const content = clamp(100 - deducted.content);
  const overall = clamp((technical + onpage + indexability + internal_linking + content) / 5);
  return { overall, technical, onpage, content, indexability, internal_linking, breakdown };
}

// ── Per-page score + hard status (read-time, spec §1a/§1b) ───────────────────
// A page FAILs on any P0 (critical: non-200, unexpected noindex, bad canonical,
// error URL in sitemap, prerender regression, …). WARNING on any P1/P2. Else PASS.
function statusFor(issues) {
  if (issues.some((i) => i.severity === 'P0')) return 'FAIL';
  if (issues.some((i) => i.severity === 'P1' || i.severity === 'P2')) return 'WARNING';
  return 'PASS';
}

// issues: the issues for ONE url (already decorated with category+severity).
// pageType drives which dimensions are averaged into `health` (a bodiless host
// page isn't scored on content/internal_linking it can't have — pageClassify).
function scorePage(issues = [], pageType = 'static') {
  const dims = dimensionsForType(pageType);
  const deducted = {}; for (const d of dims) deducted[d] = 0;
  for (const i of issues) {
    const d = dimensionForCategory(i.category);
    if (deducted[d] == null) continue; // dimension not applicable to this page type — ignore
    deducted[d] += PENALTY[i.severity] ?? 1;
  }
  const dimensions = {};
  for (const d of dims) dimensions[d] = clamp(100 - deducted[d]);
  const health = dims.length ? clamp(dims.reduce((s, d) => s + dimensions[d], 0) / dims.length) : 100;
  const criticalCount = issues.filter((i) => i.severity === 'P0').length;
  return { status: statusFor(issues), health, dimensions, criticalCount, issueCount: issues.length };
}

module.exports = { score, scorePage, statusFor, PENALTY };
