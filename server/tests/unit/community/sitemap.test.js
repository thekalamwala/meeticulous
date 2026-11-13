'use strict';
// Community sitemap: pure entries, the flag/table/ban-aware fetcher, and the index child.
process.env.SITE_URL = 'https://meeticulous.com';

jest.mock('../../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../../config/supabase', () => {
  const db = { handlers: {} };
  db.on = (table, fn) => { db.handlers[table] = fn; };
  const chain = (table) => {
    const ops = [];
    const resolve = () => Promise.resolve((db.handlers[table] || (() => ({ data: [], error: null })))(ops));
    const c = { then: (ok, bad) => resolve().then(ok, bad), single: () => resolve(), maybeSingle: () => resolve() };
    for (const m of ['select', 'eq', 'neq', 'in', 'or', 'is', 'gt', 'lt', 'lte', 'not', 'order', 'limit']) {
      c[m] = (...args) => { ops.push([m, ...args]); return c; };
    }
    return c;
  };
  return { supabaseAdmin: { from: jest.fn(chain), __db: db } };
});

const request = require('supertest');
const express = require('express');
const { supabaseAdmin } = require('../../../config/supabase');
const { isFeatureEnabled } = require('../../../services/featureFlags');
const store = require('../../../services/community/store');
const { communityEntries, fetchCommunity } = require('../../../services/sitemapService');
const { bustSitemapCache } = require('../../../utils/sitemapCache');

const db = supabaseAdmin.__db;
const SITE = 'https://meeticulous.com';
const BAD = 'bad-author';

function setup({ flag = true, missing = false } = {}) {
  store.resetReadCaches();
  bustSitemapCache();
  isFeatureEnabled.mockResolvedValue(flag);
  const err = missing ? { code: '42P01', message: 'relation "community_posts" does not exist' } : null;
  db.on('community_posts', () => (err ? { data: null, error: err } : {
    data: [
      { kind: 'thread', slug: 'pricing-ab12', author_id: 'ok', last_activity_at: '2026-11-02T09:30:00.000Z' },
      { kind: 'post', slug: 'hello-cd34', author_id: BAD, last_activity_at: '2026-11-01T09:30:00.000Z' },
      { kind: 'post', slug: 'loved-ef56', author_id: null, last_activity_at: '2026-10-30T07:00:00.000Z' },
    ],
    error: null,
  }));
  db.on('community_spaces', () => (err ? { data: null, error: err } : { data: [{ id: 's1', key: 'help', is_active: true }], error: null }));
  db.on('community_hashtags', () => (err ? { data: null, error: err } : { data: [{ tag: 'pricing', use_count: 5 }, { tag: 'rare', use_count: 1 }], error: null }));
  db.on('community_members', () => ({ data: [{ user_id: BAD }], error: null }));
  db.on('profiles', () => ({ data: [], error: null }));
}

describe('communityEntries', () => {
  test('thread/post/space URLs, lastmod from last_activity_at, plus /community and /community/guidelines', () => {
    const locs = communityEntries([
      { kind: 'thread', slug: 'pricing-ab12', last_activity_at: '2026-11-02T09:30:00.000Z' },
      { kind: 'post', slug: 'hello-cd34', last_activity_at: '2026-11-01T09:30:00.000Z' },
      { key: 'help' },
      { tag: 'pricing' },
    ], SITE);
    expect(locs.map((e) => e.loc)).toEqual([
      `${SITE}/community`, `${SITE}/community/guidelines`,
      `${SITE}/community/t/pricing-ab12`, `${SITE}/community/p/hello-cd34`, `${SITE}/community/s/help`,
      `${SITE}/community/tag/pricing`,
    ]);
    expect(locs[2].lastmod).toBe('2026-11-02');
    expect(locs[3].lastmod).toBe('2026-11-01');
  });

  test('no rows -> no entries at all', () => {
    expect(communityEntries([], SITE)).toEqual([]);
    expect(communityEntries(null, SITE)).toEqual([]);
  });
});

describe('fetchCommunity', () => {
  test('indexable items minus banned authors, plus active spaces and tags (>=3 uses)', async () => {
    setup();
    const rows = await fetchCommunity();
    // spaces, then tags with enough content (rare's use_count=1 is dropped), then items minus banned.
    expect(rows.map((r) => r.slug || r.key || r.tag)).toEqual(['help', 'pricing', 'pricing-ab12', 'loved-ef56']);
  });

  test('flag off -> empty, and the community table is never read', async () => {
    setup({ flag: false });
    supabaseAdmin.from.mockClear();
    expect(await fetchCommunity()).toEqual([]);
    expect(supabaseAdmin.from.mock.calls.map((c) => c[0])).not.toContain('community_posts');
  });

  test('flag read failure -> empty', async () => {
    setup();
    isFeatureEnabled.mockRejectedValue(new Error('down'));
    expect(await fetchCommunity()).toEqual([]);
  });

  test('table missing -> empty', async () => {
    setup({ missing: true });
    expect(await fetchCommunity()).toEqual([]);
  });

  test('any other DB error -> empty and logged, never thrown', async () => {
    setup();
    db.on('community_posts', () => ({ data: null, error: { code: 'XX000', message: 'boom' } }));
    const spy = jest.spyOn(require('../../../utils/logger').logger, 'error').mockImplementation(() => {});
    await expect(fetchCommunity()).resolves.toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('GET /sitemap-community.xml', () => {
  const app = express();
  app.use(require('../../../routes/sitemapRoutes'));
  test('listed in the index and served as a urlset', async () => {
    setup();
    const index = await request(app).get('/sitemap.xml');
    expect(index.status).toBe(200);
    expect(index.text).toContain(`${SITE}/sitemap-community.xml`);
    const res = await request(app).get('/sitemap-community.xml');
    expect(res.status).toBe(200);
    expect(res.text).toContain(`<loc>${SITE}/community/t/pricing-ab12</loc><lastmod>2026-11-02</lastmod>`);
    expect(res.text).not.toContain('hello-cd34');
  });

  test('flag off -> not listed in the index', async () => {
    setup({ flag: false });
    const index = await request(app).get('/sitemap.xml');
    expect(index.status).toBe(200);
    expect(index.text).not.toContain('sitemap-community.xml');
  });

  test('flag off -> empty urlset', async () => {
    setup({ flag: false });
    const res = await request(app).get('/sitemap-community.xml');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('<loc>');
  });
});
