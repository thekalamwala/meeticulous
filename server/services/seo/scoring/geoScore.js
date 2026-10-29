// server/services/seo/scoring/geoScore.js
// GEO/AEO diagnostic score (0-100): readiness for AI answer engines to understand,
// retrieve and cite the page. NOT any engine's ranking formula. Weighted dimensions
// then hard caps, same shape as seoScore. Evidence levels per docs/seo-scoring-framework.md.
const { geoWeights, profileFor } = require('./weights');

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

const DIMS = [
  {
    key: 'crawler_access', label: 'AI-crawler access', evidence: 'official',
    fn: (s) => {
      const r = s.robots;
      // Search/answer crawlers only. Training bots (GPTBot/ClaudeBot) are NOT scored.
      const parts = [[r.googlebot, 0.25], [r.oaiSearchBot, 0.25], [r.claudeSearchBot, 0.25], [r.claudeUser, 0.15], [!s.nosnippet, 0.10]];
      const sc = parts.reduce((a, [ok, w]) => a + (ok ? w : 0), 0);
      const blocked = [];
      if (!r.googlebot) blocked.push('Googlebot');
      if (!r.oaiSearchBot) blocked.push('OAI-SearchBot');
      if (!r.claudeSearchBot) blocked.push('Claude-SearchBot');
      if (!r.claudeUser) blocked.push('Claude-User');
      if (s.nosnippet) blocked.push('nosnippet set');
      return { score: sc, reason: blocked.length ? `AI/search crawlers restricted: ${blocked.join(', ')}.` : 'All relevant search/AI crawlers are allowed.', fix: blocked.length ? 'Allow OAI-SearchBot, Claude-SearchBot, Claude-User and Googlebot in robots.txt (training bots can stay blocked).' : null };
    },
  },
  {
    key: 'extractability', label: 'Text extractability', evidence: 'official',
    fn: (s) => {
      if (s.bodySource === 'meta-only') return { score: 0.3, reason: 'Page content could not be read as text (rendered client-side / behind a block).', fix: 'Ensure key content is server-rendered as text.' };
      if (!s.extractable) return { score: 0.2, reason: 'Almost no extractable text on the page.', fix: 'Put the important content in the HTML as text, not locked in images or JS.' };
      return { score: 1, reason: 'Important content is available as extractable text.', fix: null };
    },
  },
  {
    key: 'entity_clarity', label: 'Entity clarity', evidence: 'official',
    fn: (s) => {
      let sc = 0; const miss = [];
      if (s.hasEntitySchema) sc += 0.4; else miss.push('no Organization/Person/Service schema');
      if (s.hasAuthor) sc += 0.25; else miss.push('no named author/provider');
      if (s.entity?.name || s.title) sc += 0.15; else miss.push('unclear subject');
      if ((s.entity?.sameAs || s.sameAs || []).length) sc += 0.2; else miss.push('no sameAs / external identity links');
      return { score: sc, reason: miss.length ? `Weak entity signals: ${miss.join(', ')}.` : 'Clear entity: who/what the page is about is well established.', fix: miss.length ? 'Name the person/organization, add ProfilePage/Organization schema and sameAs links.' : null };
    },
  },
  {
    key: 'answer_coverage', label: 'Answer coverage', evidence: 'industry',
    fn: (s) => {
      if (s.intentCoverage != null) {
        const fix = s.intentCoverage < 0.7 ? 'Add sections that directly answer the queries this page ranks for.' : null;
        return { score: s.intentCoverage, reason: `Directly addresses ${Math.round(s.intentCoverage * 100)}% of its top ranking queries.`, fix };
      }
      const sc = s.headingCount >= 3 && s.wordCount >= 150 ? 0.6 : 0.35;
      return { score: sc, reason: 'No query data yet — judged on structure only.', fix: 'Structure the page around the questions a reader/AI would ask.' };
    },
  },
  {
    key: 'structure', label: 'Structure & extractable blocks', evidence: 'industry',
    fn: (s) => {
      const sc = s.headingCount >= 4 ? 1 : s.headingCount >= 2 ? 0.7 : s.headingCount === 1 ? 0.4 : 0.2;
      return { score: sc, reason: sc >= 1 ? 'Clear heading outline with extractable sections.' : `Only ${s.headingCount} heading(s) — content is hard to extract in pieces.`, fix: sc >= 1 ? null : 'Break content into clearly-headed, self-contained sections.' };
    },
  },
  {
    key: 'evidence', label: 'Evidence', evidence: 'industry',
    fn: (s) => {
      let sc = 0; const miss = [];
      if (s.stats >= 3) sc += 0.35; else miss.push('few concrete statistics');
      if (s.externalCitations >= 2) sc += 0.4; else if (s.externalCitations >= 1) sc += 0.2; else miss.push('no citations to sources');
      if (s.quotes >= 1) sc += 0.15; else miss.push('no quotations');
      if (s.reviewCount >= 3) sc += 0.15; // first-party proof (service/profile)
      sc = Math.min(1, sc);
      return { score: sc, reason: miss.length ? `Thin supporting evidence: ${miss.join(', ')}.` : 'Backed by statistics, citations and/or quotations.', fix: miss.length ? 'Add concrete statistics, quotations and citations to reputable sources.' : null };
    },
  },
  {
    key: 'structured_data', label: 'Structured-data validity', evidence: 'official',
    fn: (s, issues) => {
      if (s.hasInvalidJsonLd || issues.some((i) => String(i.ruleKey || '').startsWith('structured_data.'))) return { score: 0.3, reason: 'Structured data invalid or mismatched to visible content.', fix: 'Emit valid JSON-LD that matches what the page shows.' };
      if (!s.jsonLd.length) return { score: 0.5, reason: 'No structured data to help machines parse the page.', fix: 'Add appropriate JSON-LD.' };
      return { score: 1, reason: 'Valid structured data present.', fix: null };
    },
  },
  {
    key: 'freshness', label: 'Freshness', evidence: 'heuristic',
    fn: (s) => {
      if (s.hasDate) return { score: 1, reason: 'Published/updated date is present.', fix: null };
      return { score: 0.4, reason: 'No visible published or updated date.', fix: 'Show a published/updated date where recency matters.' };
    },
  },
];

function score(sig, issues = []) {
  const w = geoWeights(sig.type);
  const dimensions = [];
  let raw = 0;
  for (const d of DIMS) {
    const r = d.fn(sig, issues);
    const weight = w[d.key];
    const s01 = Math.max(0, Math.min(1, r.score));
    raw += weight * s01;
    dimensions.push({ key: d.key, label: d.label, weight, score: Math.round(s01 * 100), lost: Math.round(weight * (1 - s01)), reason: r.reason, fix: r.fix, evidence: d.evidence });
  }

  const caps = [];
  if (sig.noindex) caps.push({ cap: 25, reason: 'noindex — ineligible for Google AI Overviews.' });
  if (sig.nosnippet) caps.push({ cap: 40, reason: 'nosnippet — explicitly ineligible for snippet/AI citation.' });
  if (!sig.robots.oaiSearchBot && !sig.robots.claudeSearchBot) caps.push({ cap: 45, reason: 'Both OAI-SearchBot and Claude-SearchBot are blocked.' });
  if (!sig.extractable && sig.bodySource !== 'meta-only') caps.push({ cap: 50, reason: 'No extractable text for an AI engine to quote.' });

  const capped = caps.reduce((min, c) => Math.min(min, c.cap), 100);
  const final = clamp(Math.min(raw, capped));
  return { score: final, uncapped: clamp(raw), profile: profileFor(sig.type), dimensions, caps };
}

module.exports = { score, DIMS };
