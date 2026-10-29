# SEO Audit Engine (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a read-only SEO Audit Engine — a crawler + deterministic rule engine + prioritized issue dashboard at `/admin/seo` that automates the manual weekly GSC SOP checks and writes nothing to live SEO fields.

**Architecture:** A nightly (and on-demand) server job seeds URLs from the existing sitemap, fetches each with a bot UA, parses head/signals, runs pure deterministic rule modules to produce issues, prioritizes (P0–P4) and scores (per-category health) deterministically, then persists a crawl snapshot to 5 new tables. An admin React page reads the latest crawl. No Claude in P1.

**Tech Stack:** Node 22 (Express, global `fetch`), `node-html-parser` (new dep), Supabase (`supabaseAdmin` service-role), Jest (server), React 18 + Vite + Vitest (client), axios (`services/api.js`).

**Spec:** [`docs/superpowers/specs/2026-09-07-seo-audit-engine-design.md`](../specs/2026-09-07-seo-audit-engine-design.md)

## Global Constraints

- **Node 22, global `fetch`** — no `axios`/`node-fetch`/`undici` on the server. Use `fetch`.
- **HTML parser:** add `node-html-parser` (pin `^6.1.13`); it is the only new server dep. No `cheerio`/`jsdom`.
- **Server tests: Jest.** Files in `server/tests/unit/*.test.js` and `server/tests/integration/*.test.js`. Jest globals (`describe`/`test`/`expect`/`jest`/`beforeEach`) used with NO import. Supabase mocked via a thenable query-builder (`makeQuery`).
- **Client tests: Vitest, NO `@testing-library/jest-dom`.** Assert with `.toBeTruthy()` / `screen.getByText(...)`; read attributes via `.getAttribute()`. Mock the API with `vi.mock('../../../services/api', …)`. Files in `client/src/pages/admin/__tests__/`.
- **Migration:** `server/migrations/v3.145_seo_audit.sql`. Idempotent (`CREATE TABLE IF NOT EXISTS`). Server-only: `ALTER TABLE … ENABLE ROW LEVEL SECURITY` with **no policy** (service-role only), like `job_runs`. Apply to **BOTH** DBs (`npm run migrate:staging -- migrations/v3.145_seo_audit.sql`, then `:prod`).
- **Permission:** all admin SEO routes gated `requireAdmin('seo.manage')`. `seo.manage` already exists in `server/lib/adminPermissions.js` (marketing role) — **no RBAC migration**.
- **Admin auth:** never set auth headers in client code; any route starting with `/admin` gets the `bas_admin` bearer token auto-attached by the `services/api.js` interceptor.
- **Canonical domain:** `SITE_URL` defaults to `https://bookasloth.com` (`.com` = prod; never `.in`).
- **Before the client PR:** run `npx vitest run` in `client/` (full vitest gates the Vercel deploy).
- **Workflow:** branch `feat/seo-audit-engine`. Work → commit per task → open PR. **Do NOT merge** (user merges; merge auto-deploys prod). Commit messages: Conventional Commits, end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Core data contracts (shared across tasks)

```js
// pageData — one crawled URL (seed metadata + fetch result + parsed signals)
{
  url: string, pageType: 'host'|'service'|'blog'|'static'|'other', inSitemap: boolean,
  httpStatus: number|null, finalUrl: string|null, redirectChain: string[], responseMs: number|null, contentType: string|null,
  title: string|null, metaDescription: string|null, canonical: string|null,
  robots: string|null,               // meta robots + X-Robots-Tag, lowercased, comma-joined
  h1: string[], headings: {tag:string,text:string}[],
  links: { internal: string[], external: string[] },  // absolute URLs
  images: { src:string, alt:string|null }[],
  jsonLd: object[],                  // parsed; unparseable entry => { __invalid:true, raw:string }
  wordCount: number, viewport: string|null,
  fetchError: string|null,
}

// rawIssue — what a rule emits (detection only)
{ ruleKey: string, affectedUrl: string, evidence: object }
// issue — rawIssue + registry metadata + prioritize() output (persisted to seo_issues)
{ ruleKey, category, title, detail, evidence, affectedUrl, autoFixable, confidence, severity, priorityScore }

// ctx — cross-page state for rules that compare across the crawl
{ pages: pageData[], sitemapUrls: Set<string>, titleCounts: Map<string,number>,
  descCounts: Map<string,number>, internalLinkTargets: Set<string>, homepageTitle: string|null,
  SHOULD_INDEX_TYPES: Set<string> /* host,service,blog,static */ }
```

**Deliberate deviation from spec:** the spec's separate `dbScan.js` SQL pass is dropped for P1. Since P1 crawls every indexable URL (~245), duplicate/missing/oversized meta is detected from the crawled page set via context-aware rules (`ctx.titleCounts` etc.). Reintroduce a DB-scan only past ~2k URLs (roadmap P4). Everything else matches the spec.

---

### Task 1: Migration — 5 SEO tables (`v3.145_seo_audit.sql`)

**Files:**
- Create: `server/migrations/v3.145_seo_audit.sql`

**Interfaces:**
- Produces: tables `seo_crawls`, `seo_crawl_pages`, `seo_issues`, `seo_score_snapshots`, `seo_issue_mutes` (consumed by Task 9 persist + Task 11 reads).

- [ ] **Step 1: Write the migration file**

```sql
-- v3.145 — seo_audit: read-only SEO Audit Engine (P1) storage.
--
-- A nightly/on-demand crawler records one seo_crawls row per run, one
-- seo_crawl_pages row per URL, deterministic seo_issues, and a per-category
-- seo_score_snapshot. seo_issue_mutes lets an admin silence a rule (or a
-- rule+url). Nothing here writes to live SEO fields — it is an audit store.
--
-- Server-only (service_role); RLS-on / no policy, like job_runs + webhook_events.
-- Apply on BOTH DBs. Idempotent.

CREATE TABLE IF NOT EXISTS seo_crawls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text NOT NULL DEFAULT 'running',   -- running | done | failed | skipped
  trigger       text NOT NULL DEFAULT 'manual',    -- nightly | manual
  triggered_by  text,
  url_count     int NOT NULL DEFAULT 0,
  page_count    int NOT NULL DEFAULT 0,
  issue_count   int NOT NULL DEFAULT 0,
  error         text,
  progress      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS seo_crawl_pages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id       uuid NOT NULL REFERENCES seo_crawls(id) ON DELETE CASCADE,
  url            text NOT NULL,
  page_type      text NOT NULL DEFAULT 'other',
  http_status    int,
  final_url      text,
  redirect_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_ms    int,
  title          text,
  meta_description text,
  canonical      text,
  robots         text,
  h1             jsonb NOT NULL DEFAULT '[]'::jsonb,
  word_count     int,
  indexable      boolean,
  in_sitemap     boolean NOT NULL DEFAULT false,
  raw_signals    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_crawl_pages_crawl ON seo_crawl_pages(crawl_id);
CREATE INDEX IF NOT EXISTS idx_seo_crawl_pages_type  ON seo_crawl_pages(crawl_id, page_type);

CREATE TABLE IF NOT EXISTS seo_issues (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id           uuid NOT NULL REFERENCES seo_crawls(id) ON DELETE CASCADE,
  page_id            uuid REFERENCES seo_crawl_pages(id) ON DELETE CASCADE,
  rule_key           text NOT NULL,
  category           text NOT NULL,
  severity           text NOT NULL,           -- P0 | P1 | P2 | P3 | P4
  priority_score     numeric NOT NULL DEFAULT 0,
  confidence         numeric NOT NULL DEFAULT 1,
  title              text NOT NULL,
  detail             text,
  evidence           jsonb NOT NULL DEFAULT '{}'::jsonb,
  affected_url       text,
  auto_fixable       boolean NOT NULL DEFAULT false,
  status             text NOT NULL DEFAULT 'open',   -- open | ignored
  first_seen_crawl_id uuid,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_issues_crawl_sev ON seo_issues(crawl_id, severity);
CREATE INDEX IF NOT EXISTS idx_seo_issues_rule_url  ON seo_issues(rule_key, affected_url);

CREATE TABLE IF NOT EXISTS seo_score_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id         uuid NOT NULL REFERENCES seo_crawls(id) ON DELETE CASCADE,
  taken_at         timestamptz NOT NULL DEFAULT now(),
  overall          int NOT NULL,
  technical        int NOT NULL,
  onpage           int NOT NULL,
  content          int NOT NULL,
  indexability     int NOT NULL,
  internal_linking int NOT NULL,
  breakdown        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS seo_issue_mutes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key    text NOT NULL,
  url_pattern text,                 -- NULL = mute the whole rule type
  muted_by    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_issue_mutes ON seo_issue_mutes(rule_key, COALESCE(url_pattern, ''));

ALTER TABLE seo_crawls          ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_crawl_pages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_issues          ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_issue_mutes     ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Apply to staging + verify**

Run: `cd server && npm run migrate:staging -- migrations/v3.145_seo_audit.sql`
Expected: no error. Verify with the Supabase MCP or `psql`: the 5 tables exist and RLS is enabled. (Apply to prod only at deploy time, coordinated with the user — not now.)

- [ ] **Step 3: Commit**

```bash
git add server/migrations/v3.145_seo_audit.sql
git commit -m "feat(seo): v3.145 audit-engine tables (crawls/pages/issues/scores/mutes)"
```

---

### Task 2: HTML parser dep + `seoParse.js`

**Files:**
- Modify: `server/package.json` (add `node-html-parser`)
- Create: `server/services/seo/seoParse.js`
- Test: `server/tests/unit/seoParse.test.js`

**Interfaces:**
- Produces: `parse(html, headers) => pageData signals` — `{ title, metaDescription, canonical, robots, h1[], headings[], links{internal[],external[]}, images[], jsonLd[], wordCount, viewport }`. Consumed by Task 10 (crawler) and every rule module.
- Consumes: `node-html-parser`'s `parse()`.

- [ ] **Step 1: Add the dependency**

Run: `cd server && npm install node-html-parser@^6.1.13`
Expected: `package.json` dependencies gains `"node-html-parser": "^6.1.13"`; lockfile updates.

- [ ] **Step 2: Write the failing test**

```js
// server/tests/unit/seoParse.test.js
const { parse } = require('../../services/seo/seoParse');

const HTML = `<!doctype html><html><head>
  <title>Book A Coach</title>
  <meta name="description" content="Hire a coach">
  <link rel="canonical" href="https://bookasloth.com/jane">
  <meta name="robots" content="index, follow">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="application/ld+json">{"@type":"Person"}</script>
  <script type="application/ld+json">{bad json}</script>
</head><body>
  <h1>Jane the Coach</h1><h1>Second H1</h1>
  <p>Some body copy here with several words for counting.</p>
  <a href="https://bookasloth.com/jane/intro">internal</a>
  <a href="https://google.com">external</a>
  <img src="/a.jpg" alt="A photo"><img src="/b.jpg">
</body></html>`;

describe('seoParse', () => {
  test('extracts head + body signals from a page', () => {
    const pd = parse(HTML, { 'x-robots-tag': 'noarchive' });
    expect(pd.title).toBe('Book A Coach');
    expect(pd.metaDescription).toBe('Hire a coach');
    expect(pd.canonical).toBe('https://bookasloth.com/jane');
    expect(pd.robots).toBe('index, follow, noarchive');           // meta + header merged, lowercased
    expect(pd.viewport).toBe('width=device-width, initial-scale=1');
    expect(pd.h1).toEqual(['Jane the Coach', 'Second H1']);
    expect(pd.links.internal).toContain('https://bookasloth.com/jane/intro');
    expect(pd.links.external).toContain('https://google.com');
    expect(pd.images).toEqual([{ src: '/a.jpg', alt: 'A photo' }, { src: '/b.jpg', alt: null }]);
    expect(pd.jsonLd).toEqual([{ '@type': 'Person' }, { __invalid: true, raw: '{bad json}' }]);
    expect(pd.wordCount).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/seoParse.test.js`
Expected: FAIL — "Cannot find module '../../services/seo/seoParse'".

- [ ] **Step 4: Implement `seoParse.js`**

```js
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
    let host; try { host = new URL(abs).host; } catch { continue; }
    (host === SITE_HOST ? links.internal : links.external).push(abs);
  }

  const images = root.querySelectorAll('img').map((img) => ({
    src: img.getAttribute('src') || '', alt: img.hasAttribute('alt') ? (img.getAttribute('alt') || '') : null,
  }));

  const jsonLd = root.querySelectorAll('script[type="application/ld+json"]').map((s) => {
    const raw = s.text.trim();
    try { return JSON.parse(raw); } catch { return { __invalid: true, raw }; }
  });

  const bodyText = (root.querySelector('body')?.text || '').replace(/\s+/g, ' ').trim();
  const wordCount = bodyText ? bodyText.split(' ').length : 0;

  return { title, metaDescription, canonical, robots, viewport, h1, headings, links, images, jsonLd, wordCount };
}

module.exports = { parse };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/seoParse.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/package-lock.json server/services/seo/seoParse.js server/tests/unit/seoParse.test.js
git commit -m "feat(seo): HTML parser + seoParse signal extractor"
```

---

### Task 3: `seoFetch.js` — bot-UA HTTP fetch

**Files:**
- Create: `server/services/seo/seoFetch.js`
- Test: `server/tests/unit/seoFetch.test.js`

**Interfaces:**
- Produces: `async fetchUrl(url, opts?) => { status, finalUrl, redirectChain[], responseMs, contentType, headers, body, error }`. Consumed by Task 10.
- Uses: global `fetch` (Node 22).

Rationale: bot UA (matches `client/middleware.js` `BOT_UA_RE`) so host/service pages resolve their real prerendered meta via the edge→`/prerender` path (what non-JS crawlers/Google snippets see) rather than the noindex `spa-shell`. **Verify the default UA matches `BOT_UA_RE`** before relying on it.

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/seoFetch.test.js
const { fetchUrl } = require('../../services/seo/seoFetch');

describe('seoFetch', () => {
  afterEach(() => { global.fetch = undefined; });

  test('returns status, body, timing and a bot UA request', async () => {
    let sentHeaders;
    global.fetch = jest.fn(async (url, init) => {
      sentHeaders = init.headers;
      return { status: 200, url, headers: new Map([['content-type', 'text/html']]), text: async () => '<title>ok</title>' };
    });
    const r = await fetchUrl('https://bookasloth.com/');
    expect(r.status).toBe(200);
    expect(r.body).toContain('ok');
    expect(r.responseMs).toBeGreaterThanOrEqual(0);
    expect(String(sentHeaders['User-Agent'])).toMatch(/BookASlothSEOBot|ClaudeBot/i);
  });

  test('captures fetch errors without throwing', async () => {
    global.fetch = jest.fn(async () => { throw new Error('ECONNREFUSED'); });
    const r = await fetchUrl('https://bookasloth.com/x');
    expect(r.status).toBeNull();
    expect(r.error).toMatch(/ECONNREFUSED/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/seoFetch.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `seoFetch.js`**

```js
// server/services/seo/seoFetch.js
// Single-URL fetch for the SEO crawler. Global fetch (Node 22). Never throws.
// Bot UA so host/service pages resolve real prerendered meta via edge -> /prerender.
const DEFAULT_UA =
  process.env.SEO_CRAWLER_UA ||
  'Mozilla/5.0 (compatible; BookASlothSEOBot/1.0; +https://bookasloth.com/robots.txt) ClaudeBot/1.0';
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/seoFetch.test.js`
Expected: PASS.

- [ ] **Step 5: Verify the UA matches the edge bot regex**

Run: `grep -n "BOT_UA_RE" client/middleware.js`
Confirm the default UA (contains `ClaudeBot`) matches. If `BOT_UA_RE` changed, adjust `DEFAULT_UA` so host/service URLs proxy to `/prerender`. (No code change if it matches — this is a guard.)

- [ ] **Step 6: Commit**

```bash
git add server/services/seo/seoFetch.js server/tests/unit/seoFetch.test.js
git commit -m "feat(seo): bot-UA crawler fetch (global fetch, never throws)"
```

---

### Task 4: Rule registry + runner + context builder + on-page rules

**Files:**
- Create: `server/services/seo/rules/registry.js`
- Create: `server/services/seo/rules/onpage.js`
- Create: `server/services/seo/rules/index.js` (runner + `buildContext`)
- Test: `server/tests/unit/seoRules.onpage.test.js`

**Interfaces:**
- Produces:
  - `REGISTRY` (registry.js): `{ [ruleKey]: { category, severity, confidence, autoFixable, title } }` — metadata for EVERY rule (all groups, filled in as later tasks land; add each group's keys here as you build it).
  - `buildContext(pages, sitemapUrls) => ctx` (index.js).
  - `runRules(pageData, ctx) => issue[]` and `runSiteRules(ctx) => issue[]` (index.js) — call every group's `check`/`siteCheck`, attach registry metadata → full issue objects (minus `severity`/`priorityScore`, which prioritize() sets; `severity` is copied from registry as the base).
  - `check(pageData, ctx) => rawIssue[]` per group module.
- Consumed by: Task 5, 6 (more rule modules), Task 10 (crawler).

Each rule module exports `check(pageData, ctx)` returning `{ ruleKey, affectedUrl, evidence }[]`. Cross-page rules read `ctx`. `runRules` looks up `REGISTRY[ruleKey]` for `category/title/confidence/autoFixable` and the base `severity`.

- [ ] **Step 1: Write the failing test (on-page rules)**

```js
// server/tests/unit/seoRules.onpage.test.js
const { check } = require('../../services/seo/rules/onpage');
const { buildContext } = require('../../services/seo/rules/index');

const page = (over = {}) => ({
  url: 'https://bookasloth.com/jane', pageType: 'host', httpStatus: 200,
  title: 'A Great Coach You Should Book Today Right Now Here', metaDescription: 'x'.repeat(150),
  h1: ['A Great Coach You Should Book Today Right Now Here'], ...over,
});

describe('onpage rules', () => {
  test('flags missing title', () => {
    const ctx = buildContext([page({ title: null })], new Set());
    const keys = check(page({ title: null }), ctx).map((i) => i.ruleKey);
    expect(keys).toContain('onpage.missing_title');
  });

  test('flags title length outside 50-60', () => {
    const ctx = buildContext([page({ title: 'Short' })], new Set());
    const keys = check(page({ title: 'Short' }), ctx).map((i) => i.ruleKey);
    expect(keys).toContain('onpage.title_length');
  });

  test('flags duplicate titles across pages', () => {
    const p1 = page({ url: 'https://bookasloth.com/a', title: 'Same Title Here For Both Pages OK Yes Sure Indeed' });
    const p2 = page({ url: 'https://bookasloth.com/b', title: 'Same Title Here For Both Pages OK Yes Sure Indeed' });
    const ctx = buildContext([p1, p2], new Set());
    expect(check(p1, ctx).map((i) => i.ruleKey)).toContain('onpage.duplicate_title');
  });

  test('flags multiple H1', () => {
    const ctx = buildContext([page({ h1: ['one', 'two'] })], new Set());
    expect(check(page({ h1: ['one', 'two'] }), ctx).map((i) => i.ruleKey)).toContain('onpage.multiple_h1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/seoRules.onpage.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement registry, index (runner + buildContext), and onpage**

```js
// server/services/seo/rules/registry.js
// Central metadata for every rule. Detection lives in the group modules;
// severity/category/confidence/autoFixable/title live here (one place).
const REGISTRY = {
  // on-page
  'onpage.missing_title':        { category: 'onpage', severity: 'P1', confidence: 1,   autoFixable: false, title: 'Missing <title>' },
  'onpage.title_length':         { category: 'onpage', severity: 'P3', confidence: 0.9, autoFixable: false, title: 'Title length outside 50–60' },
  'onpage.duplicate_title':      { category: 'onpage', severity: 'P2', confidence: 0.9, autoFixable: false, title: 'Duplicate title across pages' },
  'onpage.missing_description':  { category: 'onpage', severity: 'P2', confidence: 1,   autoFixable: true,  title: 'Missing meta description' },
  'onpage.description_length':   { category: 'onpage', severity: 'P3', confidence: 0.9, autoFixable: true,  title: 'Meta description length outside 140–160' },
  'onpage.duplicate_description':{ category: 'onpage', severity: 'P3', confidence: 0.9, autoFixable: false, title: 'Duplicate meta description across pages' },
  'onpage.missing_h1':           { category: 'onpage', severity: 'P2', confidence: 1,   autoFixable: false, title: 'Missing H1' },
  'onpage.multiple_h1':          { category: 'onpage', severity: 'P3', confidence: 1,   autoFixable: false, title: 'Multiple H1 tags' },
  'onpage.title_h1_mismatch':    { category: 'onpage', severity: 'P4', confidence: 0.6, autoFixable: false, title: 'Title / H1 mismatch' },
  // (technical.* added in Task 5, indexability.* in Task 5, links/images/schema/sitemap.* in Task 6)
};
module.exports = { REGISTRY };
```

```js
// server/services/seo/rules/index.js
const { REGISTRY } = require('./registry');
const onpage = require('./onpage');
// Task 5/6 add: const technical = require('./technical'); etc. Push into GROUPS below.
const GROUPS = [onpage];

const SHOULD_INDEX_TYPES = new Set(['host', 'service', 'blog', 'static']);

function buildContext(pages, sitemapUrls) {
  const titleCounts = new Map();
  const descCounts = new Map();
  const internalLinkTargets = new Set();
  let homepageTitle = null;
  const siteUrl = process.env.SITE_URL || 'https://bookasloth.com';
  for (const p of pages) {
    if (p.title) titleCounts.set(p.title, (titleCounts.get(p.title) || 0) + 1);
    if (p.metaDescription) descCounts.set(p.metaDescription, (descCounts.get(p.metaDescription) || 0) + 1);
    for (const l of p.links?.internal || []) internalLinkTargets.add(l.replace(/\/$/, ''));
    if (p.url === siteUrl || p.url === `${siteUrl}/`) homepageTitle = p.title;
  }
  return { pages, sitemapUrls: sitemapUrls || new Set(), titleCounts, descCounts,
    internalLinkTargets, homepageTitle, SHOULD_INDEX_TYPES };
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
```

```js
// server/services/seo/rules/onpage.js
// Detection only. Title/description length bands come from docs/seo-aeo-geo-plan.md.
const TITLE_MIN = 50, TITLE_MAX = 60, DESC_MIN = 140, DESC_MAX = 160;

function check(p, ctx) {
  const out = [];
  const at = p.url;
  const push = (ruleKey, evidence) => out.push({ ruleKey, affectedUrl: at, evidence });
  if (p.pageType && !ctx.SHOULD_INDEX_TYPES.has(p.pageType)) return out; // only audit indexable page types
  if (p.httpStatus && p.httpStatus !== 200) return out;                  // on-page rules need a real page

  if (!p.title) push('onpage.missing_title', {});
  else {
    if (p.title.length < TITLE_MIN || p.title.length > TITLE_MAX) push('onpage.title_length', { length: p.title.length });
    if ((ctx.titleCounts.get(p.title) || 0) > 1) push('onpage.duplicate_title', { title: p.title, count: ctx.titleCounts.get(p.title) });
  }
  if (!p.metaDescription) push('onpage.missing_description', {});
  else {
    if (p.metaDescription.length < DESC_MIN || p.metaDescription.length > DESC_MAX) push('onpage.description_length', { length: p.metaDescription.length });
    if ((ctx.descCounts.get(p.metaDescription) || 0) > 1) push('onpage.duplicate_description', { count: ctx.descCounts.get(p.metaDescription) });
  }
  if (!p.h1 || p.h1.length === 0) push('onpage.missing_h1', {});
  else if (p.h1.length > 1) push('onpage.multiple_h1', { count: p.h1.length });
  if (p.title && p.h1 && p.h1.length === 1 && p.h1[0].toLowerCase() !== p.title.toLowerCase())
    push('onpage.title_h1_mismatch', { title: p.title, h1: p.h1[0] });
  return out;
}
module.exports = { check };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/seoRules.onpage.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/seo/rules/registry.js server/services/seo/rules/index.js server/services/seo/rules/onpage.js server/tests/unit/seoRules.onpage.test.js
git commit -m "feat(seo): rule engine (registry + runner + context) + on-page rules"
```

---

### Task 5: Technical + indexability rules (SOP-critical)

**Files:**
- Create: `server/services/seo/rules/technical.js`
- Create: `server/services/seo/rules/indexability.js`
- Modify: `server/services/seo/rules/registry.js` (add keys)
- Modify: `server/services/seo/rules/index.js` (register the two groups in `GROUPS`)
- Test: `server/tests/unit/seoRules.indexability.test.js`

**Interfaces:**
- Produces: `check(pageData, ctx)` in each module. Consumed by the Task 4 runner.

These two modules encode the GSC SOP escalation triggers. Rule conditions (implement each as one `push(...)` guarded by the condition — mirror the on-page module exactly):

**`technical.js`** (skip when `httpStatus == null` → that's a fetch error, handled by `technical.non_200`):
| ruleKey | condition | evidence |
|---|---|---|
| `technical.non_200` | `httpStatus == null` OR `httpStatus >= 400` | `{ status, error }` |
| `technical.redirect` | `httpStatus` in 301/302/307/308 OR `redirectChain.length > 0` | `{ finalUrl }` |
| `technical.redirect_chain` | `redirectChain.length > 1` | `{ chain }` |
| `technical.slow_response` | `responseMs > SLOW_MS` (env `SEO_SLOW_MS` default 1500) | `{ responseMs }` |
| `technical.missing_canonical` | `httpStatus===200 && !canonical` | `{}` |
| `technical.canonical_to_other` | `canonical && normalize(canonical) !== normalize(finalUrl||url)` | `{ canonical }` |
| `technical.missing_viewport` | `httpStatus===200 && !viewport` | `{}` |

(`normalize(u) = u.replace(/\/$/, '')` lowercased host. Only run 200-gated rules when `httpStatus===200`.)

**`indexability.js`** (only for `ctx.SHOULD_INDEX_TYPES`):
| ruleKey | condition | evidence |
|---|---|---|
| `indexability.unexpected_noindex` | `httpStatus===200 && robots && robots.includes('noindex')` | `{ robots }` |
| `indexability.error_url_in_sitemap` | `inSitemap && (httpStatus==null || httpStatus>=400 || redirectChain.length>0)` | `{ status }` |
| `indexability.canonical_sitemap_mismatch` | `inSitemap && canonical && normalize(canonical)!==normalize(url)` | `{ canonical }` |
| `indexability.soft_404` | `httpStatus===200 && wordCount < SOFT_MIN (env SEO_SOFT_404_WORDS default 100) && !(robots&&robots.includes('noindex'))` | `{ wordCount }` |
| `indexability.prerender_regression` | `(pageType==='host'||pageType==='service') && title && ctx.homepageTitle && title === ctx.homepageTitle` | `{ title }` |

Registry additions (append to `REGISTRY`):
```js
  'technical.non_200':              { category:'technical', severity:'P0', confidence:1,   autoFixable:false, title:'Non-200 / unreachable' },
  'technical.redirect':             { category:'technical', severity:'P3', confidence:0.9, autoFixable:false, title:'URL redirects' },
  'technical.redirect_chain':       { category:'technical', severity:'P2', confidence:1,   autoFixable:false, title:'Redirect chain (>1 hop)' },
  'technical.slow_response':        { category:'technical', severity:'P3', confidence:0.7, autoFixable:false, title:'Slow response' },
  'technical.missing_canonical':    { category:'technical', severity:'P2', confidence:1,   autoFixable:false, title:'Missing canonical' },
  'technical.canonical_to_other':   { category:'technical', severity:'P2', confidence:0.7, autoFixable:false, title:'Canonical points elsewhere' },
  'technical.missing_viewport':     { category:'technical', severity:'P3', confidence:1,   autoFixable:false, title:'Missing viewport meta' },
  'indexability.unexpected_noindex':      { category:'indexability', severity:'P0', confidence:0.8, autoFixable:false, title:'Unexpected noindex on indexable page' },
  'indexability.error_url_in_sitemap':    { category:'indexability', severity:'P1', confidence:1,   autoFixable:false, title:'Error/redirect URL in sitemap' },
  'indexability.canonical_sitemap_mismatch':{ category:'indexability', severity:'P2', confidence:0.8, autoFixable:false, title:'Canonical ≠ sitemap URL' },
  'indexability.soft_404':                { category:'indexability', severity:'P1', confidence:0.6, autoFixable:false, title:'Soft 404 (200 but thin)' },
  'indexability.prerender_regression':    { category:'indexability', severity:'P0', confidence:0.7, autoFixable:false, title:'Prerender regression (homepage title)' },
```

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/seoRules.indexability.test.js
const tech = require('../../services/seo/rules/technical');
const idx = require('../../services/seo/rules/indexability');
const { buildContext } = require('../../services/seo/rules/index');

const base = (o = {}) => ({ url: 'https://bookasloth.com/jane', pageType: 'host', httpStatus: 200,
  canonical: 'https://bookasloth.com/jane', redirectChain: [], responseMs: 100, viewport: 'w', wordCount: 500, robots: 'index, follow', title: 'Jane', ...o });

describe('technical + indexability rules', () => {
  test('non_200 fires on 404', () => {
    const ctx = buildContext([], new Set());
    expect(tech.check(base({ httpStatus: 404 }), ctx).map((i) => i.ruleKey)).toContain('technical.non_200');
  });
  test('unexpected_noindex fires when robots has noindex', () => {
    const ctx = buildContext([], new Set());
    expect(idx.check(base({ robots: 'noindex, follow' }), ctx).map((i) => i.ruleKey)).toContain('indexability.unexpected_noindex');
  });
  test('prerender_regression fires when title equals homepage title', () => {
    const home = { url: 'https://bookasloth.com/', pageType: 'static', title: 'Book A Sloth' };
    const p = base({ title: 'Book A Sloth', pageType: 'service' });
    const ctx = buildContext([home, p], new Set());
    expect(idx.check(p, ctx).map((i) => i.ruleKey)).toContain('indexability.prerender_regression');
  });
  test('error_url_in_sitemap fires for a 404 that is in the sitemap', () => {
    const ctx = buildContext([], new Set(['https://bookasloth.com/jane']));
    expect(idx.check(base({ httpStatus: 404, inSitemap: true }), ctx).map((i) => i.ruleKey)).toContain('indexability.error_url_in_sitemap');
  });
});
```

- [ ] **Step 2: Run test → FAIL** (`cd server && npx jest tests/unit/seoRules.indexability.test.js`).
- [ ] **Step 3: Implement `technical.js` + `indexability.js` per the condition tables; add the registry keys; add `technical`+`indexability` to `GROUPS` in `index.js`.** Follow the `onpage.js` shape exactly (a `push(ruleKey, evidence)` per row, guarded by the condition). Define `const normalize = (u) => (u || '').replace(/\/$/, '').toLowerCase();` at the top of each module.
- [ ] **Step 4: Run test → PASS.**
- [ ] **Step 5: Commit** — `git add server/services/seo/rules/technical.js server/services/seo/rules/indexability.js server/services/seo/rules/registry.js server/services/seo/rules/index.js server/tests/unit/seoRules.indexability.test.js && git commit -m "feat(seo): technical + indexability rules (GSC SOP triggers)"`

---

### Task 6: Links, images, structured-data, sitemap rules

**Files:**
- Create: `server/services/seo/rules/links.js`, `images.js`, `structuredData.js`, `sitemap.js`
- Modify: `registry.js` (keys), `index.js` (`GROUPS`)
- Test: `server/tests/unit/seoRules.misc.test.js`

**Interfaces:** `check(pageData, ctx)` in links/images/structuredData; `sitemap.js` exports `siteCheck(ctx)` (site-level, one pass).

Condition tables (implement mirroring `onpage.js`):

**`links.js`** (`check`, 200-gated, indexable types):
| ruleKey | condition | evidence |
|---|---|---|
| `links.broken_internal` | any `links.internal` target whose page in `ctx.pages` has `httpStatus>=400` or `==null` | `{ href }` (one issue per broken target) |
| `links.orphan_page` | `inSitemap && !ctx.internalLinkTargets.has(normalize(url))` | `{}` |

(`links.broken_external` is deferred — external HEAD checks add crawl surface; add in P4. Do not implement now — YAGNI.)

**`images.js`** (`check`, 200-gated): `images.missing_alt` — any `img.alt === null`; one issue listing count. evidence `{ count, sample: srcs.slice(0,5) }`.

**`structuredData.js`** (`check`, 200-gated, indexable types):
| ruleKey | condition | evidence |
|---|---|---|
| `schema.missing` | `jsonLd.length === 0` | `{}` |
| `schema.invalid_json` | any `jsonLd` entry has `__invalid` | `{ count }` |
| `schema.wrong_type` | expected type for `pageType` absent — `host`→`Person`\|`ProfilePage`, `service`→`Service`\|`Product`, `blog`→`Article`\|`BlogPosting`. Skip `static`. | `{ expected, found }` |

**`sitemap.js`** (`siteCheck(ctx)`, once): `sitemap.missing_indexable` — for each page with `pageType` in indexable types, `httpStatus===200`, no `noindex`, but `!ctx.sitemapUrls.has(url)` → issue. evidence `{ url }`. affectedUrl = that url.

Registry additions:
```js
  'links.broken_internal': { category:'links', severity:'P1', confidence:1, autoFixable:false, title:'Broken internal link' },
  'links.orphan_page':     { category:'internal_linking', severity:'P2', confidence:0.7, autoFixable:false, title:'Orphan page (no internal links)' },
  'images.missing_alt':    { category:'onpage', severity:'P3', confidence:1, autoFixable:true, title:'Images missing alt text' },
  'schema.missing':        { category:'onpage', severity:'P3', confidence:0.7, autoFixable:false, title:'No structured data' },
  'schema.invalid_json':   { category:'onpage', severity:'P2', confidence:1, autoFixable:false, title:'Invalid JSON-LD' },
  'schema.wrong_type':     { category:'onpage', severity:'P3', confidence:0.6, autoFixable:false, title:'Missing expected schema type' },
  'sitemap.missing_indexable': { category:'indexability', severity:'P2', confidence:0.8, autoFixable:false, title:'Indexable page missing from sitemap' },
```

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/seoRules.misc.test.js
const links = require('../../services/seo/rules/links');
const images = require('../../services/seo/rules/images');
const schema = require('../../services/seo/rules/structuredData');
const sitemap = require('../../services/seo/rules/sitemap');
const { buildContext } = require('../../services/seo/rules/index');

test('broken_internal fires when a linked page is 404', () => {
  const target = { url: 'https://bookasloth.com/dead', httpStatus: 404 };
  const src = { url: 'https://bookasloth.com/a', pageType: 'static', httpStatus: 200, links: { internal: ['https://bookasloth.com/dead'], external: [] }, images: [] };
  const ctx = buildContext([src, target], new Set());
  expect(links.check(src, ctx).map((i) => i.ruleKey)).toContain('links.broken_internal');
});
test('missing_alt fires when an image has no alt', () => {
  const p = { url: 'https://bookasloth.com/a', pageType: 'static', httpStatus: 200, images: [{ src: '/x.jpg', alt: null }], links: { internal: [], external: [] } };
  expect(images.check(p, buildContext([p], new Set())).map((i) => i.ruleKey)).toContain('images.missing_alt');
});
test('schema.missing fires with no json-ld', () => {
  const p = { url: 'https://bookasloth.com/a', pageType: 'blog', httpStatus: 200, jsonLd: [], images: [], links: { internal: [], external: [] } };
  expect(schema.check(p, buildContext([p], new Set())).map((i) => i.ruleKey)).toContain('schema.missing');
});
test('sitemap.missing_indexable fires for a 200 indexable page not in the sitemap', () => {
  const p = { url: 'https://bookasloth.com/a', pageType: 'static', httpStatus: 200, robots: 'index', images: [], links: { internal: [], external: [] } };
  const ctx = buildContext([p], new Set()); // empty sitemap set
  expect(sitemap.siteCheck(ctx).map((i) => i.ruleKey)).toContain('sitemap.missing_indexable');
});
```

- [ ] **Step 2: Run test → FAIL.**
- [ ] **Step 3: Implement the four modules per the tables; add registry keys; add all four to `GROUPS`** (sitemap contributes via `siteCheck`).
- [ ] **Step 4: Run test → PASS.**
- [ ] **Step 5: Commit** — `git add server/services/seo/rules/*.js server/tests/unit/seoRules.misc.test.js && git commit -m "feat(seo): links/images/schema/sitemap rules"`

---

### Task 7: `prioritize.js`

**Files:**
- Create: `server/services/seo/prioritize.js`
- Test: `server/tests/unit/seoPrioritize.test.js`

**Interfaces:**
- Produces: `prioritize(issue, ctx) => { severity, priorityScore }` and `WEIGHTS`. Consumed by Task 10. `severity` passes through from the registry base; `priorityScore = SEV_WEIGHT[severity] * confidence * scope / effort`, where `scope` = number of affected pages for dup/site rules (from evidence.count) else 1, `effort` = 1 (P1 has no effort model; leave the knob).

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/seoPrioritize.test.js
const { prioritize } = require('../../services/seo/prioritize');
test('P0 outranks P3', () => {
  const a = prioritize({ severity: 'P0', confidence: 1, evidence: {} }, {});
  const b = prioritize({ severity: 'P3', confidence: 1, evidence: {} }, {});
  expect(a.priorityScore).toBeGreaterThan(b.priorityScore);
});
test('scope from evidence.count raises the score', () => {
  const one = prioritize({ severity: 'P2', confidence: 1, evidence: {} }, {});
  const many = prioritize({ severity: 'P2', confidence: 1, evidence: { count: 10 } }, {});
  expect(many.priorityScore).toBeGreaterThan(one.priorityScore);
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

```js
// server/services/seo/prioritize.js
// Deterministic priority: Impact(severity) x Confidence x Scope / Effort. Configurable.
const SEV_WEIGHT = { P0: 100, P1: 60, P2: 30, P3: 12, P4: 4 };
const WEIGHTS = { SEV_WEIGHT };
function prioritize(issue, _ctx) {
  const impact = SEV_WEIGHT[issue.severity] ?? 4;
  const confidence = issue.confidence ?? 1;
  const scope = Math.max(1, Number(issue.evidence?.count) || 1);
  const effort = 1; // P1: no effort model yet — tuning knob for later phases
  return { severity: issue.severity, priorityScore: Math.round(impact * confidence * scope / effort * 100) / 100 };
}
module.exports = { prioritize, WEIGHTS };
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git add server/services/seo/prioritize.js server/tests/unit/seoPrioritize.test.js && git commit -m "feat(seo): deterministic issue prioritization"`

---

### Task 8: `healthScore.js`

**Files:**
- Create: `server/services/seo/healthScore.js`
- Test: `server/tests/unit/seoHealthScore.test.js`

**Interfaces:**
- Produces: `score(issues) => { overall, technical, onpage, content, indexability, internal_linking, breakdown }`. Consumed by Task 10. Each category starts at 100; subtract `PENALTY[severity]` per issue in that category; clamp [0,100]. `content` category maps from `onpage` schema/word issues for now (P1 has no separate content analysis → `content === onpage`; leave both keys for the dashboard). `overall` = rounded average of the five.

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/seoHealthScore.test.js
const { score } = require('../../services/seo/healthScore');
test('a clean crawl scores 100 across the board', () => {
  const s = score([]);
  expect(s.overall).toBe(100);
  expect(s.technical).toBe(100);
});
test('P0 technical issues drag the technical + overall score down', () => {
  const s = score([{ category: 'technical', severity: 'P0' }, { category: 'technical', severity: 'P0' }]);
  expect(s.technical).toBeLessThan(100);
  expect(s.overall).toBeLessThan(100);
  expect(s.breakdown.technical.length).toBe(2);
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

```js
// server/services/seo/healthScore.js
// Deterministic per-category health. Never AI-generated.
const PENALTY = { P0: 40, P1: 20, P2: 10, P3: 4, P4: 1 };
const CATEGORIES = ['technical', 'onpage', 'indexability', 'internal_linking'];
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

function score(issues = []) {
  const deducted = {}; const breakdown = {};
  for (const c of CATEGORIES) { deducted[c] = 0; breakdown[c] = []; }
  for (const i of issues) {
    const c = CATEGORIES.includes(i.category) ? i.category : 'onpage';
    deducted[c] += PENALTY[i.severity] ?? 1;
    breakdown[c].push({ ruleKey: i.ruleKey, severity: i.severity, penalty: PENALTY[i.severity] ?? 1 });
  }
  const technical = clamp(100 - deducted.technical);
  const onpage = clamp(100 - deducted.onpage);
  const indexability = clamp(100 - deducted.indexability);
  const internal_linking = clamp(100 - deducted.internal_linking);
  const content = onpage; // P1: no separate content analysis yet
  const overall = clamp((technical + onpage + indexability + internal_linking + content) / 5);
  return { overall, technical, onpage, content, indexability, internal_linking, breakdown };
}
module.exports = { score, PENALTY };
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git add server/services/seo/healthScore.js server/tests/unit/seoHealthScore.test.js && git commit -m "feat(seo): per-category health scoring"`

---

### Task 9: `seoPersist.js` — write a crawl to Supabase

**Files:**
- Create: `server/services/seo/seoPersist.js`
- Test: `server/tests/unit/seoPersist.test.js`

**Interfaces:**
- Produces: `createCrawl({trigger, triggeredBy}) => crawlId`; `finishCrawl(id, {status, counts, error})`; `saveResults(crawlId, pages, issues, scores) => void`. Consumed by Task 10. Uses `supabaseAdmin`.
- Persistence detail: insert `seo_crawl_pages` (with `.select('id,url')` to map url→page_id), then attach `page_id` to each issue via its `affectedUrl`, then insert `seo_issues` + one `seo_score_snapshots` row. Skip issues whose `(rule_key,url)` is muted (query `seo_issue_mutes` once).

- [ ] **Step 1: Write the failing test** (Supabase mocked with the repo's thenable builder)

```js
// server/tests/unit/seoPersist.test.js
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
const { supabaseAdmin } = require('../../config/supabase');
const persist = require('../../services/seo/seoPersist');

const insertReturning = (rows) => ({
  insert: jest.fn(() => ({ select: jest.fn(() => ({ then: (r) => Promise.resolve({ data: rows, error: null }).then(r) })) })),
});
const selectAll = (rows) => ({ select: jest.fn(() => ({ then: (r) => Promise.resolve({ data: rows, error: null }).then(r) })) });

test('saveResults maps issues to page ids and skips muted rules', async () => {
  const calls = {};
  supabaseAdmin.from.mockImplementation((table) => {
    calls[table] = (calls[table] || 0) + 1;
    if (table === 'seo_issue_mutes') return selectAll([{ rule_key: 'onpage.missing_h1', url_pattern: null }]);
    if (table === 'seo_crawl_pages') return insertReturning([{ id: 'pg1', url: 'https://bookasloth.com/a' }]);
    if (table === 'seo_issues') return insertReturning([{ id: 'is1' }]);
    if (table === 'seo_score_snapshots') return insertReturning([{ id: 'sn1' }]);
    return insertReturning([]);
  });
  const pages = [{ url: 'https://bookasloth.com/a', pageType: 'static', httpStatus: 200, h1: [] }];
  const issues = [
    { ruleKey: 'onpage.missing_title', affectedUrl: 'https://bookasloth.com/a', category: 'onpage', severity: 'P1', confidence: 1, title: 't', evidence: {}, autoFixable: false, priorityScore: 60 },
    { ruleKey: 'onpage.missing_h1', affectedUrl: 'https://bookasloth.com/a', category: 'onpage', severity: 'P2', confidence: 1, title: 'h', evidence: {}, autoFixable: false, priorityScore: 30 },
  ];
  await persist.saveResults('crawl1', pages, issues, { overall: 90, technical: 100, onpage: 80, content: 80, indexability: 100, internal_linking: 100, breakdown: {} });
  expect(calls.seo_crawl_pages).toBe(1);
  expect(calls.seo_issues).toBe(1);        // one insert call
  expect(calls.seo_score_snapshots).toBe(1);
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `seoPersist.js`** — `createCrawl` inserts a `seo_crawls` row (status 'running') and returns its id; `finishCrawl` updates status/counts/finished_at; `saveResults` does the mute-filter + page insert + url→id map + issue insert (snake_case columns: `rule_key`, `priority_score`, `affected_url`, `auto_fixable`, `page_id`) + snapshot insert. Guard every `{ data, error }` and throw on `error` (caught by the caller). Reference the mock shape above for the exact chaining the code must use (`.insert(...).select(...)`).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git add server/services/seo/seoPersist.js server/tests/unit/seoPersist.test.js && git commit -m "feat(seo): persist crawl results (pages/issues/scores, mute-aware)"`

---

### Task 10: `seoCrawler.js` — orchestrator (seed + pipeline)

**Files:**
- Create: `server/services/seo/seoCrawler.js`
- Test: `server/tests/integration/seoCrawler.test.js`

**Interfaces:**
- Produces: `run({trigger, triggeredBy}) => crawlId` (awaits full pipeline — used by the nightly job); `start({trigger, triggeredBy}) => crawlId` (creates the row, fires the pipeline un-awaited, returns id — used by the API); `seedUrls() => {url,pageType,inSitemap}[]`.
- Consumes: `sitemapService` (`fetchHosts/fetchServices/fetchBlogs/fetchProfessions`, `staticEntries`, `hostUrl`, `serviceUrl`), `seoFetch.fetchUrl`, `seoParse.parse`, `rules/index` (`buildContext/runRules/runSiteRules`), `prioritize`, `healthScore`, `seoPersist`, `jobLock.runLocked`.

- [ ] **Step 1: Write the failing integration test** (mock fetch + persist + sitemap)

```js
// server/tests/integration/seoCrawler.test.js
jest.mock('../../services/seo/seoFetch', () => ({
  fetchUrl: jest.fn(async (url) => ({
    status: 200, finalUrl: url, redirectChain: [], responseMs: 50, contentType: 'text/html',
    headers: {}, body: `<title>${url}</title><h1>${url}</h1><meta name="description" content="${'d'.repeat(150)}">`, error: null,
  })),
}));
jest.mock('../../services/seo/seoPersist', () => ({
  createCrawl: jest.fn(async () => 'crawl1'),
  finishCrawl: jest.fn(async () => {}),
  saveResults: jest.fn(async () => {}),
}));
jest.mock('../../services/sitemapService', () => ({
  STATIC_ROUTES: [{ path: '/', changefreq: 'daily', priority: 1 }],
  staticEntries: () => [{ loc: 'https://bookasloth.com/' }],
  hostUrl: (s, u) => `${s}/${u}`, serviceUrl: (s, u, sl) => `${s}/${u}/${sl}`,
  fetchHosts: async () => [{ username: 'jane', updated_at: null }],
  fetchServices: async () => [{ slug: 'intro', profiles: { username: 'jane' } }],
  fetchBlogs: async () => [{ slug: 'post-1' }],
  fetchProfessions: async () => [],
}));
jest.mock('../../utils/jobLock', () => ({ runLocked: (_n, fn) => fn() }));

const persist = require('../../services/seo/seoPersist');
const { run, seedUrls } = require('../../services/seo/seoCrawler');

describe('seoCrawler', () => {
  test('seedUrls includes static, host, service, blog URLs', async () => {
    const urls = await seedUrls();
    const list = urls.map((u) => u.url);
    expect(list).toContain('https://bookasloth.com/');
    expect(list).toContain('https://bookasloth.com/jane');
    expect(list).toContain('https://bookasloth.com/jane/intro');
    expect(list).toContain('https://bookasloth.com/blog/post-1');
  });
  test('run() crawls, scores and persists', async () => {
    const id = await run({ trigger: 'manual' });
    expect(id).toBe('crawl1');
    expect(persist.saveResults).toHaveBeenCalledTimes(1);
    const [, pages, issues, scores] = persist.saveResults.mock.calls[0];
    expect(pages.length).toBeGreaterThan(0);
    expect(Array.isArray(issues)).toBe(true);
    expect(scores.overall).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `seoCrawler.js`**

```js
// server/services/seo/seoCrawler.js
const sm = require('../sitemapService');
const { fetchUrl } = require('./seoFetch');
const { parse } = require('./seoParse');
const { buildContext, runRules, runSiteRules } = require('./rules');
const { prioritize } = require('./prioritize');
const { score } = require('./healthScore');
const persist = require('./seoPersist');
const { runLocked } = require('../../utils/jobLock');

const SITE_URL = (process.env.SITE_URL || 'https://bookasloth.com').replace(/\/$/, '');
const CONCURRENCY = Number(process.env.SEO_CRAWL_CONCURRENCY) || 4;
const DELAY_MS = Number(process.env.SEO_CRAWL_DELAY_MS) || 150;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function seedUrls() {
  const out = [];
  const seen = new Set();
  const add = (url, pageType) => { if (!seen.has(url)) { seen.add(url); out.push({ url, pageType, inSitemap: true }); } };
  for (const e of sm.staticEntries(SITE_URL)) add(e.loc.replace(/\/$/, '') || `${SITE_URL}/`, 'static');
  add(`${SITE_URL}/`, 'static');
  for (const h of await sm.fetchHosts()) add(sm.hostUrl(SITE_URL, h.username), 'host');
  for (const s of await sm.fetchServices()) if (s.profiles?.username) add(sm.serviceUrl(SITE_URL, s.profiles.username, s.slug), 'service');
  for (const b of await sm.fetchBlogs()) add(`${SITE_URL}/blog/${b.slug}`, 'blog');
  for (const p of await sm.fetchProfessions()) add(`${SITE_URL}/for/${p.slug}`, 'static');
  return out;
}

async function crawlOne(seed) {
  const r = await fetchUrl(seed.url);
  const parsed = r.status === 200 && (r.contentType || '').includes('html') ? parse(r.body, r.headers) : {};
  const noindex = parsed.robots ? parsed.robots.includes('noindex') : null;
  return {
    url: seed.url, pageType: seed.pageType, inSitemap: seed.inSitemap,
    httpStatus: r.status, finalUrl: r.finalUrl, redirectChain: r.redirectChain, responseMs: r.responseMs, contentType: r.contentType,
    title: parsed.title || null, metaDescription: parsed.metaDescription || null, canonical: parsed.canonical || null,
    robots: parsed.robots || null, h1: parsed.h1 || [], headings: parsed.headings || [],
    links: parsed.links || { internal: [], external: [] }, images: parsed.images || [], jsonLd: parsed.jsonLd || [],
    wordCount: parsed.wordCount || 0, viewport: parsed.viewport || null,
    indexable: r.status === 200 && noindex === false, fetchError: r.error,
  };
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
  return runLocked('seo-crawl', async () => {
    const sitemapUrls = new Set(seeds.map((s) => s.url));
    const pages = await pool(seeds, CONCURRENCY, crawlOne);
    const ctx = buildContext(pages, sitemapUrls);
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
  try { await _execute(crawlId, await seedUrls()); }
  catch (e) { await persist.finishCrawl(crawlId, { status: 'failed', error: e.message }); throw e; }
  return crawlId;
}
async function start({ trigger = 'manual', triggeredBy = null } = {}) {
  const crawlId = await persist.createCrawl({ trigger, triggeredBy });
  seedUrls().then((s) => _execute(crawlId, s)).catch((e) => persist.finishCrawl(crawlId, { status: 'failed', error: e.message }));
  return crawlId;
}
module.exports = { run, start, seedUrls };
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git add server/services/seo/seoCrawler.js server/tests/integration/seoCrawler.test.js && git commit -m "feat(seo): crawler orchestrator (seed + pipeline)"`

---

### Task 11: Read service + admin controller + routes + mount

**Files:**
- Create: `server/services/seo/seoAuditService.js`
- Create: `server/controllers/seoAdminController.js`
- Create: `server/routes/seoRoutes.js`
- Modify: `server/routes/adminRoutes.js` (add `router.use('/seo', require('./seoRoutes'));` near line 37)
- Test: `server/tests/unit/seoAdminController.test.js`

**Interfaces:**
- `seoAuditService`: `latestOverview()`, `listIssues(filters)`, `getIssue(id)`, `listPages(filters)`, `getPage(id)`, `scoreHistory()`, `muteIssue(id, {ruleType, mutedBy})` — all via `supabaseAdmin`.
- `seoAdminController`: `getOverview/getIssues/getIssue/getPages/getPage/getScoreHistory/postCrawl/getCrawl/postMuteIssue` — each `async (req,res)` with `try { … res.json(...) } catch (e) { safeError(res, e); }`.
- `postCrawl` calls `seoCrawler.start({ trigger:'manual', triggeredBy: req.admin.id })` and returns `{ crawlId }`.
- Routes (all `requireAdmin('seo.manage')`): `GET /overview`, `GET /issues`, `GET /issues/:id`, `GET /pages`, `GET /pages/:id`, `GET /scores/history`, `POST /crawl`, `GET /crawl/:id`, `POST /issues/:id/mute`.

- [ ] **Step 1: Write the failing controller test** (mirror `insightsAdminController.test.js`)

```js
// server/tests/unit/seoAdminController.test.js
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: jest.fn((res, err) => res.status(500).json({ message: err?.message })) }));
jest.mock('../../services/seo/seoCrawler', () => ({ start: jest.fn(async () => 'crawlX') }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const crawler = require('../../services/seo/seoCrawler');
const ctrl = require('../../controllers/seoAdminController');

const makeQuery = (result) => {
  const q = {}; ['select', 'eq', 'order', 'limit', 'range', 'single', 'insert', 'maybeSingle'].forEach((m) => (q[m] = jest.fn(() => q)));
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return q;
};
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('getOverview returns the latest crawl + scores', async () => {
  supabaseAdmin.from.mockImplementation((t) => {
    if (t === 'seo_crawls') return makeQuery({ data: [{ id: 'c1', status: 'done', page_count: 5, issue_count: 3 }], error: null });
    if (t === 'seo_score_snapshots') return makeQuery({ data: [{ overall: 88 }], error: null });
    if (t === 'seo_issues') return makeQuery({ data: [{ severity: 'P0' }], error: null });
    return makeQuery({ data: [], error: null });
  });
  const r = res();
  await ctrl.getOverview({ query: {} }, r);
  expect(r.json).toHaveBeenCalled();
  expect(r.json.mock.calls[0][0].crawl.id).toBe('c1');
});

test('postCrawl kicks off a crawl and returns the id', async () => {
  const r = res();
  await ctrl.postCrawl({ admin: { id: 'admin1' }, body: {} }, r);
  expect(crawler.start).toHaveBeenCalledWith({ trigger: 'manual', triggeredBy: 'admin1' });
  expect(r.json.mock.calls[0][0].crawlId).toBe('crawlX');
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `seoAuditService.js`, `seoAdminController.js`, `seoRoutes.js`; mount in `adminRoutes.js`.** Controller imports: `const { safeError } = require('../utils/httpError'); const { supabaseAdmin } = require('../config/supabase'); const { audit } = require('../services/auditService'); const crawler = require('../services/seo/seoCrawler'); const svc = require('../services/seo/seoAuditService');`. `getOverview` reads the newest `seo_crawls` row (`.order('started_at',{ascending:false}).limit(1)`), its snapshot, and severity counts, and returns `{ crawl, scores, counts }`. `postMuteIssue` writes `seo_issue_mutes` and calls `audit(...)`. `seoRoutes.js` mirrors `gstRoutes.js` verbatim (require express/router/requireAdmin, `const c = require('../controllers/seoAdminController');`, the 9 routes, `module.exports = router;`).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git add server/services/seo/seoAuditService.js server/controllers/seoAdminController.js server/routes/seoRoutes.js server/routes/adminRoutes.js server/tests/unit/seoAdminController.test.js && git commit -m "feat(seo): admin read API + on-demand crawl endpoint"`

---

### Task 12: Nightly job wiring

**Files:**
- Modify: `server/server.js` (append one entry to `SCHEDULED_JOBS`, ~line 413, before the closing `];`)

**Interfaces:**
- Consumes: `seoCrawler.run` (Task 10), the existing `runIfDue` loop.

- [ ] **Step 1: Add the scheduled job entry**

Insert into the `SCHEDULED_JOBS` array (after the last existing entry, before `];`):

```js
  { name: 'seo-crawl', min: Number(process.env.SEO_CRAWL_INTERVAL_MIN) || 24 * 60, run: () => require('./services/seo/seoCrawler').run({ trigger: 'nightly' }) },
```

- [ ] **Step 2: Smoke-check the server boots**

Run: `cd server && node -e "require('./services/seo/seoCrawler')"`
Expected: no throw (module graph loads). Do NOT run a live crawl here.

- [ ] **Step 3: Commit**

```bash
git add server/server.js
git commit -m "feat(seo): nightly seo-crawl via SCHEDULED_JOBS"
```

---

### Task 13: Client — API helpers, `AdminSeo` page, route, nav

**Files:**
- Modify: `client/src/services/api.js` (add `adminSeo*` helpers)
- Create: `client/src/pages/admin/AdminSeo.jsx`
- Modify: `client/src/App.jsx` (lazy import + route under the admin block)
- Modify: `client/src/components/admin/adminNav.js` (NAV item in the Growth section + `PATH_LABELS` entry)
- Test: `client/src/pages/admin/__tests__/AdminSeo.test.jsx`

**Interfaces:**
- `api.js` adds: `adminSeoOverview()`, `adminSeoIssues(params)`, `adminSeoIssue(id)`, `adminSeoPages(params)`, `adminSeoRunCrawl()`, `adminSeoCrawlStatus(id)`, `adminSeoMuteIssue(id, data)`, `adminSeoScoreHistory()`.
- `AdminSeo.jsx`: default-export page with three internal tabs (Overview / Issues / Pages), Overview default. Reuses `PageHeader, Card, StatCard, Badge, Skeleton` from `../../components/admin/ui`.

- [ ] **Step 1: Add API helpers** (append near the GST helpers, `client/src/services/api.js`)

```js
export const adminSeoOverview     = ()        => API.get('/admin/seo/overview');
export const adminSeoIssues       = (params)  => API.get('/admin/seo/issues', { params });
export const adminSeoIssue        = (id)      => API.get(`/admin/seo/issues/${id}`);
export const adminSeoPages        = (params)  => API.get('/admin/seo/pages', { params });
export const adminSeoRunCrawl     = ()        => API.post('/admin/seo/crawl');
export const adminSeoCrawlStatus  = (id)      => API.get(`/admin/seo/crawl/${id}`);
export const adminSeoMuteIssue    = (id, data) => API.post(`/admin/seo/issues/${id}/mute`, data);
export const adminSeoScoreHistory = ()        => API.get('/admin/seo/scores/history');
```

- [ ] **Step 2: Write the failing client test** (mirror `AdminFinance.test.jsx`, no jest-dom)

```jsx
// client/src/pages/admin/__tests__/AdminSeo.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminSeo from '../AdminSeo';

vi.mock('../../../services/api', () => ({
  adminSeoOverview: vi.fn(() => Promise.resolve({ data: {
    crawl: { id: 'c1', status: 'done', page_count: 12, issue_count: 4, started_at: new Date().toISOString() },
    scores: { overall: 82, technical: 90, onpage: 75, content: 75, indexability: 88, internal_linking: 100 },
    counts: { P0: 1, P1: 1, P2: 2, P3: 0, P4: 0 },
  } })),
  adminSeoIssues: vi.fn(() => Promise.resolve({ data: { issues: [], total: 0 } })),
  adminSeoPages: vi.fn(() => Promise.resolve({ data: { pages: [], total: 0 } })),
  adminSeoRunCrawl: vi.fn(() => Promise.resolve({ data: { crawlId: 'c2' } })),
  adminSeoCrawlStatus: vi.fn(() => Promise.resolve({ data: { status: 'done' } })),
  adminSeoMuteIssue: vi.fn(() => Promise.resolve({ data: {} })),
  adminSeoScoreHistory: vi.fn(() => Promise.resolve({ data: { snapshots: [] } })),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

describe('AdminSeo', () => {
  it('renders the overall health score from the latest crawl', async () => {
    render(<MemoryRouter><AdminSeo /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('82')).toBeTruthy());
    expect(screen.getByText(/Overall/i)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run → FAIL.**

Run: `cd client && npx vitest run src/pages/admin/__tests__/AdminSeo.test.jsx`
Expected: FAIL — `AdminSeo` not found.

- [ ] **Step 4: Implement `AdminSeo.jsx`** — mirror `AdminGstOverview.jsx`'s load/loading/toast shape. Overview tab: 6 `StatCard`s (overall + 5 categories) reading `scores`, a crawl-stats strip from `crawl`+`counts`, and a "Run crawl now" button calling `adminSeoRunCrawl()` then polling `adminSeoCrawlStatus`. Issues tab: `adminSeoIssues` table with severity/category filters + a detail drawer (reuse the `SeoDrawer` structure) exposing mute. Pages tab: `adminSeoPages` table. Use the admin `ui` primitives; label the overall score card text "Overall".

- [ ] **Step 5: Wire route + nav**

`client/src/App.jsx` — lazy import beside the GST imports:
```jsx
const AdminSeo = lazy(() => import('./pages/admin/AdminSeo'));
```
Route in the admin block:
```jsx
          <Route path="/admin/seo" element={<AdminWrapper><AdminSeo /></AdminWrapper>} />
```
`client/src/components/admin/adminNav.js` — add to the Growth section's `items` array:
```js
    { label:'SEO', icon:'search', to:'/admin/seo', perm:'seo.manage' },
```
and a `PATH_LABELS` entry: `seo:'SEO',`. (If `IC` has no `search` glyph, add one or reuse an existing icon key.)

- [ ] **Step 6: Run the test → PASS**, then the full client suite.

Run: `cd client && npx vitest run src/pages/admin/__tests__/AdminSeo.test.jsx` → PASS
Run: `cd client && npx vitest run` → all green (deploy gate).

- [ ] **Step 7: Commit**

```bash
git add client/src/services/api.js client/src/pages/admin/AdminSeo.jsx client/src/App.jsx client/src/components/admin/adminNav.js client/src/pages/admin/__tests__/AdminSeo.test.jsx
git commit -m "feat(seo): /admin/seo audit dashboard (overview/issues/pages)"
```

---

### Task 14: Full-suite gate + PR

**Files:** none (verification + handoff)

- [ ] **Step 1: Server tests**

Run: `cd server && npm test`
Expected: green. Only pre-existing unrelated failures (if any) are acceptable — note them.

- [ ] **Step 2: Client build + tests**

Run: `cd client && npx vitest run && npm run build`
Expected: both green.

- [ ] **Step 3: Open the PR (do NOT merge)**

```bash
git push -u origin feat/seo-audit-engine
gh pr create --base main --title "feat(seo): P1 SEO Audit Engine — crawler + rules + /admin/seo dashboard" --body "$(cat <<'EOF'
Read-only SEO Audit Engine (Phase 1). Crawls indexable URLs, runs deterministic rules mapped to the weekly GSC SOP, prioritizes + scores, and surfaces everything at /admin/seo. Writes nothing to live SEO fields.

Spec: docs/superpowers/specs/2026-09-07-seo-audit-engine-design.md
Plan: docs/superpowers/plans/2026-09-07-seo-audit-engine-p1.md

Migration: v3.145_seo_audit.sql — applied to staging; **apply to prod at deploy**.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Hand the PR link to the user.** Remind: apply `v3.145` to prod at deploy; nightly crawl runs on the `SCHEDULER_TICK`; first crawl can be triggered from the dashboard's "Run crawl now".

---

## Self-Review

**Spec coverage:** crawler (T3,T10) · seed from sitemap (T10) · deterministic rules incl. all §4 catalog groups (T4–T6) · GSC-SOP triggers: soft-404/canonical/noindex/prerender-regression/sitemap (T5,T6) · prioritization P0–P4 (T7) · per-category health §18 (T8) · 5 tables §5 (T1) · admin API §6 (T11) · dashboard §7 (T13) · nightly §8 (T12) · mute/ignore §21 (T1,T9,T11) · `seo.manage` reuse (T11) · tests (every task). **Gaps:** none for P1 scope. `dbScan` intentionally dropped (documented deviation). `links.broken_external` intentionally deferred to P4 (documented in T6).

**Placeholder scan:** rule fan-out in T5/T6 uses precise condition tables (exact keys, conditions, evidence, severity) + a fully-coded exemplar (`onpage.js`) they clone — complete information, not "implement later." No TBDs.

**Type consistency:** `pageData`/`issue`/`ctx` shapes fixed in the contracts block and used verbatim across parse→rules→prioritize→score→persist→crawler. `run`/`start`/`seedUrls`, `createCrawl`/`finishCrawl`/`saveResults`, `buildContext`/`runRules`/`runSiteRules`, `prioritize`, `score` names consistent across tasks. Registry severity/category feed both prioritize and healthScore consistently.
