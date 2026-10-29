// server/services/seo/seoParse.js
// Pure HTML → SEO signals. No I/O. Used by the crawler and every rule module.
const { parse: parseHtml } = require('node-html-parser');

const SITE_HOST = (() => {
  try { return new URL(process.env.SITE_URL || 'https://bookasloth.com').host; }
  catch { return 'bookasloth.com'; }
})();

const attr = (el, name) => (el ? el.getAttribute(name) || null : null);
const clean = (s) => (s == null ? null : String(s).replace(/\s+/g, ' ').trim() || null);

function parse(html, headers = {}) {
  const root = parseHtml(html || '', { comment: false });

  const title = clean(root.querySelector('title')?.text);
  const metaDescription = clean(attr(root.querySelector('meta[name="description"]'), 'content'));
  const canonical = clean(attr(root.querySelector('link[rel="canonical"]'), 'href'));
  const viewport = clean(attr(root.querySelector('meta[name="viewport"]'), 'content'));

  const robotsParts = [];
  const metaRobots = clean(attr(root.querySelector('meta[name="robots"]'), 'content'));
  if (metaRobots) robotsParts.push(metaRobots);
  const xRobots = headers['x-robots-tag'] || headers['X-Robots-Tag'];
  if (xRobots) robotsParts.push(String(xRobots));
  const robots = robotsParts.length ? robotsParts.join(', ').toLowerCase() : null;

  const h1 = root.querySelectorAll('h1').map((e) => clean(e.text)).filter(Boolean);
  const headings = root.querySelectorAll('h1,h2,h3,h4,h5,h6')
    .map((e) => ({ tag: e.rawTagName.toLowerCase(), text: clean(e.text) })).filter((h) => h.text);

  const links = { internal: [], external: [] };
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    let abs;
    try { abs = new URL(href, process.env.SITE_URL || 'https://bookasloth.com').toString(); } catch { continue; }
    // WHATWG URL forces a trailing slash on bare-origin URLs (e.g. "https://google.com" -> ".../"); undo it.
    abs = abs.replace(/^([a-z][a-z0-9+.-]*:\/\/[^/]+)\/$/i, '$1');
    let host; try { host = new URL(abs).host; } catch { continue; }
    (host === SITE_HOST ? links.internal : links.external).push(abs);
  }

  const images = root.querySelectorAll('img').map((img) => ({
    src: img.getAttribute('src') || '', alt: img.hasAttribute('alt') ? (img.getAttribute('alt') || '') : null,
  }));

  // One <script> can hold a single node, an array of nodes, or a { @graph: [...] }
  // wrapper (all valid JSON-LD). Flatten to individual typed nodes so type checks
  // see e.g. BlogPosting inside an array instead of an array with no top-level @type.
  const jsonLd = root.querySelectorAll('script[type="application/ld+json"]').flatMap((s) => {
    const raw = s.text.trim();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return [{ __invalid: true, raw }]; }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    return nodes.flatMap((n) => (n && Array.isArray(n['@graph']) ? n['@graph'] : [n]));
  });

  const bodyText = (root.querySelector('body')?.text || '').replace(/\s+/g, ' ').trim();
  const wordCount = bodyText ? bodyText.split(' ').length : 0;

  return { title, metaDescription, canonical, robots, viewport, h1, headings, links, images, jsonLd, wordCount, bodyText };
}

module.exports = { parse };
