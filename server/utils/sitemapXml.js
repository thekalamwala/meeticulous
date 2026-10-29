/**
 * sitemapXml.js — pure XML builders for the dynamic sitemap.
 *
 * No DB, no I/O. The controller fetches rows, maps them to {loc,...} entries,
 * and these helpers serialise them to spec-compliant sitemap XML.
 * Designed index-first so growth to sitemap-index + paginated children is a
 * config change (PER_SITEMAP), not a rewrite.
 */

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';

const xmlEscape = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// One <url> node. Optional fields are emitted only when present.
const urlNode = ({ loc, lastmod, changefreq, priority }) => {
  let s = `<url><loc>${xmlEscape(loc)}</loc>`;
  if (lastmod) s += `<lastmod>${xmlEscape(lastmod)}</lastmod>`;
  if (changefreq) s += `<changefreq>${xmlEscape(changefreq)}</changefreq>`;
  if (priority !== undefined && priority !== null) s += `<priority>${xmlEscape(priority)}</priority>`;
  return s + '</url>';
};

const buildUrlset = (entries = []) =>
  `${XML_HEADER}\n<urlset xmlns="${NS}">\n${entries.map(urlNode).join('\n')}\n</urlset>\n`;

const sitemapNode = ({ loc, lastmod }) => {
  let s = `<sitemap><loc>${xmlEscape(loc)}</loc>`;
  if (lastmod) s += `<lastmod>${xmlEscape(lastmod)}</lastmod>`;
  return s + '</sitemap>';
};

const buildSitemapIndex = (sitemaps = []) =>
  `${XML_HEADER}\n<sitemapindex xmlns="${NS}">\n${sitemaps.map(sitemapNode).join('\n')}\n</sitemapindex>\n`;

// Split into fixed-size pages. Always returns at least one page so "page 1"
// exists even with zero items (an empty but valid urlset).
const paginate = (items = [], perPage) => {
  if (!items.length) return [[]];
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages;
};

module.exports = { xmlEscape, buildUrlset, buildSitemapIndex, paginate };
