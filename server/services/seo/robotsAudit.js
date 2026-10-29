// server/services/seo/robotsAudit.js
// Site-level robots.txt crawler-access map for the GEO score. Fetches /robots.txt
// once and memoizes for an hour (it changes rarely and the scorer runs per page).
//
// Crawlers we check (official user-agent tokens):
//   Googlebot         — Google Search / AI Overviews eligibility
//   OAI-SearchBot     — ChatGPT search indexing (visibility)
//   ChatGPT-User      — ChatGPT live fetch
//   GPTBot            — OpenAI training (decoupled — NOT scored)
//   Claude-SearchBot  — Claude search indexing (visibility)
//   Claude-User       — Claude live fetch
//   ClaudeBot         — Anthropic training (decoupled — NOT scored)
const { fetchUrl } = require('./seoFetch');

const SITE_URL = (process.env.SITE_URL || 'https://bookasloth.com').replace(/\/$/, '');
const TTL_MS = Number(process.env.SEO_ROBOTS_TTL_MS) || 60 * 60 * 1000;

const TOKENS = {
  googlebot: 'googlebot',
  oaiSearchBot: 'oai-searchbot',
  chatgptUser: 'chatgpt-user',
  gptBot: 'gptbot',
  claudeSearchBot: 'claude-searchbot',
  claudeUser: 'claude-user',
  claudeBot: 'claudebot',
};

let _cache = null; // { at, map }

// Minimal robots.txt parser. Returns groups: { agent(lowercased) -> [disallow paths] }.
// Good enough for "is this agent allowed to crawl the site root?" — the only question
// the GEO score asks. ponytail: no Allow-precedence / wildcard-path matching; if we
// ever need per-URL robots decisions, swap for a real robots-parser dependency.
function parseGroups(txt) {
  const groups = {};
  let current = [];
  for (const raw of String(txt || '').split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') {
      const agent = value.toLowerCase();
      if (!groups[agent]) groups[agent] = [];
      current = groups[agent];
    } else if (field === 'disallow' && current) {
      current.push(value);
    }
  }
  return groups;
}

// An agent is "allowed" unless its own group (or the * group, if it has none) blocks
// the whole site with `Disallow: /`.
function allows(groups, token) {
  const blocksRoot = (paths) => (paths || []).some((p) => p === '/' );
  if (groups[token]) return !blocksRoot(groups[token]);
  if (groups['*']) return !blocksRoot(groups['*']);
  return true; // no matching group and no wildcard = crawl allowed
}

async function fetchMap() {
  try {
    const r = await fetchUrl(`${SITE_URL}/robots.txt`);
    if (r.status !== 200 || !r.body) {
      // No robots.txt (or unreachable) = nothing disallowed. Everyone allowed.
      return Object.fromEntries(Object.keys(TOKENS).map((k) => [k, true]));
    }
    const groups = parseGroups(r.body);
    const map = {};
    for (const [key, token] of Object.entries(TOKENS)) map[key] = allows(groups, token);
    return map;
  } catch {
    return Object.fromEntries(Object.keys(TOKENS).map((k) => [k, true]));
  }
}

async function getMap() {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.map;
  const map = await fetchMap();
  _cache = { at: Date.now(), map };
  return map;
}

// test hook
function _reset() { _cache = null; }

module.exports = { getMap, parseGroups, allows, TOKENS, _reset };
