// server/services/seo/seoFetch.js
// Single-URL fetch for the SEO crawler. Global fetch (Node 22). Never throws.
// Normal browser UA: Cloudflare (fronting meeticulous.com) 403s AI-crawler UAs
// (ClaudeBot etc), so a bot UA here got every page blocked. Host/service pages
// no longer go through this fetch at all (seoCrawler resolves their meta
// in-process via prerenderController) — this UA now only hits static/blog
// pages, which are plain Vercel-prerendered HTML any browser UA can read.
const DEFAULT_UA =
  process.env.SEO_CRAWLER_UA ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 MeeticulousSEOBot';
const TIMEOUT_MS = Number(process.env.SEO_CRAWLER_TIMEOUT_MS) || 15000;

const headersToObject = (h) => {
  const out = {};
  if (!h) return out;
  if (typeof h.forEach === 'function') h.forEach((v, k) => { out[String(k).toLowerCase()] = v; });
  return out;
};

async function fetchUrl(url, { retry = true } = {}) {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': DEFAULT_UA, Accept: 'text/html,application/xhtml+xml' },
      signal: ctrl.signal,
    });
    const headers = headersToObject(res.headers);
    const body = await res.text();
    return {
      status: res.status,
      finalUrl: res.url || url,
      redirectChain: res.url && res.url !== url ? [url, res.url] : [],
      responseMs: Date.now() - started,
      contentType: headers['content-type'] || null,
      headers, body, error: null,
    };
  } catch (err) {
    if (retry && err.name !== 'AbortError') return fetchUrl(url, { retry: false });
    return { status: null, finalUrl: null, redirectChain: [], responseMs: Date.now() - started,
      contentType: null, headers: {}, body: '', error: err.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchUrl, DEFAULT_UA };
