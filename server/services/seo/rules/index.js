// server/services/seo/rules/index.js
const { REGISTRY } = require('./registry');
const onpage = require('./onpage');
const technical = require('./technical');
const indexability = require('./indexability');
const links = require('./links');
const images = require('./images');
const structuredData = require('./structuredData');
const sitemap = require('./sitemap');
const gsc = require('./gsc');
const semantic = require('./semantic');
const content = require('./content');
const cannibalization = require('./cannibalization');
const GROUPS = [onpage, technical, indexability, links, images, structuredData, sitemap, gsc, semantic, content, cannibalization];

const SHOULD_INDEX_TYPES = new Set(['host', 'service', 'blog', 'static']);

function buildContext(pages, sitemapUrls, gscByUrl = new Map()) {
  const titleCounts = new Map();
  const descCounts = new Map();
  const internalLinkTargets = new Set();
  let homepageTitle = null;
  let homepageUrl = null;
  const siteUrl = process.env.SITE_URL || 'https://bookasloth.com';
  for (const p of pages) {
    if (p.title) titleCounts.set(p.title, (titleCounts.get(p.title) || 0) + 1);
    if (p.metaDescription) descCounts.set(p.metaDescription, (descCounts.get(p.metaDescription) || 0) + 1);
    for (const l of p.links?.internal || []) internalLinkTargets.add(l.replace(/\/$/, ''));
    if (p.url === siteUrl || p.url === `${siteUrl}/`) { homepageTitle = p.title; homepageUrl = p.url; }
  }
  // Shell title = the SPA's built index.html <title>, which un-prerendered routes
  // serve verbatim. It is NOT the homepage title (the homepage is prerendered to its
  // own title). Detect it as the one title shared by many pages: every page should
  // have a unique title, so a title repeated >= SHELL_TITLE_MIN times is the generic
  // fallback. Pages carrying it were not prerendered for non-JS clients.
  const SHELL_TITLE_MIN = Number(process.env.SEO_SHELL_TITLE_MIN) || 5;
  let shellTitle = null; let shellMax = 0;
  for (const [t, c] of titleCounts) { if (c > shellMax) { shellMax = c; shellTitle = t; } }
  if (shellMax < SHELL_TITLE_MIN) shellTitle = null;
  return { pages, sitemapUrls: sitemapUrls || new Set(), titleCounts, descCounts,
    internalLinkTargets, homepageTitle, homepageUrl, shellTitle, SHOULD_INDEX_TYPES, gscByUrl };
}

function decorate(raw) {
  const meta = REGISTRY[raw.ruleKey] || { category: 'other', severity: 'P4', confidence: 0.5, autoFixable: false, title: raw.ruleKey };
  return { ruleKey: raw.ruleKey, affectedUrl: raw.affectedUrl, evidence: raw.evidence || {},
    category: meta.category, severity: meta.severity, confidence: meta.confidence,
    autoFixable: meta.autoFixable, title: meta.title, detail: raw.detail || null };
}

function runRules(pageData, ctx) {
  const out = [];
  for (const g of GROUPS) if (typeof g.check === 'function') for (const r of g.check(pageData, ctx)) out.push(decorate(r));
  return out;
}
function runSiteRules(ctx) {
  const out = [];
  for (const g of GROUPS) if (typeof g.siteCheck === 'function') for (const r of g.siteCheck(ctx)) out.push(decorate(r));
  return out;
}
module.exports = { buildContext, runRules, runSiteRules, GROUPS };
