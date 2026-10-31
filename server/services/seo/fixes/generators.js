// server/services/seo/fixes/generators.js
// Deterministic proposal builders (Phase 2, spec §2b/§2c). Every value comes from
// REAL crawl/page data — never fabricated stats, reviews, credentials or claims.
// Content problems produce a CONTEXT PACK (no generated prose): Claude Code writes
// the copy in-session. Each generator returns { newValue, reason, confidence,
// context } — newValue null means "human/Claude Code supplies it".

const SITE_URL = (process.env.SITE_URL || 'https://meeticulous.com').replace(/\/$/, '');

const slugWords = (s) => String(s || '').split(/[\/\-_]/).filter(Boolean).map((w) => w.replace(/[^a-z0-9]/gi, '')).filter(Boolean);
// Best-effort primary entity/topic from the URL path + title — labelled as a hint,
// never asserted as fact.
function deriveEntity(page) {
  try {
    const path = new URL(page.url).pathname.replace(/\/$/, '');
    const last = path.split('/').filter(Boolean).pop() || 'home';
    return slugWords(last).join(' ') || last;
  } catch { return null; }
}

// Self-canonical — the one genuinely deterministic, safe technical fix.
function canonical(page) {
  return { newValue: page.url, confidence: 0.95, reason: 'Page has no canonical; a self-referential canonical is unambiguous.', context: {} };
}

// Missing meta description → REVIEW with a context pack, NOT auto-written copy
// (deterministic marketing copy would be exactly the SEO filler the spec forbids).
function description(page) {
  return {
    newValue: null, confidence: 0.6,
    reason: 'Page has no meta description. Draft one (≤160 chars) from the real page content below.',
    context: { entity: deriveEntity(page), title: page.title || null, h1: (page.h1 || [])[0] || null, page_type: page.page_type },
  };
}

// Missing alt → REVIEW. Suggest words from the filename only as a starting hint;
// alt text needs a human/Claude Code to confirm it describes the actual image.
function alt(page) {
  const imgs = ((page.raw_signals && page.raw_signals.images) || []).filter((i) => !i.alt);
  const suggestions = imgs.slice(0, 10).map((i) => ({ src: i.src, suggested: slugWords((i.src || '').split('/').pop().replace(/\.[a-z0-9]+$/i, '')).join(' ') || null }));
  return { newValue: null, confidence: 0.4, reason: `${imgs.length} image(s) missing alt text. Confirm alt describes each image.`, context: { images: suggestions } };
}

// Content/structure problems → pure context pack, no text (spec §2c).
function contentPack(page, issue, siblings = []) {
  return {
    newValue: null, confidence: 0.5,
    reason: 'Needs content work — draft in-session from real page + site data (no fabrication).',
    context: {
      entity: deriveEntity(page), topic: page.title || deriveEntity(page), intent: null,
      page_type: page.page_type, existing_title: page.title || null, existing_h1: (page.h1 || [])[0] || null,
      word_count: page.word_count, rule: issue.rule_key, detail: issue.detail || null,
      siblings: siblings.slice(0, 5).map((s) => s.url),
    },
  };
}

// Advisory-only (cannibalization / template) — a recommendation, never a value.
function advisory(page, issue) {
  const recs = issue.rule_key === 'content.potential_cannibalization'
    ? ['differentiate', 'consolidate', 'redirect', 'reposition', 'keep both if intents genuinely differ']
    : ['add unique content', 'differentiate from siblings', 'consolidate if truly duplicate'];
  return { newValue: null, confidence: issue.confidence || 0.5, reason: 'Advisory — human decision required. The system never merges/redirects/deletes automatically.', context: { recommendations: recs, evidence: issue.evidence || {} } };
}

module.exports = { canonical, description, alt, contentPack, advisory, deriveEntity, SITE_URL };
