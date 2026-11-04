'use strict';
/**
 * seoReport.test.js — VANI read-only SEO report (ASH-23).
 * Covers: top queries rollup, striking-distance ranking, losing ground, indexing issues,
 * stale-row exclusion, the empty-table / missing-table fallback, no raw-payload mockSelects,
 * and the shared x-agent-token gate on /seo.
 */
const mockSelects = [];
const mockFixtures = {};
let mockFail = null; // { table, error } — simulate a DB error on one table
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (table) => {
      const b = {
        select: (cols) => { mockSelects.push({ table, cols }); return b; },
        order: () => b,
        range: async () => (mockFail?.table === table
          ? { data: null, error: mockFail.error }
          : { data: mockFixtures[table] || [], error: null }),
      };
      return b;
    },
  },
}));
jest.mock('../../middleware/security', () => ({ newsletterIpLimiter: (_q, _s, n) => n() }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { aggregateSeo, buildSeoReport, gscWindow } = require('../../services/seoReportService');

const NOW = new Date('2026-11-04T06:00:00Z');
const SYNC = '2026-11-04T02:00:00.000Z';
const OLD = '2026-10-20T02:00:00.000Z'; // leftover of an earlier run
const P = (path) => `https://meeticulous.com${path}`;

const q = (url, query, clicks, impressions, position, prev = {}, last_synced = SYNC) => ({
  url: P(url), query, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position,
  prev_clicks: prev.clicks ?? null, prev_impressions: prev.impressions ?? null, prev_position: prev.position ?? null, last_synced,
});
const u = (url, f = {}) => ({
  url: P(url), coverage_state: null, indexing_state: null, last_crawl_time: null,
  impressions: 0, clicks: 0, ctr: 0, position: null, prev_impressions: null, prev_clicks: null, prev_position: null,
  last_synced: SYNC, ...f,
});

beforeEach(() => { mockSelects.length = 0; mockFail = null; for (const k of Object.keys(mockFixtures)) delete mockFixtures[k]; });

test('gscWindow mirrors gscSync arithmetic (two 28-day windows)', () => {
  expect(gscWindow(Date.parse(SYNC))).toEqual({
    current: { start: '2026-10-07', end: '2026-11-04' },
    previous: { start: '2026-09-08', end: '2026-10-06' },
  });
});

describe('aggregateSeo', () => {
  const queryRows = [
    q('/', 'appointment booking app', 30, 1000, 3.2, { clicks: 40, impressions: 900, position: 2.1 }),
    q('/pricing', 'appointment booking app', 10, 200, 8, { clicks: 10, impressions: 200, position: 8 }),
    q('/blog/x', 'calendly alternative india', 2, 400, 12.5),
    q('/blog/y', 'booking page for doctors', 0, 50, 18, { clicks: 0, impressions: 30, position: 15 }),
    q('/blog/z', 'tiny query', 0, 5, 9),                        // under min impressions
    q('/old', 'gone query', 99, 9999, 6, {}, OLD),               // stale leftover → ignored everywhere
  ];
  const urlRows = [
    u('/', { coverage_state: 'Submitted and indexed', indexing_state: 'INDEXING_ALLOWED', clicks: 40, impressions: 1200, position: 3, prev_clicks: 60, prev_impressions: 1100, prev_position: 2.5 }),
    u('/blog/x', { coverage_state: 'Crawled - currently not indexed', impressions: 400, clicks: 2 }),
    u('/blog/y', { coverage_state: 'Indexed, not submitted in sitemap', indexing_state: 'BLOCKED_BY_META_TAG' }),
    u('/blog/w', { coverage_state: 'Indexed, not submitted in sitemap', indexing_state: 'INDEXING_ALLOWED' }),
    u('/never-inspected', { impressions: 50, clicks: 1 }),
    u('/old', { coverage_state: 'Discovered - currently not indexed', last_synced: OLD }),
  ];
  const r = aggregateSeo({ urlRows, queryRows, now: NOW });

  test('status, window and totals come from the fresh rows only', () => {
    expect(r.status).toBe('ok');
    expect(r.last_synced).toBe(SYNC);
    expect(r.gsc_window.current.end).toBe('2026-11-04');
    expect(r.totals).toEqual({ pages: 5, queries: 5, clicks: 43, impressions: 1650, indexing_issues: 2 });
    expect(JSON.stringify(r)).not.toMatch(/gone query|\/old|NaN/);
  });

  test('top_queries roll up a query across urls (impression-weighted position)', () => {
    const top = r.top_queries.by_impressions[0];
    expect(top).toEqual({ query: 'appointment booking app', url: P('/'), clicks: 40, impressions: 1200, ctr: 0.0333, position: 4 });
    expect(r.top_queries.by_impressions.map((x) => x.query)).toEqual(['appointment booking app', 'calendly alternative india', 'booking page for doctors', 'tiny query']);
    expect(r.top_queries.by_clicks.map((x) => x.query)).toEqual(['appointment booking app', 'calendly alternative india']);
  });

  test('striking_distance: position 5-20, ≥10 impressions, ranked by impressions × (position − 1)', () => {
    expect(r.striking_distance.map((x) => [x.query, x.url, x.opportunity])).toEqual([
      ['calendly alternative india', P('/blog/x'), 4600],
      ['appointment booking app', P('/pricing'), 1400],
      ['booking page for doctors', P('/blog/y'), 850],
    ]);
  });

  test('losing_ground: position worse by ≥1 or clicks down vs previous window', () => {
    expect(r.losing_ground.pages).toEqual([{
      url: P('/'), clicks: 40, prev_clicks: 60, clicks_change: -20, impressions: 1200, prev_impressions: 1100,
      position: 3, prev_position: 2.5, position_change: 0.5,
    }]);
    expect(r.losing_ground.queries.map((x) => [x.query, x.url, x.clicks_change, x.position_change])).toEqual([
      ['appointment booking app', P('/'), -10, 1.1],
      ['booking page for doctors', P('/blog/y'), 0, 3],
    ]);
  });

  test('indexing_issues: not-indexed coverage or BLOCKED_* only; never-inspected skipped', () => {
    expect(r.indexing_issues.map((x) => [x.url, x.coverage_state, x.indexing_state])).toEqual([
      [P('/blog/x'), 'Crawled - currently not indexed', null],
      [P('/blog/y'), 'Indexed, not submitted in sitemap', 'BLOCKED_BY_META_TAG'],
    ]);
  });

  test('last sync > 3 days old → status stale with a note', () => {
    const s = aggregateSeo({ urlRows, queryRows, now: new Date('2026-11-09T06:00:00Z') });
    expect(s.status).toBe('stale');
    expect(s.note).toMatch(/5 days ago/);
  });
});

describe('buildSeoReport', () => {
  test('empty tables → gsc_not_synced, empty arrays, no invented numbers', async () => {
    const r = await buildSeoReport({ now: NOW });
    expect(r).toMatchObject({
      report: 'seo', version: 1, as_of: NOW.toISOString(), status: 'gsc_not_synced', last_synced: null, gsc_window: null,
      top_queries: { by_impressions: [], by_clicks: [] }, striking_distance: [], losing_ground: { pages: [], queries: [] }, indexing_issues: [],
    });
    expect(r.note).toMatch(/gsc-sync/);
  });

  test('missing table reads as not synced; any other DB error fails the report', async () => {
    mockFail = { table: 'seo_gsc_queries', error: { code: '42P01', message: 'relation "seo_gsc_queries" does not exist' } };
    expect((await buildSeoReport({ now: NOW })).status).toBe('gsc_not_synced');
    mockFail = { table: 'seo_gsc_urls', error: { code: '42703', message: 'column seo_gsc_urls.prev_clicks does not exist' } };
    await expect(buildSeoReport({ now: NOW })).rejects.toMatchObject({ code: '42703' });
  });

  test('mockSelects named columns only — never raw GSC payloads', async () => {
    mockFixtures.seo_gsc_queries = [q('/', 'x', 1, 20, 6)];
    await buildSeoReport({ now: NOW });
    expect(mockSelects.map((s) => s.table).sort()).toEqual(['seo_gsc_queries', 'seo_gsc_urls']);
    for (const { cols } of mockSelects) expect(cols).not.toMatch(/\*|_raw|canonical/);
  });
});

describe('GET /api/agents/reports/seo auth', () => {
  const app = express();
  app.use('/api/agents/reports', require('../../routes/agentReportRoutes'));
  const GOOD = 'x'.repeat(40);
  beforeEach(() => { delete process.env.AGENT_REPORT_TOKEN; });
  afterEach(() => { delete process.env.AGENT_REPORT_TOKEN; });

  test('same fail-closed token gate as finance', async () => {
    await request(app).get('/api/agents/reports/seo').set('x-agent-token', 'anything').expect(503);
    process.env.AGENT_REPORT_TOKEN = GOOD;
    await request(app).get('/api/agents/reports/seo').expect(401);
  });

  test('right token → 200 seo report, no-store; read-only', async () => {
    process.env.AGENT_REPORT_TOKEN = GOOD;
    const res = await request(app).get('/api/agents/reports/seo').set('x-agent-token', GOOD).expect(200);
    expect(res.body).toMatchObject({ report: 'seo', status: 'gsc_not_synced' });
    expect(res.headers['cache-control']).toBe('no-store');
    await request(app).post('/api/agents/reports/seo').set('x-agent-token', GOOD).expect(404);
  });
});
