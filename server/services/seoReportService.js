'use strict';
/**
 * seoReportService.js — READ-ONLY Search Console numbers for the SUTRA agent
 * network (VANI). Served by GET /api/agents/reports/seo.
 *
 * Source: seo_gsc_urls + seo_gsc_queries, written by gscSync (SCHEDULED_JOBS 'gsc-sync',
 * daily). Contract:
 *   • Numbers, search query strings and public page URLs only. No raw GSC payloads
 *     (inspection_raw / analytics_raw are never selected), no writes, no migration.
 *   • Empty tables (sync never ran: GSC_SA_KEY / GSC_PROPERTY unset) → empty arrays and
 *     status 'gsc_not_synced'. Nothing is estimated or invented.
 *   • Windows mirror gscSync: current = the 28 days up to the last sync, previous = the
 *     28 days before that (prev_* columns). Derived from last_synced, not stored.
 */
const { supabaseAdmin } = require('../config/supabase');
const { fetchAll } = require('./financeReportService');
const { isIndexed } = require('./seo/rules/gsc');

const DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 28;
// gscSync upserts in place and never deletes: a url/query that drops out of GSC keeps
// its old row. Rows synced more than FRESH_MS before the latest sync are leftovers of an
// earlier run and are excluded. ponytail: page rows also get last_synced bumped by URL
// Inspection, so a page that lost ALL impressions can still show its old analytics;
// fix in gscSync (stamp analytics separately) if that ever matters.
const FRESH_MS = 2 * DAY;
const STALE_MS = 3 * DAY; // daily job; older than this = sync stopped
const MIN_IMPRESSIONS = 10; // "meaningful" for striking distance + losing ground
const STRIKING = { min: 5, max: 20 };
const TOP_N = 25;
const LIST_N = 50;
// Echoed in the response so the agent knows lists are capped (totals carry the full counts).
const THRESHOLDS = { min_impressions: MIN_IMPRESSIONS, striking_positions: STRIKING, max_items: { top_queries: TOP_N, lists: LIST_N, indexing_issues: LIST_N * 2 } };

const URL_COLS = 'url, coverage_state, indexing_state, last_crawl_time, impressions, clicks, ctr, position, prev_impressions, prev_clicks, prev_position, last_synced';
const QUERY_COLS = 'url, query, clicks, impressions, ctr, position, prev_clicks, prev_impressions, prev_position, last_synced';

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;
const pos = (v) => (v == null ? null : r2(Number(v)));
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);
const syncedAt = (r) => Date.parse(r.last_synced) || 0;
const latest = (rows) => rows.reduce((m, r) => Math.max(m, syncedAt(r)), 0);
const fresh = (rows) => { const m = latest(rows); return rows.filter((r) => syncedAt(r) >= m - FRESH_MS); };
const isMissingTable = (e) => e?.code === '42P01' || e?.code === 'PGRST205';

// Same arithmetic as gscSync.run(): curStart = T−28d, prevEnd = curStart−1d, prevStart = prevEnd−28d.
function gscWindow(lastSyncMs) {
  const curStart = lastSyncMs - WINDOW_DAYS * DAY;
  const prevEnd = curStart - DAY;
  return {
    current: { start: isoDate(curStart), end: isoDate(lastSyncMs) },
    previous: { start: isoDate(prevEnd - WINDOW_DAYS * DAY), end: isoDate(prevEnd) },
  };
}

// Query-level totals across every url that query ranks for. Position is the
// impression-weighted mean (how GSC itself rolls up position).
function topQueries(qRows) {
  const by = new Map();
  for (const r of qRows) {
    const a = by.get(r.query) || { query: r.query, url: null, best: -1, clicks: 0, impressions: 0, posSum: 0, posImp: 0 };
    const imp = num(r.impressions);
    a.clicks += num(r.clicks);
    a.impressions += imp;
    if (r.position != null) { a.posSum += Number(r.position) * imp; a.posImp += imp; }
    if (imp > a.best) { a.best = imp; a.url = r.url; }
    by.set(r.query, a);
  }
  const list = [...by.values()].map((a) => ({
    query: a.query,
    url: a.url, // the page with the most impressions for this query
    clicks: a.clicks,
    impressions: a.impressions,
    ctr: a.impressions ? r4(a.clicks / a.impressions) : 0,
    position: a.posImp ? r2(a.posSum / a.posImp) : null,
  }));
  return {
    by_impressions: [...list].sort((x, y) => y.impressions - x.impressions || y.clicks - x.clicks).slice(0, TOP_N),
    by_clicks: list.filter((q) => q.clicks > 0).sort((x, y) => y.clicks - x.clicks || y.impressions - x.impressions).slice(0, TOP_N),
  };
}

// (url, query) pairs at position 5–20 with meaningful impressions.
// opportunity = impressions × positions_to_top (position − 1).
function strikingDistance(qRows) {
  return qRows
    .filter((r) => r.position != null && r.position >= STRIKING.min && r.position <= STRIKING.max && num(r.impressions) >= MIN_IMPRESSIONS)
    .map((r) => ({
      query: r.query,
      url: r.url,
      clicks: num(r.clicks),
      impressions: num(r.impressions),
      ctr: r4(num(r.ctr)),
      position: pos(r.position),
      positions_to_top: r2(r.position - 1),
      opportunity: Math.round(num(r.impressions) * (r.position - 1)),
    }))
    .sort((a, b) => b.opportunity - a.opportunity)
    .slice(0, LIST_N);
}

// Rows whose position worsened by ≥1 or clicks fell vs the previous window. Rows with
// no previous-window data (new pages/queries) are skipped — nothing to compare.
function losingGround(rows, pick) {
  return rows
    .filter((r) => r.prev_position != null || r.prev_clicks != null)
    .filter((r) => Math.max(num(r.impressions), num(r.prev_impressions)) >= MIN_IMPRESSIONS)
    .map((r) => ({
      ...pick(r),
      clicks: num(r.clicks),
      prev_clicks: r.prev_clicks == null ? null : num(r.prev_clicks),
      clicks_change: r.prev_clicks == null ? null : num(r.clicks) - num(r.prev_clicks),
      impressions: num(r.impressions),
      prev_impressions: r.prev_impressions == null ? null : num(r.prev_impressions),
      position: pos(r.position),
      prev_position: pos(r.prev_position),
      position_change: r.position != null && r.prev_position != null ? r2(r.position - r.prev_position) : null,
    }))
    .filter((x) => (x.position_change ?? 0) >= 1 || (x.clicks_change ?? 0) < 0)
    .sort((a, b) => (a.clicks_change ?? 0) - (b.clicks_change ?? 0) || (b.position_change ?? 0) - (a.position_change ?? 0))
    .slice(0, LIST_N);
}

// Inspected urls Google does not index (same definition as rules/gsc.js), or that
// inspection reports as blocked (meta tag / header / robots.txt). Never-inspected
// rows (coverage_state null) are not issues — they are just unknown.
function indexingIssues(urlRows) {
  return urlRows
    .filter((r) => (r.coverage_state && !isIndexed(r.coverage_state.toLowerCase())) || /^BLOCKED/.test(r.indexing_state || ''))
    .map((r) => ({
      url: r.url,
      coverage_state: r.coverage_state,
      indexing_state: r.indexing_state,
      last_crawl_time: r.last_crawl_time,
      impressions: num(r.impressions),
    }))
    .sort((a, b) => b.impressions - a.impressions || a.url.localeCompare(b.url));
}

/**
 * Pure aggregation over already-fetched rows. Exported for tests.
 * @param {object} p
 * @param {Array} p.urlRows   seo_gsc_urls rows (URL_COLS)
 * @param {Array} p.queryRows seo_gsc_queries rows (QUERY_COLS)
 * @param {Date}  p.now
 */
function aggregateSeo({ urlRows, queryRows, now }) {
  const all = [...urlRows, ...queryRows];
  const empty = { top_queries: { by_impressions: [], by_clicks: [] }, striking_distance: [], losing_ground: { pages: [], queries: [] }, indexing_issues: [] };
  if (!all.length) {
    return {
      status: 'gsc_not_synced',
      note: 'seo_gsc_urls and seo_gsc_queries are empty: gsc-sync has never written data (GSC_SA_KEY / GSC_PROPERTY not configured on the server, or the first run has not happened). No numbers are reported.',
      last_synced: null,
      gsc_window: null,
      thresholds: THRESHOLDS,
      totals: { pages: 0, queries: 0 },
      ...empty,
    };
  }

  const last = latest(all);
  const stale = now.getTime() - last > STALE_MS;
  const urls = fresh(urlRows);
  const queries = fresh(queryRows);
  const issues = indexingIssues(urls);

  return {
    status: stale ? 'stale' : 'ok',
    note: stale ? `Last gsc-sync write was ${Math.floor((now.getTime() - last) / DAY)} days ago (job runs daily) — numbers are old; check the gsc-sync job.` : null,
    last_synced: new Date(last).toISOString(),
    gsc_window: gscWindow(last),
    thresholds: THRESHOLDS,
    totals: {
      pages: urls.length,
      queries: queries.length,
      clicks: urls.reduce((s, r) => s + num(r.clicks), 0),
      impressions: urls.reduce((s, r) => s + num(r.impressions), 0),
      indexing_issues: issues.length,
    },
    top_queries: topQueries(queries),
    striking_distance: strikingDistance(queries),
    losing_ground: {
      pages: losingGround(urls, (r) => ({ url: r.url })),
      queries: losingGround(queries, (r) => ({ query: r.query, url: r.url })),
    },
    indexing_issues: issues.slice(0, LIST_N * 2),
  };
}

async function buildSeoReport({ now = new Date() } = {}) {
  const db = supabaseAdmin;
  // Missing table (pre-v3.146/v3.152 DB) reads as "not synced"; any other error fails the report.
  const orEmpty = (p) => p.catch((e) => { if (isMissingTable(e)) return []; throw e; });
  const [urlRows, queryRows] = await Promise.all([
    orEmpty(fetchAll(() => db.from('seo_gsc_urls').select(URL_COLS).order('url'))),
    orEmpty(fetchAll(() => db.from('seo_gsc_queries').select(QUERY_COLS).order('id'))),
  ]);
  return {
    report: 'seo',
    version: 1,
    as_of: now.toISOString(),
    source: 'Google Search Console via gsc-sync (seo_gsc_urls, seo_gsc_queries)',
    ...aggregateSeo({ urlRows, queryRows, now }),
  };
}

module.exports = { buildSeoReport, aggregateSeo, gscWindow };
