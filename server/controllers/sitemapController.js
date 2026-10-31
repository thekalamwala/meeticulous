/**
 * sitemapController.js — serves the dynamic, DB-driven sitemap.
 *
 * Architecture (index-first, built to scale to 1M+ URLs with no rewrite):
 *   /sitemap.xml            -> sitemap INDEX referencing the children below
 *   /sitemap-pages.xml      -> static marketing/legal routes
 *   /sitemap-hosts-N.xml    -> verified+indexable host profiles, 45k/page
 *   /sitemap-services-N.xml -> active+indexable service pages, 45k/page
 *   /sitemap-blog.xml       -> published blog posts
 *
 * Rendered XML is cached (sitemapCache, TTL) and busted on the mutation points
 * (service CRUD/toggle, profile-URL change, vendor verify) — the SPA-stack
 * equivalent of Next.js revalidatePath.
 *
 * Served on the apex domain via a Vercel rewrite (client/vercel.json) so
 * meeticulous.com/sitemap.xml proxies here; robots.txt points crawlers to it.
 */
const { buildUrlset, buildSitemapIndex, paginate } = require('../utils/sitemapXml');
const { sitemapCache } = require('../utils/sitemapCache');
const {
  trimSlash, staticEntries, hostEntries, serviceEntries, professionEntries, blogEntries,
  fetchHosts, fetchServices, fetchProfessions, fetchBlogs,
} = require('../services/sitemapService');
const { logger } = require('../utils/logger');

// Google's hard limit is 50,000 URLs / 50MB per sitemap. 45k leaves headroom.
const PER_SITEMAP = Number(process.env.SITEMAP_PAGE_SIZE) || 45000;

const getSiteUrl = () => trimSlash(process.env.SITE_URL || 'https://meeticulous.com');

// Fetch + map the current host/service rows once, cached as a structured value
// so the index and every child share a single DB round-trip per TTL window.
const loadEntries = async () => {
  const cached = sitemapCache.get('__entries');
  if (cached) return cached;

  const site = getSiteUrl();
  const [hosts, services, professions, blogs] = await Promise.all([
    fetchHosts(), fetchServices(), fetchProfessions(), fetchBlogs(),
  ]);
  const listedHosts = new Set(services.map((s) => s.profiles && s.profiles.username).filter(Boolean));
  const value = {
    pages: staticEntries(site),
    // Only hosts with >=1 listed service: a profile with nothing bookable is
    // noindexed (prerender + client), so it must not be in the sitemap either.
    hosts: hostEntries(hosts.filter((h) => listedHosts.has(h.username)), site),
    services: serviceEntries(services, site),
    professions: professionEntries(professions, site),
    blog: blogEntries(blogs, site),
  };
  sitemapCache.set('__entries', value);
  return value;
};

const sendXml = (res, xml) => {
  res.set('Content-Type', 'application/xml; charset=utf-8');
  // s-maxage lets the Vercel/Cloudflare edge cache and serve sitemaps to crawlers
  // instead of hitting the Render origin on every fetch; stale-while-revalidate
  // keeps serving the last-good copy while it refreshes in the background, so a
  // cold-start/egress 5xx at the origin never surfaces to Googlebot as a
  // "General HTTP error". Sitemaps are DB-driven but change slowly.
  res.set('Cache-Control', 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400');
  res.send(xml);
};

// Render-or-cache a child by its request path; rendererFn returns the XML string.
const serveCached = async (req, res, rendererFn) => {
  try {
    const key = req.path;
    let xml = sitemapCache.get(key);
    if (xml === undefined) {
      xml = await rendererFn(await loadEntries());
      if (xml === null) return res.status(404).type('text/plain').send('Not found');
      sitemapCache.set(key, xml);
    }
    sendXml(res, xml);
  } catch (err) {
    logger.error({ event: 'sitemap.error', path: req.path, message: err.message });
    res.status(500).type('text/plain').send('Sitemap temporarily unavailable');
  }
};

// newest lastmod among a child's entries — a freshness hint on the index node.
const newestLastmod = (entries) =>
  entries.reduce((max, e) => (e.lastmod && e.lastmod > (max || '') ? e.lastmod : max), undefined);

const sitemapIndex = (req, res) => serveCached(req, res, (entries) => {
  const site = getSiteUrl();
  const hostPages = paginate(entries.hosts, PER_SITEMAP);
  const servicePages = paginate(entries.services, PER_SITEMAP);

  const children = [{ loc: `${site}/sitemap-pages.xml`, lastmod: newestLastmod(entries.pages) }];
  hostPages.forEach((pg, i) => children.push({ loc: `${site}/sitemap-hosts-${i + 1}.xml`, lastmod: newestLastmod(pg) }));
  servicePages.forEach((pg, i) => children.push({ loc: `${site}/sitemap-services-${i + 1}.xml`, lastmod: newestLastmod(pg) }));
  children.push({ loc: `${site}/sitemap-professions.xml`, lastmod: newestLastmod(entries.professions) });
  children.push({ loc: `${site}/sitemap-blog.xml`, lastmod: newestLastmod(entries.blog) });

  return buildSitemapIndex(children);
});

const sitemapPages = (req, res) => serveCached(req, res, (entries) => buildUrlset(entries.pages));

const sitemapProfessions = (req, res) => serveCached(req, res, (entries) => buildUrlset(entries.professions));

const sitemapBlog = (req, res) => serveCached(req, res, (entries) => buildUrlset(entries.blog));

// page param comes from the regex route (group 1); defaults to 1. Out-of-range -> 404.
const childPage = (collection) => (req, res) => serveCached(req, res, (entries) => {
  const page = parseInt(req.params[0], 10) || 1;
  const pages = paginate(entries[collection], PER_SITEMAP);
  if (page < 1 || page > pages.length) return null;
  return buildUrlset(pages[page - 1]);
});

module.exports = {
  sitemapIndex,
  sitemapPages,
  sitemapHosts: childPage('hosts'),
  sitemapServices: childPage('services'),
  sitemapProfessions,
  sitemapBlog,
  PER_SITEMAP,
  getSiteUrl,
  loadEntries,
};
