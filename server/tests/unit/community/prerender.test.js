'use strict';
// Community bot prerender: resolvers (flag, 301/410/404, robots, JSON-LD) + the HTTP shell.
jest.mock('../../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../../utils/sitemapCache', () => ({ bustSitemapCache: jest.fn() }));
jest.mock('../../../config/supabase', () => {
  const db = { handlers: {} };
  db.on = (table, fn) => { db.handlers[table] = fn; };
  const chain = (table) => {
    const ops = [];
    const resolve = () => Promise.resolve((db.handlers[table] || (() => ({ data: [], error: null })))(ops));
    const c = { then: (ok, bad) => resolve().then(ok, bad), single: () => resolve(), maybeSingle: () => resolve() };
    for (const m of ['select', 'eq', 'neq', 'in', 'or', 'is', 'gt', 'lt', 'order', 'limit']) {
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
const {
  resolveCommunityHome, resolveCommunitySpace, resolveCommunityItem, resolveCommunityGuidelines,
} = require('../../../controllers/prerenderCommunity');
const { buildHtml } = require('../../../controllers/prerenderController');

const db = supabaseAdmin.__db;
const HOST = 'aaaaaaaa-0000-4000-8000-000000000001';
const GUEST = 'aaaaaaaa-0000-4000-8000-000000000002';
const BANNED = 'aaaaaaaa-0000-4000-8000-000000000009';
const SPACE = { id: 'sp-gen', key: 'general', name: 'General', description: 'Anything goes.', is_active: true, position: 1 };
const PROFILES = [
  { id: HOST, name: 'Priya Sharma', first_name: 'Priya', username: 'priya', is_host: true, is_banned: false },
  { id: GUEST, name: 'Asha Secretlast', first_name: 'Asha', username: 'asha_private_handle', is_host: false, is_banned: false },
  { id: BANNED, name: 'Bad', first_name: 'Bad', username: 'bad', is_host: true, is_banned: false },
];
let n = 0;
const post = (over = {}) => {
  n += 1;
  return {
    id: `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`, kind: 'thread', format: 'text', author_id: HOST,
    space_id: SPACE.id, title: `Thread ${n}`, body: `Body ${n}`, slug: `slug-${n}`, status: 'visible',
    like_count: 0, comment_count: 0, is_pinned: false, is_indexable: true, accepted_comment_id: null,
    created_at: '2026-11-01T10:00:00.000Z', edited_at: null, last_activity_at: '2026-11-02T10:00:00.000Z', ...over,
  };
};
const comment = (postId, over = {}) => {
  n += 1;
  return {
    id: `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`, post_id: postId, parent_id: null, author_id: GUEST,
    body: `Reply ${n}`, status: 'visible', like_count: 0, created_at: '2026-11-01T11:00:00.000Z', edited_at: null, ...over,
  };
};

const eqVal = (ops, col) => (ops.find((o) => o[0] === 'eq' && o[1] === col) || [])[2];

function setup({ flag = true, posts = [], comments = [], banned = [] } = {}) {
  store.resetReadCaches();
  isFeatureEnabled.mockReset();
  if (flag instanceof Error) isFeatureEnabled.mockRejectedValue(flag);
  else isFeatureEnabled.mockResolvedValue(flag);
  db.on('community_spaces', () => ({ data: [SPACE], error: null }));
  db.on('community_posts', (ops) => {
    const slug = eqVal(ops, 'slug');
    if (slug) return { data: posts.find((p) => p.slug === slug) || null, error: null };
    const spaceId = eqVal(ops, 'space_id');
    return { data: posts.filter((p) => p.status === 'visible' && (!spaceId || p.space_id === spaceId)), error: null };
  });
  db.on('community_comments', (ops) => {
    const id = eqVal(ops, 'id');
    if (id) return { data: comments.find((c) => c.id === id) || null, error: null };
    return { data: comments.filter((c) => c.post_id === eqVal(ops, 'post_id')), error: null };
  });
  db.on('community_members', (ops) => (ops.some((o) => o[0] === 'gt')
    ? { data: banned.map((id) => ({ user_id: id })), error: null }
    : { data: [], error: null }));
  db.on('profiles', (ops) => (eqVal(ops, 'is_banned') !== undefined
    ? { data: [], error: null }
    : { data: PROFILES, error: null }));
  db.on('community_media', () => ({ data: [], error: null }));
  db.on('community_reactions', () => ({ data: [], error: null }));
}

const html = (m) => buildHtml(m.buildHtmlArgs);
const types = (ld) => [].concat(ld).map((x) => x['@type']);

describe('flag off: every resolver 404s', () => {
  test.each([
    ['home', () => resolveCommunityHome()],
    ['space', () => resolveCommunitySpace('general')],
    ['item', () => resolveCommunityItem('t', 'slug-x')],
    ['guidelines', () => resolveCommunityGuidelines()],
  ])('%s', async (_, run) => {
    const p = post({ slug: 'slug-x' });
    setup({ flag: false, posts: [p] });
    expect(await run()).toEqual({ status: 404 });
    setup({ flag: new Error('flags table down'), posts: [p] });
    expect(await run()).toEqual({ status: 404 });
  });
});

describe('resolveCommunityItem', () => {
  test('thread requested under /p/ -> 301 to /t/', async () => {
    const p = post();
    setup({ posts: [p] });
    expect(await resolveCommunityItem('p', p.slug)).toEqual({ status: 301, redirectTo: `https://meeticulous.com/community/t/${p.slug}` });
  });

  test('post requested under /t/ -> 301 to /p/', async () => {
    const p = post({ kind: 'post', title: null, space_id: null });
    setup({ posts: [p] });
    expect(await resolveCommunityItem('t', p.slug)).toEqual({ status: 301, redirectTo: `https://meeticulous.com/community/p/${p.slug}` });
  });

  test.each(['removed', 'deleted'])('%s item -> 410', async (status) => {
    const p = post({ status });
    setup({ posts: [p] });
    expect((await resolveCommunityItem('t', p.slug)).status).toBe(410);
  });

  test('missing, hidden and banned-author items -> 404', async () => {
    const hidden = post({ status: 'hidden' });
    const bannedPost = post({ author_id: BANNED });
    setup({ posts: [hidden, bannedPost], banned: [BANNED] });
    expect(await resolveCommunityItem('t', 'nope')).toEqual({ status: 404 });
    expect(await resolveCommunityItem('t', hidden.slug)).toEqual({ status: 404 });
    expect(await resolveCommunityItem('t', bannedPost.slug)).toEqual({ status: 404 });
  });

  test('robots follows is_indexable', async () => {
    const on = post();
    const off = post({ is_indexable: false });
    setup({ posts: [on, off] });
    expect((await resolveCommunityItem('t', on.slug)).buildHtmlArgs.robots).toBe('index,follow');
    expect((await resolveCommunityItem('t', off.slug)).buildHtmlArgs.robots).toBe('noindex,follow');
  });

  test('meta: title suffix, canonical, default OG image, breadcrumb', async () => {
    const p = post({ title: 'Pricing tips' });
    setup({ posts: [p] });
    const { buildHtmlArgs: a } = await resolveCommunityItem('t', p.slug);
    expect(a.title).toBe('Pricing tips — Meeticulous Community');
    expect(a.canonical).toBe(`https://meeticulous.com/community/t/${p.slug}`);
    expect(a.image).toBeUndefined();
    expect(a.breadcrumbJsonLd['@type']).toBe('BreadcrumbList');
    expect(types(a.jsonLd)).toEqual(['DiscussionForumPosting']);
  });

  test('question with an accepted answer -> QAPage', async () => {
    const p = post({ format: 'question' });
    const c = comment(p.id, { author_id: HOST });
    p.accepted_comment_id = c.id;
    setup({ posts: [p], comments: [c] });
    const { buildHtmlArgs: a } = await resolveCommunityItem('t', p.slug);
    expect(types(a.jsonLd)).toContain('QAPage');
    expect([].concat(a.jsonLd).find((x) => x['@type'] === 'QAPage').mainEntity.acceptedAnswer.text).toBe(c.body);
  });

  test('user HTML is escaped, and </script> in text cannot break out of JSON-LD', async () => {
    const p = post({ title: '<i>t</i>', body: '<b>x</b>\nline2 </script><script>alert(1)</script>' });
    setup({ posts: [p], comments: [comment(p.id, { body: '<img src=x onerror=alert(1)>' })] });
    const out = html(await resolveCommunityItem('t', p.slug));
    expect(out).not.toContain('<b>x</b>');
    expect(out).toContain('&lt;b&gt;x&lt;/b&gt;<br>line2');
    expect(out).not.toContain('<i>t</i>');
    expect(out).not.toContain('<img src=x');
    expect(out).not.toContain('<script>alert(1)');
    const ldScripts = (out.match(/<script type="application\/ld\+json">/g) || []).length;
    expect((out.match(/<\/script>/g) || []).length).toBe(ldScripts);
  });

  test('guest author: first name only, no url, no username/last name anywhere', async () => {
    const p = post({ author_id: GUEST, kind: 'post', title: null, space_id: null });
    setup({ posts: [p], comments: [comment(p.id)] });
    const m = await resolveCommunityItem('p', p.slug);
    const author = [].concat(m.buildHtmlArgs.jsonLd)[0].author;
    expect(author).toEqual({ '@type': 'Person', name: 'Asha' });
    const out = html(m);
    expect(out).not.toContain('asha_private_handle');
    expect(out).not.toContain('Secretlast');
  });

  test('host author links to the profile', async () => {
    const p = post();
    setup({ posts: [p] });
    const m = await resolveCommunityItem('t', p.slug);
    expect([].concat(m.buildHtmlArgs.jsonLd)[0].author).toEqual({ '@type': 'Person', name: 'Priya Sharma', url: 'https://meeticulous.com/priya' });
    expect(m.buildHtmlArgs.bodyHtml).toContain('href="https://meeticulous.com/priya"');
  });

  test('deleted author -> "Deleted account"', async () => {
    const p = post({ author_id: null });
    setup({ posts: [p] });
    const m = await resolveCommunityItem('t', p.slug);
    expect([].concat(m.buildHtmlArgs.jsonLd)[0].author.name).toBe('Deleted account');
    expect(m.buildHtmlArgs.bodyHtml).toContain('Deleted account');
  });

  test('tombstoned and banned-author replies never reach the HTML; space link present', async () => {
    const p = post();
    const ok = comment(p.id, { body: 'visible reply' });
    const gone = comment(p.id, { status: 'removed', body: 'REMOVED TEXT' });
    const del = comment(p.id, { status: 'deleted', body: 'DELETED TEXT' });
    const bad = comment(p.id, { author_id: BANNED, body: 'BANNED TEXT' });
    setup({ posts: [p], comments: [ok, gone, del, bad], banned: [BANNED] });
    const { buildHtmlArgs: a } = await resolveCommunityItem('t', p.slug);
    expect(a.bodyHtml).toContain('visible reply');
    expect(a.bodyHtml).toContain(`id="c-${ok.id}"`);
    for (const c of [gone, del, bad]) expect(a.bodyHtml).not.toContain(c.id);
    expect(JSON.stringify(a.jsonLd)).not.toMatch(/REMOVED|DELETED|BANNED/);
    expect(a.bodyHtml).toContain('href="https://meeticulous.com/community/s/general"');
  });

  test('at most 20 replies in the HTML', async () => {
    const p = post();
    const many = Array.from({ length: 25 }, () => comment(p.id));
    setup({ posts: [p], comments: many });
    const { buildHtmlArgs: a } = await resolveCommunityItem('t', p.slug);
    expect((a.bodyHtml.match(/id="c-/g) || []).length).toBe(20);
  });

  test('first photo is the OG image', async () => {
    const p = post();
    setup({ posts: [p] });
    db.on('community_media', () => ({ data: [{ post_id: p.id, url: 'https://cdn/x.jpg', position: 0 }], error: null }));
    expect((await resolveCommunityItem('t', p.slug)).buildHtmlArgs.image).toBe('https://cdn/x.jpg');
  });
});

describe('home, space, guidelines', () => {
  test('home lists the latest items as links, skipping banned authors', async () => {
    const a = post({ title: 'Alpha' });
    const b = post({ kind: 'post', title: null, space_id: null, body: 'x'.repeat(100) });
    const c = post({ author_id: BANNED, title: 'Hidden one' });
    setup({ posts: [a, b, c], banned: [BANNED] });
    const m = await resolveCommunityHome();
    expect(m.status).toBe(200);
    expect(m.buildHtmlArgs.canonical).toBe('https://meeticulous.com/community');
    expect(m.buildHtmlArgs.robots).toBe('index,follow');
    expect(types(m.buildHtmlArgs.jsonLd)).toContain('CollectionPage');
    expect(m.buildHtmlArgs.bodyHtml).toContain(`href="https://meeticulous.com/community/t/${a.slug}">Alpha</a>`);
    expect(m.buildHtmlArgs.bodyHtml).toContain(`href="https://meeticulous.com/community/p/${b.slug}">${'x'.repeat(60)}</a>`);
    expect(m.buildHtmlArgs.bodyHtml).not.toContain('Hidden one');
  });

  test('space page: 404 for an unknown key, links threads for a known one', async () => {
    const a = post({ title: 'In general' });
    setup({ posts: [a] });
    expect(await resolveCommunitySpace('nope')).toEqual({ status: 404 });
    const m = await resolveCommunitySpace('general');
    expect(m.buildHtmlArgs.title).toBe('General — Meeticulous Community');
    expect(m.buildHtmlArgs.canonical).toBe('https://meeticulous.com/community/s/general');
    expect(m.buildHtmlArgs.bodyHtml).toContain('In general');
    expect(m.buildHtmlArgs.breadcrumbJsonLd.itemListElement).toHaveLength(2);
  });

  test('guidelines page renders when the flag is on', async () => {
    setup();
    const m = await resolveCommunityGuidelines();
    expect(m.status).toBe(200);
    expect(m.buildHtmlArgs.canonical).toBe('https://meeticulous.com/community/guidelines');
  });

  test('a missing community table -> 404, never a 500', async () => {
    setup();
    db.on('community_spaces', () => ({ data: null, error: { code: '42P01', message: 'relation "community_spaces" does not exist' } }));
    db.on('community_posts', () => ({ data: null, error: { code: '42P01', message: 'relation "community_posts" does not exist' } }));
    expect(await resolveCommunityHome()).toEqual({ status: 404 });
    expect(await resolveCommunityItem('t', 'x')).toEqual({ status: 404 });
  });
});

describe('HTTP routes (registered before /:username)', () => {
  const app = express();
  app.use('/prerender', require('../../../routes/prerenderRoutes'));

  test('200 with the prerender cache header', async () => {
    const p = post();
    setup({ posts: [p] });
    const res = await request(app).get(`/prerender/community/t/${p.slug}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['cache-control']).toBe('public, max-age=120, s-maxage=300');
    expect(res.text).toContain('application/ld+json');
  });

  test('410 HTML for a removed post', async () => {
    const p = post({ status: 'removed' });
    setup({ posts: [p] });
    const res = await request(app).get(`/prerender/community/t/${p.slug}`);
    expect(res.status).toBe(410);
    expect(res.text).toContain('This post was removed');
    expect(res.headers['cache-control']).toBe('public, max-age=60');
  });

  test('301 on the wrong prefix', async () => {
    const p = post();
    setup({ posts: [p] });
    const res = await request(app).get(`/prerender/community/p/${p.slug}`);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(`https://meeticulous.com/community/t/${p.slug}`);
  });

  test.each(['/community', '/community/guidelines', '/community/s/general', '/community/t/x', '/community/p/x'])(
    'flag off: %s -> 404 from the community handler, not the profile one', async (path) => {
      setup({ flag: false });
      const res = await request(app).get(`/prerender${path}`);
      expect(res.status).toBe(404);
      expect(res.headers['cache-control']).toBe('public, max-age=60');
    },
  );
});
