'use strict';
// seoAuditService.js — read helpers for the SEO Audit Engine admin API (v3.145
// tables: seo_crawls, seo_crawl_pages, seo_issues, seo_score_snapshots,
// seo_issue_mutes). Read-only except muteIssue. Every query goes through
// supabaseAdmin; a Supabase error is thrown so the controller's try/catch ->
// safeError handles it uniformly.
const { supabaseAdmin } = require('../../config/supabase');
const { scorePage } = require('./healthScore');
const { categoryForType } = require('./pageClassify');
const v2 = require('./scoring');
const robotsAudit = require('./robotsAudit');

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

// Newest done/skipped crawl id (falls back to newest of any status).
async function latestCrawlId() {
  const rows = unwrap(await supabaseAdmin.from('seo_crawls').select('id,status').order('started_at', { ascending: false }).limit(5));
  const done = (rows || []).find((c) => c.status === 'done');
  return (done || rows?.[0])?.id || null;
}

// Newest crawl + its score snapshot + open-issue counts by severity.
async function latestOverview() {
  const crawls = unwrap(await supabaseAdmin.from('seo_crawls').select('*').order('started_at', { ascending: false }).limit(1));
  const crawl = (crawls && crawls[0]) || null;
  if (!crawl) return { crawl: null, scores: null, counts: {} };

  const snaps = unwrap(await supabaseAdmin.from('seo_score_snapshots').select('*').eq('crawl_id', crawl.id).order('taken_at', { ascending: false }).limit(1));
  const scores = (snaps && snaps[0]) || null;

  const issues = unwrap(await supabaseAdmin.from('seo_issues').select('severity').eq('crawl_id', crawl.id));
  const counts = {};
  for (const i of issues || []) counts[i.severity] = (counts[i.severity] || 0) + 1;

  return { crawl, scores, counts };
}

async function listIssues(filters = {}) {
  let q = supabaseAdmin.from('seo_issues').select('*').order('priority_score', { ascending: false });
  if (filters.crawlId) q = q.eq('crawl_id', filters.crawlId);
  if (filters.severity) q = q.eq('severity', filters.severity);
  if (filters.category) q = q.eq('category', filters.category);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.limit) q = q.limit(Number(filters.limit));
  return unwrap(await q);
}

async function getIssue(id) {
  return unwrap(await supabaseAdmin.from('seo_issues').select('*').eq('id', id).maybeSingle());
}

async function listPages(filters = {}) {
  let q = supabaseAdmin.from('seo_crawl_pages').select('*').order('created_at', { ascending: false });
  if (filters.crawlId) q = q.eq('crawl_id', filters.crawlId);
  if (filters.pageType) q = q.eq('page_type', filters.pageType);
  if (filters.indexable != null) q = q.eq('indexable', filters.indexable);
  if (filters.limit) q = q.limit(Number(filters.limit));
  return unwrap(await q);
}

async function getPage(id) {
  const page = unwrap(await supabaseAdmin.from('seo_crawl_pages').select('*').eq('id', id).maybeSingle());
  if (!page) return null;
  const issueRows = unwrap(await supabaseAdmin.from('seo_issues').select('severity,category,rule_key,title,detail,affected_url').eq('page_id', id));
  const decorated = (issueRows || []).map((i) => ({ severity: i.severity, category: i.category, ruleKey: i.rule_key }));
  const sp = scorePage(decorated, page.page_type);

  const [gscMap, qMap, robots] = await Promise.all([gscMapByUrl(), queriesByUrl(), robotsAudit.getMap()]);
  const gsc = gscMap.get(page.url) || null;
  const queries = (qMap.get(page.url) || []).sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
  const scored = v2.scorePage(page, { issues: decorated, gsc, queries, robots });

  // Previous-crawl comparison: same URL in the prior done crawl, re-scored (spec §7).
  let previous = null;
  try {
    const prevCrawl = unwrap(await supabaseAdmin.from('seo_crawls').select('id').eq('status', 'done').lt('id', page.crawl_id).order('id', { ascending: false }).limit(1));
    const prevId = prevCrawl?.[0]?.id;
    if (prevId) {
      const prevPage = unwrap(await supabaseAdmin.from('seo_crawl_pages').select('*').eq('crawl_id', prevId).eq('url', page.url).maybeSingle());
      if (prevPage) {
        const prevIssues = unwrap(await supabaseAdmin.from('seo_issues').select('severity,category,rule_key').eq('page_id', prevPage.id));
        const prevDec = (prevIssues || []).map((i) => ({ severity: i.severity, category: i.category, ruleKey: i.rule_key }));
        const prevScored = v2.scorePage(prevPage, { issues: prevDec, gsc: null, queries: [], robots });
        previous = { seo_score: prevScored.seo.score, geo_score: prevScored.geo.score, at: prevPage.created_at };
      }
    }
  } catch { /* history optional */ }

  return {
    ...page,
    category: categoryForType(page.page_type),
    status: sp.status, health: sp.health, dimensions: sp.dimensions,
    critical_count: sp.criticalCount, issue_count: sp.issueCount,
    seo_score: scored.seo.score, geo_score: scored.geo.score,
    seo: scored.seo, geo: scored.geo,
    recommendations: scored.recommendations, signals: scored.signals,
    gsc: gscDelta(gsc),
    queries: queries.map((q) => ({
      query: q.query, clicks: q.clicks, impressions: q.impressions, ctr: q.ctr, position: q.position,
      prev_position: q.prev_position,
      position_change: q.prev_position != null && q.position != null ? Number((q.prev_position - q.position).toFixed(1)) : null,
    })),
    issues: (issueRows || []).map((i) => ({ severity: i.severity, category: i.category, rule_key: i.rule_key, title: i.title, detail: i.detail })),
    previous,
  };
}

// Score trend — most recent snapshots first, newest crawl last-in for a chart.
async function scoreHistory() {
  return unwrap(await supabaseAdmin.from('seo_score_snapshots').select('*').order('taken_at', { ascending: false }).limit(90));
}

async function getCrawl(id) {
  return unwrap(await supabaseAdmin.from('seo_crawls').select('*').eq('id', id).maybeSingle());
}

// Lightweight GSC sync status for the client to poll after triggering a sync — the
// newest last_synced advances as soon as the analytics batch upserts (early in the
// run), so the client can confirm "it actually synced" without a jobs table. Fail
// soft (table may be pre-sync / missing).
async function gscStatus() {
  try {
    const rows = unwrap(await supabaseAdmin.from('seo_gsc_urls').select('last_synced').order('last_synced', { ascending: false }).limit(1));
    return { last_synced: rows?.[0]?.last_synced || null };
  } catch { return { last_synced: null }; }
}

// GSC-synced URLs (seo_gsc_urls, populated by services/seo/gscSync). Fail soft:
// table may not exist yet pre-cutover, or the query may error — never throw.
async function listGscUrls({ limit = 500 } = {}) {
  try {
    return unwrap(await supabaseAdmin.from('seo_gsc_urls').select('*').order('impressions', { ascending: false }).limit(limit));
  } catch (e) {
    return [];
  }
}

// ── Phase 1 read-time intelligence (no writes, no migration) ─────────────────

// Evidence maturity (spec §1i): how many crawls a URL has appeared in. Thresholds
// configurable — one bad/good month must not make a page sacred or disposable.
// ponytail: tallies the whole url column in one query. Fine at current volume;
// swap for a grouped aggregate if seo_crawl_pages grows past a few 100k rows.
const MATURITY = { developing: Number(process.env.SEO_MATURITY_DEVELOPING) || 2, established: Number(process.env.SEO_MATURITY_ESTABLISHED) || 5, strong: Number(process.env.SEO_MATURITY_STRONG) || 12 };
function maturityLevel(n) {
  if (n >= MATURITY.strong) return 'STRONG';
  if (n >= MATURITY.established) return 'ESTABLISHED';
  if (n >= MATURITY.developing) return 'DEVELOPING';
  return 'NEW';
}
async function maturityByUrl() {
  const rows = unwrap(await supabaseAdmin.from('seo_crawl_pages').select('url').limit(100000));
  const counts = new Map();
  for (const r of rows || []) counts.set(r.url, (counts.get(r.url) || 0) + 1);
  return counts;
}

// ── GSC read helpers (fail soft: tables may be pre-migration / unsynced) ──────
async function gscMapByUrl() {
  try {
    const rows = unwrap(await supabaseAdmin.from('seo_gsc_urls').select('*'));
    return new Map((rows || []).map((r) => [r.url, r]));
  } catch { return new Map(); }
}
async function queriesByUrl() {
  try {
    const rows = unwrap(await supabaseAdmin.from('seo_gsc_queries').select('*'));
    const m = new Map();
    for (const r of rows || []) { if (!m.has(r.url)) m.set(r.url, []); m.get(r.url).push(r); }
    return m;
  } catch { return new Map(); }
}
// Flatten a seo_gsc_urls row into the drawer/list performance block with deltas.
// positionChange > 0 means the page IMPROVED (lower average position is better).
function gscDelta(g) {
  if (!g) return null;
  const posChange = g.prev_position != null && g.position != null ? Number((g.prev_position - g.position).toFixed(1)) : null;
  return {
    clicks: g.clicks || 0, impressions: g.impressions || 0, ctr: g.ctr || 0, position: g.position,
    prev_clicks: g.prev_clicks, prev_impressions: g.prev_impressions, prev_position: g.prev_position,
    clicks_change: g.prev_clicks != null ? (g.clicks || 0) - g.prev_clicks : null,
    impressions_change: g.prev_impressions != null ? (g.impressions || 0) - g.prev_impressions : null,
    position_change: posChange,
    coverage_state: g.coverage_state || null, google_canonical: g.google_canonical || null,
  };
}

// Core: every page of a crawl, enriched with v1 status (kept for compat) AND the v2
// SEO + GEO scores, breakdowns, recommendations, GSC performance and query counts.
// Shared by pageReports / pageList / categoryRollups / opportunities so scoring runs once.
async function scoredPages({ crawlId } = {}) {
  const id = crawlId || (await latestCrawlId());
  if (!id) return { crawlId: null, pages: [] };
  const pages = unwrap(await supabaseAdmin.from('seo_crawl_pages').select('*').eq('crawl_id', id));
  const issues = unwrap(await supabaseAdmin.from('seo_issues').select('severity,category,rule_key,affected_url').eq('crawl_id', id));
  const byUrl = new Map();
  for (const i of issues || []) {
    if (!byUrl.has(i.affected_url)) byUrl.set(i.affected_url, []);
    byUrl.get(i.affected_url).push({ severity: i.severity, category: i.category, ruleKey: i.rule_key });
  }
  const [maturity, gscMap, qMap, robots] = await Promise.all([
    maturityByUrl(), gscMapByUrl(), queriesByUrl(), robotsAudit.getMap(),
  ]);
  const out = (pages || []).map((p) => {
    const pageIssues = byUrl.get(p.url) || [];
    const sp = scorePage(pageIssues, p.page_type); // v1 hard status
    const gsc = gscMap.get(p.url) || null;
    const queries = qMap.get(p.url) || [];
    const scored = v2.scorePage(p, { issues: pageIssues, gsc, queries, robots });
    const seen = maturity.get(p.url) || 1;
    return {
      ...p,
      category: categoryForType(p.page_type),
      status: sp.status, health: sp.health, dimensions: sp.dimensions,
      critical_count: sp.criticalCount, issue_count: sp.issueCount,
      evidence_seen: seen, evidence_maturity: maturityLevel(seen),
      seo_score: scored.seo.score, geo_score: scored.geo.score,
      seo: scored.seo, geo: scored.geo,
      recommendations: scored.recommendations,
      opportunities_count: scored.recommendations.length,
      signals: scored.signals,
      gsc: gscDelta(gsc),
      query_count: queries.length,
    };
  });
  return { crawlId: id, pages: out };
}

// Back-compat wrapper (existing /reports endpoint + tests).
async function pageReports({ crawlId } = {}) {
  return scoredPages({ crawlId });
}

// Category → page rollups (spec §1d). Pure aggregation over pageReports.
async function categoryRollups({ crawlId } = {}) {
  const { crawlId: id, pages } = await pageReports({ crawlId });
  const cats = new Map();
  const titles = new Map(); // per-category title -> count, for metadata-uniqueness
  for (const p of pages) {
    const c = p.category;
    if (!cats.has(c)) cats.set(c, { category: c, total: 0, indexable: 0, pass: 0, warning: 0, fail: 0, healthSum: 0, critical: 0, orphan: 0, dupTitle: 0, titlesSeen: 0 });
    const r = cats.get(c);
    r.total++;
    if (p.indexable) r.indexable++;
    if (p.status === 'PASS') r.pass++; else if (p.status === 'WARNING') r.warning++; else r.fail++;
    r.healthSum += p.health;
    r.critical += p.critical_count;
    if (p.title) { const k = `${c}::${p.title}`; titles.set(k, (titles.get(k) || 0) + 1); r.titlesSeen++; }
  }
  // second pass: duplicate-title rate needs the full title counts
  for (const p of pages) {
    if (!p.title) continue;
    if ((titles.get(`${p.category}::${p.title}`) || 0) > 1) cats.get(p.category).dupTitle++;
  }
  const rollups = [...cats.values()].map((r) => ({
    category: r.category, total: r.total, indexable: r.indexable,
    pass: r.pass, warning: r.warning, fail: r.fail,
    avg_health: r.total ? Math.round(r.healthSum / r.total) : 0,
    critical_issues: r.critical,
    duplicate_title_rate: r.titlesSeen ? Math.round((r.dupTitle / r.titlesSeen) * 100) : 0,
    metadata_uniqueness: r.titlesSeen ? Math.round(((r.titlesSeen - r.dupTitle) / r.titlesSeen) * 100) : 100,
  }));
  return { crawlId: id, rollups };
}

// "What changed since the previous crawl?" (spec §1h). Reconstructed from the
// per-crawl issue rows already stored — no new table.
async function changedSincePrevious() {
  const crawls = unwrap(await supabaseAdmin.from('seo_crawls').select('id,status,finished_at').eq('status', 'done').order('started_at', { ascending: false }).limit(2));
  if (!crawls || crawls.length < 2) return { latest: crawls?.[0]?.id || null, previous: null, added: 0, resolved: 0, total_latest: 0, total_previous: 0 };
  const [latest, prev] = crawls;
  const key = (i) => `${i.rule_key}::${i.affected_url}`;
  const latestIssues = unwrap(await supabaseAdmin.from('seo_issues').select('rule_key,affected_url,first_seen_crawl_id').eq('crawl_id', latest.id));
  const prevIssues = unwrap(await supabaseAdmin.from('seo_issues').select('rule_key,affected_url').eq('crawl_id', prev.id));
  const prevSet = new Set((prevIssues || []).map(key));
  const latestSet = new Set((latestIssues || []).map(key));
  const added = (latestIssues || []).filter((i) => !prevSet.has(key(i))).length;
  const resolved = (prevIssues || []).filter((i) => !latestSet.has(key(i))).length;
  return { latest: latest.id, previous: prev.id, added, resolved, total_latest: latestIssues?.length || 0, total_previous: prevIssues?.length || 0 };
}

// ── List views (spec §2): one query path for services/profiles/blogs/pages ───
// Scores once (scoredPages) then filters/sorts/paginates in memory. ponytail:
// in-memory paginate is fine at current volume (a few hundred pages/crawl); move to
// a persisted score column + SQL pagination if a crawl ever tops a few thousand pages.
const SORT_FIELDS = {
  seo: (p) => p.seo_score, geo: (p) => p.geo_score, health: (p) => p.health,
  clicks: (p) => p.gsc?.clicks ?? -1, impressions: (p) => p.gsc?.impressions ?? -1,
  ctr: (p) => p.gsc?.ctr ?? -1, position: (p) => (p.gsc?.position ?? 999),
  issues: (p) => p.issue_count, opportunities: (p) => p.opportunities_count,
  updated: (p) => p.created_at || '',
};
// Slim row for lists — drops the heavy breakdown/recommendations arrays (drawer loads
// those via getPage). Keeps the columns the table shows.
function slimRow(p) {
  return {
    id: p.id, url: p.url, page_type: p.page_type, category: p.category,
    title: p.title, indexable: p.indexable, http_status: p.http_status, status: p.status,
    seo_score: p.seo_score, geo_score: p.geo_score, health: p.health,
    issue_count: p.issue_count, opportunities_count: p.opportunities_count,
    query_count: p.query_count, evidence_maturity: p.evidence_maturity,
    gsc: p.gsc, created_at: p.created_at,
    seo_caps: p.seo?.caps?.length || 0, geo_caps: p.geo?.caps?.length || 0,
  };
}
async function pageList({ crawlId, type, search, sort = 'seo', dir = 'asc', page = 1, pageSize = 50, indexable, status } = {}) {
  const { crawlId: id, pages } = await scoredPages({ crawlId });
  let rows = pages;
  if (type) { const types = String(type).split(','); rows = rows.filter((p) => types.includes(p.page_type)); }
  if (indexable != null) rows = rows.filter((p) => p.indexable === indexable);
  if (status) rows = rows.filter((p) => p.status === status);
  if (search) { const q = String(search).toLowerCase(); rows = rows.filter((p) => (p.url || '').toLowerCase().includes(q) || (p.title || '').toLowerCase().includes(q)); }
  const getter = SORT_FIELDS[sort] || SORT_FIELDS.seo;
  const sign = dir === 'desc' ? -1 : 1;
  rows.sort((a, b) => { const av = getter(a); const bv = getter(b); return av < bv ? -1 * sign : av > bv ? 1 * sign : 0; });
  const total = rows.length;
  const ps = Math.max(1, Math.min(200, Number(pageSize) || 50));
  const pg = Math.max(1, Number(page) || 1);
  const slice = rows.slice((pg - 1) * ps, (pg - 1) * ps + ps).map(slimRow);
  return { crawlId: id, total, page: pg, pageSize: ps, pages: slice };
}

// ── Dashboard: decisions, not vanity (spec §13) ──────────────────────────────
const sample = (arr, n = 8) => arr.slice(0, n).map((p) => ({ id: p.id, url: p.url, page_type: p.page_type, seo_score: p.seo_score, geo_score: p.geo_score, gsc: p.gsc }));
function buildOpportunities(pages) {
  const striking = pages.filter((p) => p.gsc && p.gsc.position != null && p.gsc.position >= 4 && p.gsc.position <= 15 && (p.gsc.impressions || 0) >= 50);
  const lowCtr = pages.filter((p) => p.gsc && (p.gsc.impressions || 0) >= 100 && p.gsc.ctr != null && p.gsc.ctr < 0.02);
  const weakLinks = pages.filter((p) => (p.recommendations || []).some((r) => r.axis === 'SEO' && r.dimension === 'internal_linking'));
  const indexing = pages.filter((p) => p.status === 'FAIL' || !p.indexable || (p.http_status && p.http_status !== 200));
  const seoNotGeo = pages.filter((p) => p.seo_score >= 70 && p.geo_score < 55);
  return [
    { key: 'striking_distance', label: 'Ranking 4–15 with impressions — push to page one', count: striking.length, pages: sample(striking) },
    { key: 'low_ctr', label: 'High impressions but low CTR — rewrite title/description', count: lowCtr.length, pages: sample(lowCtr) },
    { key: 'weak_internal_links', label: 'Weak or missing internal links', count: weakLinks.length, pages: sample(weakLinks) },
    { key: 'indexing_problems', label: 'Indexing / crawl problems', count: indexing.length, pages: sample(indexing) },
    { key: 'strong_seo_weak_geo', label: 'Strong SEO but weak GEO readiness', count: seoNotGeo.length, pages: sample(seoNotGeo) },
  ].filter((b) => b.count > 0);
}
async function dashboard({ crawlId } = {}) {
  const { crawlId: id, pages } = await scoredPages({ crawlId });
  if (!pages.length) return { crawlId: id, empty: true };
  const n = pages.length;
  const mean = (f) => Math.round(pages.reduce((s, p) => s + (f(p) || 0), 0) / n);
  const withPos = pages.filter((p) => p.gsc && p.gsc.position != null);
  const totalImpr = pages.reduce((s, p) => s + (p.gsc?.impressions || 0), 0);
  const avgPos = withPos.length ? Number((withPos.reduce((s, p) => s + p.gsc.position * (p.gsc.impressions || 1), 0) / withPos.reduce((s, p) => s + (p.gsc.impressions || 1), 0)).toFixed(1)) : null;
  const byType = {};
  for (const p of pages) {
    const t = p.page_type; byType[t] = byType[t] || { type: t, count: 0, seoSum: 0, geoSum: 0 };
    byType[t].count++; byType[t].seoSum += p.seo_score; byType[t].geoSum += p.geo_score;
  }
  return {
    crawlId: id,
    totals: {
      pages: n,
      avg_seo: mean((p) => p.seo_score),
      avg_geo: mean((p) => p.geo_score),
      indexed: pages.filter((p) => p.indexable && p.http_status === 200).length,
      needs_attention: pages.filter((p) => p.seo_score < 60 || p.status === 'FAIL').length,
      improving: pages.filter((p) => p.gsc && p.gsc.position_change != null && p.gsc.position_change > 0.1).length,
      declining: pages.filter((p) => p.gsc && p.gsc.position_change != null && p.gsc.position_change < -0.1).length,
      clicks: pages.reduce((s, p) => s + (p.gsc?.clicks || 0), 0),
      impressions: totalImpr,
      avg_position: avgPos,
    },
    by_type: Object.values(byType).map((t) => ({ type: t.type, count: t.count, avg_seo: Math.round(t.seoSum / t.count), avg_geo: Math.round(t.geoSum / t.count) })),
    opportunities: buildOpportunities(pages),
  };
}
async function opportunities({ crawlId } = {}) {
  const { crawlId: id, pages } = await scoredPages({ crawlId });
  return { crawlId: id, opportunities: buildOpportunities(pages) };
}

// ── Internal link network (interactive graph view) ───────────────────────────
// Nodes = every crawled page in a crawl; edges = each page's outbound internal
// links (raw_signals.links.internal) resolved to another crawled page. Reuses
// scoredPages so a node carries the same seo/geo/health the list + drawer show, and
// the node id IS the crawl_page id — so clicking a dot opens the existing inspector
// (getPage) with no extra plumbing. inbound/outbound are counted here; the client
// sizes each dot by inbound ("how well linked-to is this page").
// ponytail: normalize + O(edges) dedupe is fine at one crawl's few-hundred pages;
// revisit if a crawl ever tops a few thousand.
const stripSlash = (u) => (u || '').replace(/\/$/, '');   // mirror rules/links.js normalize
const pathOf = (u) => { try { return new URL(u).pathname || u; } catch { return u; } };
async function linkGraph({ crawlId } = {}) {
  const { crawlId: id, pages } = await scoredPages({ crawlId });
  if (!id || !pages.length) return { crawlId: id, generatedAt: new Date().toISOString(), nodes: [], edges: [] };

  const idByUrl = new Map();
  for (const p of pages) idByUrl.set(stripSlash(p.url), p.id);

  const inbound = new Map();
  const outbound = new Map();
  const seen = new Set();           // dedupe source→target (a page can link one target many times)
  const edges = [];
  for (const p of pages) {
    for (const href of p.raw_signals?.links?.internal || []) {
      const target = idByUrl.get(stripSlash(href));
      if (!target || target === p.id) continue;   // uncrawled target (not a node) or self-link
      const key = `${p.id} ${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: p.id, target });
      inbound.set(target, (inbound.get(target) || 0) + 1);
      outbound.set(p.id, (outbound.get(p.id) || 0) + 1);
    }
  }

  const nodes = pages.map((p) => ({
    id: p.id, url: p.url, path: pathOf(p.url), title: p.title || null,
    page_type: p.page_type, category: p.category,
    indexable: p.indexable, http_status: p.http_status,
    seo_score: p.seo_score, geo_score: p.geo_score, health: p.health, status: p.status,
    inbound: inbound.get(p.id) || 0, outbound: outbound.get(p.id) || 0,
    // contentModel is set ONLY for the meta-shell host/service pages (see seoCrawler);
    // their bodies aren't link-extracted, so outbound is not meaningful for them.
    // links_crawled:false lets the client badge them instead of calling them orphans.
    links_crawled: p.raw_signals?.contentModel == null,
  }));

  return { crawlId: id, generatedAt: new Date().toISOString(), nodes, edges };
}

// Mute an issue: rule-wide (ruleType 'rule', url_pattern null) or just this URL
// (ruleType 'url', url_pattern = the issue's affected_url). Matches seoPersist's
// isMuted() lookup (rule_key + optional url_pattern).
async function muteIssue(id, { ruleType, mutedBy } = {}) {
  const issue = await getIssue(id);
  if (!issue) throw new Error('Issue not found');
  const row = {
    rule_key: issue.rule_key,
    url_pattern: ruleType === 'url' ? issue.affected_url : null,
    muted_by: mutedBy || null,
  };
  const { data, error } = await supabaseAdmin.from('seo_issue_mutes').insert(row).select('*');
  if (error) {
    // 23505 = unique_violation on uq_seo_issue_mutes(rule_key, COALESCE(url_pattern,''))
    // — already muted (double-click, or another issue with the same rule_key).
    // Idempotent: treat as success rather than surfacing a 500.
    if (error.code === '23505') return row;
    throw error;
  }
  return (data && data[0]) || row;
}

module.exports = { latestOverview, listIssues, getIssue, listPages, getPage, scoreHistory, getCrawl, muteIssue, listGscUrls,
  pageReports, categoryRollups, changedSincePrevious, latestCrawlId,
  scoredPages, pageList, dashboard, opportunities, linkGraph, gscStatus };
