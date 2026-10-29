// server/services/seo/fixes/planner.js
// Maps a crawl issue to a proposed fix: which field/target, which generator, and a
// BASE approval level. Protection can only ever DEMOTE (AUTO→REVIEW→DO_NOT), never
// promote (spec §2d/§2e) — so a bug in one layer can't make an unsafe change safer.
const gen = require('./generators');

// Only rules listed here produce a proposal. Everything else is reported by the
// audit but has no automated fix path in Phase 2 (conservative by design).
const PLANS = {
  'technical.missing_canonical': { field: 'canonical',        gen: gen.canonical,   base: 'AUTO',   target: (t) => (t === 'host' || t === 'service' ? 'prerender' : 'meta_builder') },
  'onpage.missing_description':  { field: 'meta_description',  gen: gen.description, base: 'REVIEW', target: (t) => (t === 'host' || t === 'service' ? 'db_field' : 'meta_builder') },
  'images.missing_alt':          { field: 'alt',              gen: gen.alt,         base: 'REVIEW', target: () => 'content' },
  'onpage.missing_h1':           { field: 'h1',               gen: gen.contentPack, base: 'REVIEW', target: () => 'content' },
  'content.generic_h1':          { field: 'h1',               gen: gen.contentPack, base: 'REVIEW', target: () => 'content' },
  'indexability.soft_404':       { field: 'body',             gen: gen.contentPack, base: 'REVIEW', target: () => 'content' },
  'content.template_heavy':          { field: null, gen: gen.advisory, base: 'DO_NOT', target: () => 'content' },
  'content.potential_cannibalization': { field: null, gen: gen.advisory, base: 'DO_NOT', target: () => 'content' },
};

// URLs that must never be auto-changed (spec §2d DO_NOT_AUTO_CHANGE): legal pages.
const DO_NOT_URL = /\/(terms|privacy|refund|legal|cancellation|shipping|disclaimer|cookies?)(\/|$|-)/i;

const RANK = { AUTO: 3, REVIEW: 2, DO_NOT: 1 };
const demote = (level, floor) => (RANK[floor] < RANK[level] ? floor : level);

const planForRule = (ruleKey) => PLANS[ruleKey] || null;

// Decide the final approval level. `counters` carries running AUTO tallies for the
// blast-radius caps; mutated as AUTO fixes are granted.
function classify(issue, page, plan, counters, caps) {
  let level = plan.base;
  const ugc = page.page_type === 'host' || page.page_type === 'service';

  // UGC pages: never auto-change user-generated identity/content — REVIEW at most.
  if (ugc) level = demote(level, 'REVIEW');
  // Legal / do-not-touch URLs: force human review regardless of rule.
  if (DO_NOT_URL.test(page.url)) level = demote(level, 'REVIEW');
  // Strong historical evidence + a content change: protect it (spec §2d).
  if (plan.target(page.page_type) === 'content' && page.evidence_maturity === 'STRONG') level = demote(level, 'REVIEW');

  // Blast-radius (spec §2e): once any AUTO cap is hit, further AUTO fixes fall to
  // REVIEW rather than being applied en masse. Never blocks — only demotes.
  if (level === 'AUTO') {
    const rule = issue.rule_key; const cat = page.category || page.page_type;
    const overRun = counters.autoTotal >= caps.total;
    const overUrl = counters.autoUrls.size >= caps.urls && !counters.autoUrls.has(page.url);
    const overRule = (counters.autoByRule[rule] || 0) >= caps.perRule;
    const overCat = (counters.autoByCat[cat] || 0) >= caps.perCategory;
    if (overRun || overUrl || overRule || overCat) level = 'REVIEW';
    else {
      counters.autoTotal++; counters.autoUrls.add(page.url);
      counters.autoByRule[rule] = (counters.autoByRule[rule] || 0) + 1;
      counters.autoByCat[cat] = (counters.autoByCat[cat] || 0) + 1;
    }
  }
  return level;
}

const CAPS = {
  total: Number(process.env.SEO_FIX_MAX_TOTAL) || 50,
  urls: Number(process.env.SEO_FIX_MAX_URLS) || 40,
  perRule: Number(process.env.SEO_FIX_MAX_PER_RULE) || 20,
  perCategory: Number(process.env.SEO_FIX_MAX_PER_CATEGORY) || 25,
};
const newCounters = () => ({ autoTotal: 0, autoUrls: new Set(), autoByRule: {}, autoByCat: {} });

module.exports = { PLANS, planForRule, classify, CAPS, newCounters, DO_NOT_URL, demote };
