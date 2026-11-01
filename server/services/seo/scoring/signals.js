// server/services/seo/scoring/signals.js
// Normalizes one crawled page (+ its GSC data + robots map) into a uniform signal
// object the SEO and GEO scorers read. Pure — no I/O. See docs/seo-scoring-framework.md.

const ENTITY_TYPES = ['Organization', 'Person', 'ProfilePage', 'Service', 'LocalBusiness', 'Product', 'Article', 'BlogPosting'];
const GENERIC_H1 = new Set(['meeticulous', 'home', 'welcome', 'untitled', 'services', 'profile']);

const lc = (s) => String(s || '').toLowerCase();
const uniqueHosts = (urls = []) => {
  const hosts = new Set();
  for (const u of urls) { try { hosts.add(new URL(u).host); } catch { /* skip */ } }
  return hosts.size;
};

// Statistics: percentages, money, or standalone multi-digit numbers. A proxy for
// "the page makes concrete factual claims" (Princeton GEO signal). Capped count.
function countStats(text) {
  const m = String(text || '').match(/\b\d+(?:[.,]\d+)?\s?%|[₹$€£]\s?\d[\d,]*|\b\d{2,}(?:[.,]\d{3})*\b/g);
  return m ? m.length : 0;
}
// Quoted passages of some length (attribution not verified — proxy only).
function countQuotes(text) {
  const m = String(text || '').match(/[“"][^“”"]{20,}[”"]/g);
  return m ? m.length : 0;
}

// Body signals differ by page type: host/service carry a DB content model, static/
// blog carry real parsed signals in raw_signals + the page columns.
function bodyFrom(page) {
  const raw = page.raw_signals || {};
  const cm = raw.contentModel;
  if (cm) {
    return {
      headings: cm.headings || [],
      links: cm.links || { internal: [], external: [] },
      images: cm.images || [],
      wordCount: cm.wordCount || 0,
      bodyText: cm.bodyText || '',
      jsonLd: raw.jsonLd || [],
      entity: cm.entity || null,
      evidence: cm.evidence || { reviewCount: 0, avgRating: 0 },
      source: 'content-model',
    };
  }
  return {
    headings: raw.headings || [],
    links: raw.links || { internal: [], external: [] },
    images: raw.images || [],
    wordCount: page.word_count || 0,
    bodyText: raw.bodyText || '',
    jsonLd: raw.jsonLd || [],
    entity: null,
    evidence: { reviewCount: 0, avgRating: 0 },
    source: page.page_type === 'host' || page.page_type === 'service' ? 'meta-only' : 'crawled',
  };
}

function extract(page, { gsc = null, queries = [], robots = {} } = {}) {
  const body = bodyFrom(page);
  const robotsStr = lc(page.robots);
  const noindex = robotsStr.includes('noindex');
  const nosnippet = robotsStr.includes('nosnippet');
  const h1s = (body.headings || []).filter((h) => h.tag === 'h1' && h.text);
  const primaryH1 = h1s[0]?.text || (Array.isArray(page.h1) ? page.h1[0] : null);

  const jsonLdTypes = (body.jsonLd || [])
    .flatMap((n) => (n && n['@type'] ? [n['@type']] : []))
    .flat()
    .map((t) => String(t));
  const hasEntitySchema = jsonLdTypes.some((t) => ENTITY_TYPES.includes(t));
  const hasInvalidJsonLd = (body.jsonLd || []).some((n) => n && n.__invalid);

  const externalCitations = uniqueHosts(body.links?.external || []);

  // Author. Blog/article JSON-LD is a @graph: the article node references the author
  // by @id ({ author: { '@id': '…#author' } }) and a separate Person node carries the
  // name + sameAs. Resolve the reference, and fall back to any standalone Person node —
  // otherwise every referenced-author page reads as "no author".
  const nodes = body.jsonLd || [];
  const byId = new Map(nodes.filter((n) => n && n['@id']).map((n) => [n['@id'], n]));
  const nodeName = (a) => {
    if (!a) return null;
    if (typeof a === 'string') return a;
    if (a.name) return a.name;
    if (a['@id'] && byId.get(a['@id'])) return byId.get(a['@id']).name || null;
    return null;
  };
  const typesOf = (n) => { const t = n && n['@type']; return Array.isArray(t) ? t : (t ? [t] : []); };
  let author = body.entity?.author || null;
  let authorNode = null;
  if (!author) {
    for (const n of nodes) {
      const nm = nodeName(n?.author);
      if (nm) { author = nm; authorNode = (n.author && n.author['@id'] && byId.get(n.author['@id'])) || (typeof n.author === 'object' ? n.author : null); break; }
    }
  }
  if (!author) {
    authorNode = nodes.find((n) => typesOf(n).includes('Person') && n.name) || null;
    if (authorNode) author = authorNode.name;
  }

  // External identity links (sameAs) for entity_clarity: prefer the author Person's
  // links, else the Organization node's. Blogs carry no DB `entity`, so read jsonLd.
  const toArr = (v) => (Array.isArray(v) ? v : (v ? [v] : []));
  const orgNode = nodes.find((n) => typesOf(n).includes('Organization'));
  const sameAs = [...new Set([...toArr(authorNode?.sameAs), ...toArr(orgNode?.sameAs)])];

  // Intent coverage: of the top ranking queries, how many have their terms present in
  // the page's title/headings/body. Direct measure of "does the page address what it
  // ranks for" (spec §5). Only meaningful when GSC queries exist.
  const haystack = lc([page.title, page.meta_description, ...(body.headings || []).map((h) => h.text), body.bodyText].join(' '));
  const topQueries = [...queries].sort((a, b) => (b.impressions || 0) - (a.impressions || 0)).slice(0, 10);
  const covered = topQueries.filter((q) => {
    const terms = lc(q.query).split(/\s+/).filter((t) => t.length > 2);
    if (!terms.length) return false;
    const hit = terms.filter((t) => haystack.includes(t)).length;
    return hit / terms.length >= 0.6;
  }).length;
  const intentCoverage = topQueries.length ? covered / topQueries.length : null;

  const dates = body.entity?.dates || {};
  const hasDate = !!(dates.published || dates.updated || (body.jsonLd || []).some((n) => n?.datePublished || n?.dateModified));

  return {
    type: page.page_type,
    url: page.url,
    httpStatus: page.http_status,
    crawledAt: page.created_at || null,
    indexable: page.indexable !== false,
    noindex, nosnippet, robotsStr,
    title: page.title, metaDescription: page.meta_description,
    canonical: page.canonical,
    h1: primaryH1, h1Count: h1s.length, h1Generic: primaryH1 ? GENERIC_H1.has(lc(primaryH1)) : false,
    headings: body.headings, headingCount: (body.headings || []).length,
    links: body.links,
    internalOut: (body.links?.internal || []).length,
    images: body.images,
    wordCount: body.wordCount,
    bodyText: body.bodyText,
    bodySource: body.source,
    jsonLd: body.jsonLd, jsonLdTypes, hasEntitySchema, hasInvalidJsonLd,
    externalCitations, author, hasAuthor: !!author,
    sameAs, hasSameAs: sameAs.length > 0,
    entity: body.entity,
    reviewCount: body.evidence?.reviewCount || 0,
    stats: countStats(body.bodyText),
    quotes: countQuotes(body.bodyText),
    hasDate,
    extractable: body.wordCount >= 40,
    gsc, queries,
    intentCoverage,
    // crawler access (default true when robots map absent — fail open)
    robots: {
      googlebot: robots.googlebot !== false,
      oaiSearchBot: robots.oaiSearchBot !== false,
      chatgptUser: robots.chatgptUser !== false,
      claudeSearchBot: robots.claudeSearchBot !== false,
      claudeUser: robots.claudeUser !== false,
      gptBot: robots.gptBot !== false,
      claudeBot: robots.claudeBot !== false,
    },
  };
}

module.exports = { extract, countStats, countQuotes, ENTITY_TYPES };
