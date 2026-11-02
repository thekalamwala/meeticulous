// server/services/seo/seoCrawler.js
const sm = require('../sitemapService');
const { fetchUrl } = require('./seoFetch');
const { parse } = require('./seoParse');
const { buildContext, runRules, runSiteRules } = require('./rules');
const { prioritize } = require('./prioritize');
const { score } = require('./healthScore');
const persist = require('./seoPersist');
const { runLocked } = require('../../utils/jobLock');
const { supabaseAdmin } = require('../../config/supabase');

const SITE_URL = (process.env.SITE_URL || 'https://meeticulous.com').replace(/\/$/, '');
const CONCURRENCY = Number(process.env.SEO_CRAWL_CONCURRENCY) || 4;
const DELAY_MS = Number(process.env.SEO_CRAWL_DELAY_MS) || 150;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function seedUrls() {
  const out = [];
  const seen = new Set();
  const add = (url, pageType) => { if (!seen.has(url)) { seen.add(url); out.push({ url, pageType, inSitemap: true }); } };
  // Use the exact loc the public sitemap emits (root stays `/` — stripping it to
  // the bare apex made the crawler fetch a URL that 301s to `/`, then flag its own
  // mangled URL as indexability.error_url_in_sitemap).
  for (const e of sm.staticEntries(SITE_URL)) add(e.loc, 'static');
  for (const h of await sm.fetchHosts()) add(sm.hostUrl(SITE_URL, h.username), 'host');
  for (const s of await sm.fetchServices()) if (s.profiles?.username) add(sm.serviceUrl(SITE_URL, s.profiles.username, s.slug), 'service');
  for (const b of await sm.fetchBlogs()) add(`${SITE_URL}/blog/${b.slug}`, 'blog');
  // Profession pages live at /services/:slug (what professionEntries publishes to
  // Google) — NOT /for/:slug (that route is the hardcoded marketing landings; a DB
  // slug there renders a noindex 404). Auditing /for/ produced 47 phantom soft_404s.
  // The /services hub (professionEntries' root loc) is NOT in staticEntries — seed it
  // too, or the crawler never visits the page that links all /services/:slug and
  // flags every one as links.orphan_page.
  add(`${SITE_URL}/services`, 'static');
  for (const p of await sm.fetchProfessions()) add(`${SITE_URL}/services/${p.slug}`, 'static');
  return out;
}

// Host/service pages are resolved in-process via prerenderController instead
// of an HTTP fetch: Cloudflare 403-blocks the crawler's UA (any UA, bot or
// browser, is a gamble for AI-crawler-shaped traffic), but the meta these
// pages need is exactly what the same DB builders behind the live prerender
// route already compute — no HTTP round-trip required, so the block never
// applies. Trade-off: the meta shell has no body, so link/image/orphan rules
// don't apply to host/service pages in P1 — acceptable, their audit value is
// meta + indexability, not on-page content.
async function crawlPrerendered(seed) {
  const { resolveProfileMeta, resolveServiceMeta } = require('../../controllers/prerenderController');
  const started = Date.now();
  try {
    const prefix = `${SITE_URL}/`;
    const rest = seed.url.startsWith(prefix) ? seed.url.slice(prefix.length) : seed.url;
    const [username, serviceSlug] = rest.split('/');
    const m = seed.pageType === 'service'
      ? await resolveServiceMeta(username, serviceSlug)
      : await resolveProfileMeta(username);
    const responseMs = Date.now() - started;
    const args = m.buildHtmlArgs || {};
    const robots = args.robots ? String(args.robots).toLowerCase() : null;
    // DB-derived content model for the new SEO/GEO scorer only. We deliberately keep
    // bodyCrawled:false and the top-level parsed fields empty so the EXISTING rule
    // engine's behaviour for host/service pages is unchanged (no new orphan/broken-
    // link noise); the v2 scorer reads raw_signals.contentModel directly instead.
    // wordCount is the exception: every rule that reads it is gated on bodyCrawled,
    // so persisting the real count (seo_crawl_pages.word_count) adds no rule noise.
    const contentModel = require('./pageContentModel').build(seed.pageType, m.payload);
    return {
      url: seed.url, pageType: seed.pageType, inSitemap: seed.inSitemap,
      httpStatus: m.status, finalUrl: seed.url,
      redirectChain: m.status === 301 ? [seed.url, m.redirectTo] : [],
      responseMs, contentType: 'text/html',
      title: args.title || null, metaDescription: args.description || null, canonical: args.canonical || null,
      robots, h1: [], headings: [],
      links: { internal: [], external: [] }, images: [], jsonLd: args.jsonLd ? [args.jsonLd] : [],
      wordCount: contentModel?.wordCount || 0, viewport: 'width=device-width,initial-scale=1', bodyCrawled: false, contentModel,
      indexable: m.status === 200 && !(robots && robots.includes('noindex')), fetchError: null,
    };
  } catch (err) {
    return {
      url: seed.url, pageType: seed.pageType, inSitemap: seed.inSitemap,
      httpStatus: null, finalUrl: seed.url, redirectChain: [], responseMs: Date.now() - started, contentType: null,
      title: null, metaDescription: null, canonical: null, robots: null, h1: [], headings: [],
      links: { internal: [], external: [] }, images: [], jsonLd: [],
      wordCount: 0, viewport: null, bodyCrawled: false, indexable: false, fetchError: err.message || String(err),
    };
  }
}

async function crawlOne(seed) {
  if (seed.pageType === 'host' || seed.pageType === 'service') return crawlPrerendered(seed);
  const r = await fetchUrl(seed.url);
  const parsed = r.status === 200 && (r.contentType || '').includes('html') ? parse(r.body, r.headers) : {};
  const noindex = parsed.robots ? parsed.robots.includes('noindex') : false;
  return {
    url: seed.url, pageType: seed.pageType, inSitemap: seed.inSitemap,
    httpStatus: r.status, finalUrl: r.finalUrl, redirectChain: r.redirectChain, responseMs: r.responseMs, contentType: r.contentType,
    title: parsed.title || null, metaDescription: parsed.metaDescription || null, canonical: parsed.canonical || null,
    robots: parsed.robots || null, h1: parsed.h1 || [], headings: parsed.headings || [],
    links: parsed.links || { internal: [], external: [] }, images: parsed.images || [], jsonLd: parsed.jsonLd || [],
    wordCount: parsed.wordCount || 0, viewport: parsed.viewport || null, bodyCrawled: true,
    bodyText: parsed.bodyText || '',
    indexable: r.status === 200 && noindex === false, fetchError: r.error,
  };
}

// Fail-soft: missing table / no creds / not synced yet all resolve to an
// empty map (rules/gsc.js then emits nothing) — never throws into the crawl.
async function loadGscMap() {
  try {
    const { data, error } = await supabaseAdmin.from('seo_gsc_urls').select('*');
    if (error || !data) return new Map();
    return new Map(data.map((r) => [r.url, r]));
  } catch {
    return new Map();
  }
}

async function pool(items, n, worker) {
  const results = []; let idx = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (idx < items.length) { const i = idx++; results[i] = await worker(items[i]); if (DELAY_MS) await sleep(DELAY_MS); }
  });
  await Promise.all(runners);
  return results;
}

async function _execute(crawlId, seeds) {
  // ponytail: distinct name from the outer runIfDue('seo-crawl', ...) lock in
  // server.js — same name here would collide with jobLock's _inFlight guard
  // and self-skip every nightly tick (manual start() has no outer lock, so it
  // never hit this). Nightly now holds BOTH locks; manual vs nightly still
  // serialize against each other via this inner lock.
  return runLocked('seo-crawl-exec', async () => {
    const sitemapUrls = new Set(seeds.map((s) => s.url));
    const pages = await pool(seeds, CONCURRENCY, crawlOne);
    const gscByUrl = await loadGscMap();
    const ctx = buildContext(pages, sitemapUrls, gscByUrl);
    let issues = [];
    for (const p of pages) issues.push(...runRules(p, ctx));
    issues.push(...runSiteRules(ctx));
    issues = issues.map((i) => ({ ...i, ...prioritize(i, ctx) }));
    const scores = score(issues);
    await persist.saveResults(crawlId, pages, issues, scores);
    await persist.finishCrawl(crawlId, { status: 'done', counts: { url_count: seeds.length, page_count: pages.length, issue_count: issues.length } });
    return { pages, issues, scores };
  });
}

async function run({ trigger = 'manual', triggeredBy = null } = {}) {
  const crawlId = await persist.createCrawl({ trigger, triggeredBy });
  try {
    const result = await _execute(crawlId, await seedUrls());
    if (result === undefined) await persist.finishCrawl(crawlId, { status: 'skipped' });
  }
  catch (e) { await persist.finishCrawl(crawlId, { status: 'failed', error: e.message }); throw e; }
  return crawlId;
}
async function start({ trigger = 'manual', triggeredBy = null } = {}) {
  const crawlId = await persist.createCrawl({ trigger, triggeredBy });
  seedUrls().then((s) => _execute(crawlId, s)).then((result) => {
    if (result === undefined) return persist.finishCrawl(crawlId, { status: 'skipped' });
  }).catch((e) => persist.finishCrawl(crawlId, { status: 'failed', error: e.message }));
  return crawlId;
}
module.exports = { run, start, seedUrls, crawlOne };
