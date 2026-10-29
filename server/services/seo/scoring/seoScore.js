// server/services/seo/scoring/seoScore.js
// SEO health score (0-100): weighted dimensions, then hard caps. Pure.
// Each dimension returns { score:0..1, reason, fix, evidence }. The "why not 100"
// list is weight*(1-score) per dimension plus any active cap. See the framework doc.
const { seoWeights, profileFor } = require('./weights');

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const hasIssue = (issues, prefix) => issues.some((i) => String(i.ruleKey || '').startsWith(prefix));

// Content-depth bands (extractable words) per profile. Not word-count targets — above
// the top band earns no extra points (spec: never reward word count).
const DEPTH = {
  content: [[150, 0.25], [350, 0.6], [800, 0.85], [Infinity, 1]],
  blog:    [[300, 0.3], [700, 0.6], [1200, 0.85], [Infinity, 1]],
  service: [[60, 0.35], [150, 0.7], [Infinity, 1]],
  profile: [[80, 0.4], [180, 0.75], [Infinity, 1]],
};
const THIN = { content: 150, blog: 200, service: 40, profile: 50 };
const band = (v, table) => (table.find(([t]) => v <= t) || table[table.length - 1])[1];
const norm = (u) => (u || '').replace(/\/$/, '').toLowerCase();

// Google picked a different canonical (GSC URL Inspection). `stale` = Google's last crawl
// predates our latest crawl, which shows a 200 page with a self-referencing canonical —
// the page is fixed and Google just hasn't recrawled, so don't cap on the old verdict.
function googleCanon(s) {
  const chosen = s.gsc?.google_canonical;
  if (!chosen || norm(chosen) === norm(s.url)) return null;
  const last = s.gsc.last_crawl_time;
  const stale = !!(last && s.crawledAt && new Date(last) < new Date(s.crawledAt)
    && s.httpStatus === 200 && norm(s.canonical) === norm(s.url));
  return { chosen, stale };
}

const DIMS = [
  {
    key: 'indexability', label: 'Indexability & crawlability', evidence: 'official',
    fn: (s) => {
      if (s.httpStatus && s.httpStatus !== 200) return { score: 0, reason: `Returns HTTP ${s.httpStatus} — not indexable.`, fix: 'Restore a 200 response or remove the URL from the sitemap.' };
      if (s.noindex) return { score: 0, reason: 'Page is set to noindex — it cannot appear in Search.', fix: 'Remove the noindex directive if this page should rank.' };
      if (!s.robots.googlebot) return { score: 0.1, reason: 'robots.txt blocks Googlebot from this page.', fix: 'Allow Googlebot in robots.txt.' };
      return { score: 1, reason: 'Indexable and crawlable.', fix: null };
    },
  },
  {
    key: 'canonical', label: 'Canonicalization', evidence: 'official',
    fn: (s) => {
      if (!s.canonical) return { score: 0.6, reason: 'No canonical tag — Google will guess the canonical URL.', fix: 'Add a self-referencing canonical.' };
      const gc = googleCanon(s);
      if (gc?.stale) return { score: 0.8, reason: `Google's last crawl chose ${gc.chosen}, but the page now self-canonicalizes — awaiting recrawl.`, fix: 'Request indexing in Search Console (URL Inspection → Request indexing).' };
      if (gc) return { score: 0.2, reason: `Google chose a different canonical (${gc.chosen}).`, fix: 'Align content/links so Google picks this URL, or intentionally consolidate.' };
      const canon = s.canonical.replace(/\/$/, '');
      if (canon !== s.url.replace(/\/$/, '')) return { score: 0.4, reason: 'Canonical points to a different URL than this page.', fix: 'Point the canonical at this page unless consolidation is intended.' };
      return { score: 1, reason: 'Self-referencing canonical.', fix: null };
    },
  },
  {
    key: 'metadata', label: 'Metadata quality', evidence: 'official',
    fn: (s) => {
      let sc = 0; const notes = [];
      const tl = (s.title || '').length;
      if (s.title && tl >= 25 && tl <= 65) sc += 0.45; else if (s.title) { sc += 0.25; notes.push(tl > 65 ? 'title is too long' : 'title is short'); } else notes.push('no title');
      const dl = (s.metaDescription || '').length;
      if (s.metaDescription && dl >= 70 && dl <= 165) sc += 0.3; else if (s.metaDescription) { sc += 0.15; notes.push('meta description length is off'); } else notes.push('no meta description');
      if (s.h1 && s.h1Count === 1 && !s.h1Generic) sc += 0.25; else if (!s.h1) notes.push('no H1'); else if (s.h1Count > 1) notes.push('multiple H1s'); else if (s.h1Generic) notes.push('generic H1');
      return { score: sc, reason: notes.length ? `Metadata gaps: ${notes.join(', ')}.` : 'Title, description and H1 are well-formed.', fix: notes.length ? 'Write a unique 25–65 char title, a 70–165 char description and one descriptive H1.' : null };
    },
  },
  {
    key: 'content', label: 'Content quality & depth', evidence: 'proxy',
    fn: (s, issues, prof) => {
      const sc = band(s.wordCount, DEPTH[prof]);
      if (s.wordCount < THIN[prof]) return { score: Math.min(sc, 0.25), reason: `Thin content (~${s.wordCount} words) — little for search engines to assess.`, fix: 'Add substantive, original, first-hand detail relevant to the page purpose.' };
      const tmpl = hasIssue(issues, 'content.') ? 0.15 : 0;
      return { score: Math.max(0, sc - tmpl), reason: tmpl ? 'Content looks template-heavy / generic.' : `Content depth is adequate (~${s.wordCount} words).`, fix: tmpl ? 'Replace boilerplate with specific, original detail.' : null };
    },
  },
  {
    key: 'internal_linking', label: 'Internal linking', evidence: 'official',
    fn: (s, issues) => {
      const orphan = hasIssue(issues, 'links.orphan');
      let sc = s.internalOut >= 3 ? 1 : s.internalOut >= 1 ? 0.5 : 0.15;
      if (orphan) sc = Math.min(sc, 0.2);
      const notes = [];
      if (orphan) notes.push('no internal links point to this page (orphan)');
      if (s.internalOut < 3) notes.push(`only ${s.internalOut} contextual outbound link(s)`);
      return { score: sc, reason: notes.length ? `Weak internal linking: ${notes.join('; ')}.` : 'Well linked internally.', fix: notes.length ? 'Add contextual links to and from 3+ relevant pages.' : null };
    },
  },
  {
    key: 'structured_data', label: 'Structured data', evidence: 'official',
    fn: (s, issues) => {
      if (s.hasInvalidJsonLd || hasIssue(issues, 'structured_data.')) return { score: 0.3, reason: 'Structured data is missing, invalid, or the wrong type for this page.', fix: 'Emit valid JSON-LD of a type appropriate to the page, matching visible content.' };
      if (!s.jsonLd.length) return { score: 0.5, reason: 'No structured data.', fix: 'Add JSON-LD appropriate to the page type (e.g. Service, ProfilePage, Article).' };
      return { score: 1, reason: 'Valid, appropriate structured data.', fix: null };
    },
  },
  {
    key: 'media', label: 'Media accessibility', evidence: 'official',
    fn: (s) => {
      const imgs = s.images || [];
      if (!imgs.length) return { score: 1, reason: 'No images to caption.', fix: null };
      const withAlt = imgs.filter((i) => i.alt && i.alt.trim()).length;
      const cov = withAlt / imgs.length;
      return { score: cov, reason: cov === 1 ? 'All images have alt text.' : `${imgs.length - withAlt} of ${imgs.length} images missing alt text.`, fix: cov === 1 ? null : 'Add descriptive alt text to every meaningful image.' };
    },
  },
  {
    key: 'search_performance', label: 'Search performance', evidence: 'official',
    fn: (s) => {
      const g = s.gsc;
      if (!g || (!g.impressions && !g.clicks)) return { score: 0.6, reason: 'No Search Console performance data yet (new or low-visibility page).', fix: null };
      const pos = g.position;
      let sc; let reason; let fix = null;
      if (pos != null && pos <= 10) { sc = g.clicks > 0 ? 1 : 0.7; reason = `Ranking well (avg position ${pos.toFixed(1)}).`; }
      else if (pos != null && pos <= 20) { sc = 0.55; reason = `Ranking on the edge (avg position ${pos.toFixed(1)}) — a push could reach page one.`; fix = 'Strengthen content and internal links for the target query.'; }
      else { sc = 0.35; reason = `Low average position (${pos != null ? pos.toFixed(1) : 'n/a'}).`; fix = 'Improve relevance and depth for the query intent.'; }
      if (g.impressions >= 100 && g.ctr != null && g.ctr < 0.02) { sc = Math.min(sc, 0.45); reason = `High impressions but very low CTR (${(g.ctr * 100).toFixed(1)}%).`; fix = 'Rewrite the title/description to earn the click.'; }
      if (s.intentCoverage != null && s.intentCoverage < 0.5) { sc = Math.min(sc, 0.6); reason += ' Page does not directly address several queries it ranks for.'; fix = fix || 'Add sections that directly answer the ranking queries.'; }
      return { score: sc, reason, fix };
    },
  },
];

function score(sig, issues = []) {
  const prof = profileFor(sig.type);
  const w = seoWeights(sig.type);
  const dimensions = [];
  let raw = 0;
  for (const d of DIMS) {
    const r = d.fn(sig, issues, prof);
    const weight = w[d.key];
    const s01 = Math.max(0, Math.min(1, r.score));
    raw += weight * s01;
    dimensions.push({ key: d.key, label: d.label, weight, score: Math.round(s01 * 100), lost: Math.round(weight * (1 - s01)), reason: r.reason, fix: r.fix, evidence: d.evidence });
  }

  // Hard caps (spec §12) — a cap clamps the final score and is surfaced as the reason.
  const caps = [];
  if (sig.httpStatus && sig.httpStatus !== 200) caps.push({ cap: 20, reason: `HTTP ${sig.httpStatus} — page is broken.` });
  else if (sig.noindex) caps.push({ cap: 30, reason: 'Page is noindex — it cannot rank.' });
  if (!sig.robots.googlebot) caps.push({ cap: 25, reason: 'Blocked from Googlebot in robots.txt.' });
  const gc = googleCanon(sig);
  if (gc && !gc.stale) caps.push({ cap: 55, reason: 'Google canonicalizes this page to a different URL.' });
  if ((prof === 'content' || prof === 'blog') && sig.wordCount < THIN[prof] && sig.httpStatus === 200) caps.push({ cap: 60, reason: 'Thin content — metadata cannot rescue a low-value page.' });

  const capped = caps.reduce((min, c) => Math.min(min, c.cap), 100);
  const final = clamp(Math.min(raw, capped));
  return { score: final, uncapped: clamp(raw), profile: prof, dimensions, caps };
}

module.exports = { score, DIMS, DEPTH, THIN };
