'use strict';
// Community read API: controller handlers against a scripted supabase mock (same shape as writes.test.js).
jest.mock('../../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../utils/sitemapCache', () => ({ bustSitemapCache: jest.fn() }));
jest.mock('../../../config/supabase', () => {
  const db = { handlers: {}, calls: [] };
  db.on = (table, fn) => { db.handlers[table] = fn; };
  const chain = (table) => {
    const ops = [];
    const resolve = () => Promise.resolve((db.handlers[table] || (() => ({ data: [], error: null })))(ops));
    const c = { then: (ok, bad) => resolve().then(ok, bad), single: () => resolve(), maybeSingle: () => resolve() };
    for (const m of ['select', 'eq', 'neq', 'in', 'or', 'is', 'gt', 'lt', 'order', 'limit']) {
      c[m] = (...args) => { ops.push([m, ...args]); return c; };
    }
    db.calls.push({ table, ops });
    return c;
  };
  return { supabaseAdmin: { from: jest.fn(chain), __db: db } };
});

const { supabaseAdmin } = require('../../../config/supabase');
const ctrl = require('../../../controllers/communityController');
const store = require('../../../services/community/store');
const { encodeCursor, decodeCursor } = require('../../../services/community/cursor');

const db = supabaseAdmin.__db;
const callsOn = (t) => db.calls.filter((c) => c.table === t);
const ME = 'aaaaaaaa-0000-4000-8000-000000000001';
const BAD = 'aaaaaaaa-0000-4000-8000-000000000009';
const uuid = (n) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const SPACE = { id: 'sp-gen', key: 'general', name: 'General', description: 'd', post_policy: 'everyone', reply_policy: 'everyone', is_active: true };
const row = (n, over = {}) => ({
  id: uuid(n), kind: 'post', format: 'text', author_id: ME, space_id: null, title: null, body: `b${n}`, slug: `s${n}`,
  status: 'visible', like_count: 0, comment_count: 0, is_pinned: false, is_indexable: false,
  created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, 100 - n)).toISOString(), ...over,
});

function setup({ posts = [], comments = [], banned = [] } = {}) {
  store.resetReadCaches();
  db.calls.length = 0;
  db.on('community_spaces', () => ({ data: [SPACE], error: null }));
  db.on('community_posts', (ops) => {
    const pinnedQ = ops.some((o) => o[0] === 'eq' && o[1] === 'is_pinned');
    const slug = (ops.find((o) => o[0] === 'eq' && o[1] === 'slug') || [])[2];
    if (slug) return { data: posts.find((p) => p.slug === slug) || null, error: null };
    return { data: posts.filter((p) => !!p.is_pinned === pinnedQ), error: null };
  });
  db.on('community_comments', () => ({ data: comments, error: null }));
  db.on('community_members', (ops) => (ops.some((o) => o[0] === 'gt')
    ? { data: banned.map((id) => ({ user_id: id })), error: null }
    : { data: [{ user_id: ME, badge: null }], error: null }));
  db.on('profiles', (ops) => (ops.some((o) => o[0] === 'eq' && o[1] === 'is_banned')
    ? { data: [], error: null }
    : { data: [{ id: ME, first_name: 'Asha', is_host: false }], error: null }));
  db.on('community_media', () => ({ data: [], error: null }));
  db.on('community_reactions', () => ({ data: [], error: null }));
}

function call(handler, { user = null, query = {}, params = {} } = {}) {
  return new Promise((resolve) => {
    const res = { headers: {}, statusCode: 200 };
    res.status = (c) => { res.statusCode = c; return res; };
    res.set = (k, v) => { res.headers[k] = v; return res; };
    res.json = (body) => resolve({ status: res.statusCode, body, headers: res.headers });
    handler({ user, query, params }, res);
  });
}

describe('GET /feed', () => {
  test('banned author is filtered out', async () => {
    setup({ posts: [row(1), row(2, { author_id: BAD }), row(3)], banned: [BAD] });
    const { body } = await call(ctrl.feed);
    expect(body.items.map((i) => i.id)).toEqual([uuid(1), uuid(3)]);
  });

  test('next_cursor decodes to the last item and a full page still returns 20', async () => {
    setup({ posts: Array.from({ length: 25 }, (_, i) => row(i + 1)) });
    const { body } = await call(ctrl.feed);
    expect(body.items).toHaveLength(20);
    const last = body.items[19];
    expect(decodeCursor(body.next_cursor)).toEqual({ ts: last.created_at, id: last.id });
  });

  test('short page has no next_cursor', async () => {
    setup({ posts: [row(1)] });
    expect((await call(ctrl.feed)).body.next_cursor).toBeNull();
  });

  test('anonymous: liked=false, reactions never queried, public cache', async () => {
    setup({ posts: [row(1), row(2)] });
    const r = await call(ctrl.feed);
    expect(r.body.items.every((i) => i.viewer.liked === false)).toBe(true);
    expect(callsOn('community_reactions')).toHaveLength(0);
    expect(r.headers['Cache-Control']).toMatch(/^public, max-age=60/);
  });

  test('logged in: reactions queried exactly once, private cache, liked reflected', async () => {
    setup({ posts: [row(1), row(2)] });
    db.on('community_reactions', () => ({ data: [{ target_id: uuid(1) }], error: null }));
    const r = await call(ctrl.feed, { user: { id: ME } });
    expect(callsOn('community_reactions')).toHaveLength(1);
    expect(r.body.items.map((i) => i.viewer.liked)).toEqual([true, false]);
    expect(r.headers['Cache-Control']).toBe('private, no-store');
  });

  test('page 1 prefixes pinned items without duplicating them; page 2 has no pinned prefix', async () => {
    const pin = row(5, { is_pinned: true });
    setup({ posts: [pin, row(1), row(5, { is_pinned: false })] });
    const p1 = await call(ctrl.feed);
    expect(p1.body.items.map((i) => i.id)).toEqual([uuid(5), uuid(1)]);
    const cursor = encodeCursor(row(1).created_at, uuid(1));
    await call(ctrl.feed, { query: { cursor } });
    const pinnedCalls = callsOn('community_posts').filter((c) => c.ops.some((o) => o[0] === 'eq' && o[1] === 'is_pinned'));
    expect(pinnedCalls).toHaveLength(1); // only page 1 asked
  });

  test('bad cursor -> 400 BAD_CURSOR, bad tab -> 400 BAD_TAB', async () => {
    setup();
    expect((await call(ctrl.feed, { query: { cursor: 'x,y' } })).body.code).toBe('BAD_CURSOR');
    expect((await call(ctrl.feed, { query: { tab: 'nope' } })).body.code).toBe('BAD_TAB');
  });

  test('valid cursor becomes a keyset filter built from decoded values', async () => {
    setup({ posts: [row(2)] });
    const cursor = encodeCursor(row(1).created_at, uuid(1));
    await call(ctrl.feed, { query: { cursor } });
    const ors = callsOn('community_posts').flatMap((c) => c.ops).filter((o) => o[0] === 'or').map((o) => o[1]);
    expect(ors).toContain(`created_at.lt.${row(1).created_at},and(created_at.eq.${row(1).created_at},id.lt.${uuid(1)})`);
  });

  test('missing table -> empty feed', async () => {
    setup();
    db.on('community_posts', () => ({ data: null, error: { code: '42P01', message: 'relation "community_posts" does not exist' } }));
    const r = await call(ctrl.feed);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ items: [], next_cursor: null });
  });
});

describe('GET /spaces', () => {
  test('lists active spaces with the public fields only', async () => {
    setup();
    const { body } = await call(ctrl.listSpaces);
    expect(body.spaces).toEqual([{ key: 'general', name: 'General', description: 'd', post_policy: 'everyone', reply_policy: 'everyone' }]);
  });
});

describe('GET /items/:slug', () => {
  test('removed -> 410 GONE', async () => {
    setup({ posts: [row(1, { status: 'removed' })] });
    const r = await call(ctrl.itemDetail, { params: { slug: 's1' } });
    expect(r.status).toBe(410);
    expect(r.body.code).toBe('GONE');
  });

  test('missing -> 404; hidden viewed by a non-author -> 404; hidden to its author -> 200', async () => {
    setup({ posts: [row(1, { status: 'hidden' })] });
    expect((await call(ctrl.itemDetail, { params: { slug: 'nope' } })).status).toBe(404);
    expect((await call(ctrl.itemDetail, { params: { slug: 's1' }, user: { id: BAD } })).status).toBe(404);
    expect((await call(ctrl.itemDetail, { params: { slug: 's1' }, user: { id: ME } })).status).toBe(200);
  });

  test('banned author -> 404', async () => {
    setup({ posts: [row(1, { author_id: BAD })], banned: [BAD] });
    expect((await call(ctrl.itemDetail, { params: { slug: 's1' } })).status).toBe(404);
  });

  test('deleted account (author_id null) -> 200 with "Deleted account"', async () => {
    setup({ posts: [row(1, { author_id: null })] });
    const r = await call(ctrl.itemDetail, { params: { slug: 's1' } });
    expect(r.status).toBe(200);
    expect(r.body.item.author.display_name).toBe('Deleted account');
  });

  test('thread url starts with /community/t/ and the space is included', async () => {
    setup({ posts: [row(1, { kind: 'thread', space_id: 'sp-gen', title: 'T' })] });
    const r = await call(ctrl.itemDetail, { params: { slug: 's1' } });
    expect(r.body.item.url.startsWith('/community/t/')).toBe(true);
    expect(r.body.space.key).toBe('general');
  });

  test('comments keep tombstones, drop hidden-from-others, and page via next_comment_cursor', async () => {
    const c = (n, over = {}) => ({ id: uuid(100 + n), post_id: uuid(1), parent_id: null, author_id: ME, body: `c${n}`, status: 'visible', like_count: 0, created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, n)).toISOString(), ...over });
    const comments = [c(1), c(2, { status: 'deleted' }), c(3, { status: 'hidden' }), ...Array.from({ length: 49 }, (_, i) => c(4 + i))];
    setup({ posts: [row(1)], comments });
    const r = await call(ctrl.itemDetail, { params: { slug: 's1' } });
    expect(r.body.comments.find((x) => x.id === uuid(102))).toMatchObject({ status: 'deleted', body: '' });
    expect(r.body.comments.find((x) => x.id === uuid(103))).toBeUndefined();
    expect(r.body.next_comment_cursor).not.toBeNull(); // 52 rows came back > 50
    const asc = callsOn('community_comments').flatMap((x) => x.ops).find((o) => o[0] === 'order');
    expect(asc[2]).toEqual({ ascending: true });
  });

  test('comments endpoint: bad cursor 400, gone 410', async () => {
    setup({ posts: [row(1), row(2, { status: 'deleted' })] });
    expect((await call(ctrl.itemComments, { params: { slug: 's1' }, query: { cursor: '!!' } })).body.code).toBe('BAD_CURSOR');
    expect((await call(ctrl.itemComments, { params: { slug: 's2' } })).status).toBe(410);
  });

  test('missing table -> 404', async () => {
    setup();
    db.on('community_posts', () => ({ data: null, error: { code: '42P01', message: 'x' } }));
    expect((await call(ctrl.itemDetail, { params: { slug: 's1' } })).status).toBe(404);
  });
});

describe('GET /me', () => {
  test('returns the member fields and the required terms version', async () => {
    setup();
    const member = { user_id: ME, badge: 'staff', early_access: true, links_allowed: false, terms_version: 'v', terms_accepted_at: 't', banned_until: null, email_replies: true, post_count: 9 };
    db.on('community_members', () => ({ data: member, error: null }));
    const r = await call(ctrl.me, { user: { id: ME } });
    expect(r.body.terms_version_required).toBe('2026-11-v1');
    expect(r.body.member).toEqual({ badge: 'staff', early_access: true, links_allowed: false, terms_version: 'v', terms_accepted_at: 't', banned_until: null, email_replies: true });
    expect(r.headers['Cache-Control']).toBe('private, no-store');
  });
});
