'use strict';
// Community write API: controller handlers driven against a scripted supabase mock.
// db.on(table, fn): fn(ops) -> {data, error, count} for each awaited query on that table;
// ops = [[method, ...args]]. Every query is recorded in db.calls for payload assertions.
jest.mock('../../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../services/community/notify', () => ({
  onComment: jest.fn().mockResolvedValue(undefined),
  onMentions: jest.fn().mockResolvedValue(undefined),
  onRemoved: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../utils/sitemapCache', () => ({ bustSitemapCache: jest.fn() }));
jest.mock('../../../config/supabase', () => {
  const db = { handlers: {}, calls: [] };
  db.on = (table, fn) => { db.handlers[table] = fn; };
  const chain = (table) => {
    const ops = [];
    const resolve = () => Promise.resolve((db.handlers[table] || (() => ({ data: null, error: null })))(ops));
    const c = {
      then: (ok, bad) => resolve().then(ok, bad),
      single: () => resolve(),
      maybeSingle: () => resolve(),
    };
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'or', 'is', 'gt', 'order', 'limit', 'ilike']) {
      c[m] = (...args) => { ops.push([m, ...args]); return c; };
    }
    db.calls.push({ table, ops });
    return c;
  };
  return { supabaseAdmin: { from: jest.fn(chain), __db: db } };
});

const { supabaseAdmin } = require('../../../config/supabase');
const notify = require('../../../services/community/notify');
const { bustSitemapCache } = require('../../../utils/sitemapCache');
const ctrl = require('../../../controllers/communityController');
const store = require('../../../services/community/store');

const db = supabaseAdmin.__db;
const has = (ops, m) => ops.some((o) => o[0] === m);
const arg = (ops, m) => (ops.find((o) => o[0] === m) || [])[1];
const eqVal = (ops, col) => (ops.find((o) => o[0] === 'eq' && o[1] === col) || [])[2];
const callsOn = (table, m) => db.calls.filter((c) => c.table === table && has(c.ops, m));

const ME = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTHER = 'aaaaaaaa-0000-4000-8000-000000000002';
const POST_ID = '11111111-1111-4111-8111-111111111111';
const COMMENT_ID = '22222222-2222-4222-8222-222222222222';
const DAY = 24 * 3600 * 1000;

const GUEST = { id: ME, is_host: false, is_verified: false, created_at: new Date(Date.now() - 30 * DAY).toISOString(), username: null, name: null, first_name: 'Asha', profile_image: null, is_banned: false };
const HOST = { ...GUEST, is_host: true, username: 'asha', name: 'Asha Studio' };
const MEMBER = { user_id: ME, terms_version: '2026-11-v1', badge: null, banned_until: null, links_allowed: false, post_count: 0, comment_count: 0 };
const SPACES = {
  general: { id: 'sp-gen', key: 'general', name: 'General', post_policy: 'everyone', reply_policy: 'everyone', is_active: true },
  'host-corner': { id: 'sp-hc', key: 'host-corner', name: 'Host Corner', post_policy: 'hosts', reply_policy: 'hosts', is_active: true },
};
const post = (over = {}) => ({ id: POST_ID, kind: 'thread', format: 'text', author_id: ME, space_id: 'sp-gen', title: 'Hello', body: 'Body text', slug: 'hello-abc123', status: 'visible', accepted_comment_id: null, comment_count: 0, like_count: 0, ...over });
const comment = (over = {}) => ({ id: COMMENT_ID, post_id: POST_ID, parent_id: null, author_id: ME, body: 'Nice', status: 'visible', like_count: 0, ...over });

function setup({ profile = GUEST, postRow = post(), commentRow = comment(), reportCount = 0 } = {}) {
  db.on('profiles', (ops) => {
    if (has(ops, 'in')) return { data: [{ id: 'user-9', username: 'ravi' }], error: null };
    return { data: eqVal(ops, 'id') === OTHER ? { ...GUEST, id: OTHER } : profile, error: null };
  });
  db.on('community_spaces', (ops) => {
    const key = eqVal(ops, 'key');
    const id = eqVal(ops, 'id');
    return { data: key ? SPACES[key] || null : Object.values(SPACES).find((s) => s.id === id) || null, error: null };
  });
  db.on('community_posts', (ops) => {
    if (has(ops, 'insert')) return { data: { ...post(), ...arg(ops, 'insert'), id: POST_ID }, error: null };
    if (has(ops, 'update')) return { data: { ...postRow, ...arg(ops, 'update') }, error: null };
    return { data: postRow, error: null };
  });
  db.on('community_comments', (ops) => {
    if (has(ops, 'insert')) return { data: { ...comment(), ...arg(ops, 'insert'), id: COMMENT_ID }, error: null };
    if (has(ops, 'update')) return { data: { ...commentRow, ...arg(ops, 'update') }, error: null };
    if ((ops.find((o) => o[0] === 'select') || [])[2]?.head) return { data: null, count: 0, error: null };
    return { data: commentRow, error: null };
  });
  db.on('community_reports', (ops) => {
    if (has(ops, 'insert')) return { data: null, error: null };
    return { data: null, count: reportCount, error: null };
  });
  db.on('community_members', () => ({ data: null, error: null }));
  db.on('community_blocks', () => ({ data: [], error: null }));
  db.on('community_media', (ops) => ({ data: has(ops, 'insert') ? arg(ops, 'insert') : [], error: null }));
  db.on('community_mentions', () => ({ data: null, error: null }));
  db.on('community_reactions', () => ({ data: null, error: null }));
}

const req = (body = {}, params = {}, member = MEMBER) => ({ body, params, user: { id: ME }, communityMember: member });
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const statusOf = (r) => (r.status.mock.calls[0] || [200])[0];
const bodyOf = (r) => r.json.mock.calls[0][0];

beforeEach(() => {
  jest.clearAllMocks();
  db.calls.length = 0;
  db.handlers = {};
  setup();
});

describe('createItem', () => {
  test('thread without space_key -> 400 SPACE_REQUIRED', async () => {
    const r = res();
    await ctrl.createItem(req({ kind: 'thread', format: 'text', title: 'A title', body: 'Hello there' }), r);
    expect(statusOf(r)).toBe(400);
    expect(['TITLE_REQUIRED', 'SPACE_REQUIRED']).toContain(bodyOf(r).code);
    expect(bodyOf(r).code).toBe('SPACE_REQUIRED');
  });

  test('guest thread in host-corner -> 403', async () => {
    const r = res();
    await ctrl.createItem(req({ kind: 'thread', title: 'Pricing', body: 'How do you price?', space_key: 'host-corner' }), r);
    expect(statusOf(r)).toBe(403);
    expect(callsOn('community_posts', 'insert')).toHaveLength(0);
  });

  test('guest announcement -> 403', async () => {
    const r = res();
    await ctrl.createItem(req({ kind: 'post', format: 'announcement', body: 'Big news' }), r);
    expect(statusOf(r)).toBe(403);
  });

  test('phase-2 format -> 400 FORMAT_NOT_AVAILABLE', async () => {
    const r = res();
    await ctrl.createItem(req({ kind: 'post', format: 'poll', body: 'Pick one' }), r);
    expect(statusOf(r)).toBe(400);
    expect(bodyOf(r).code).toBe('FORMAT_NOT_AVAILABLE');
  });

  test('unknown space -> 400 SPACE_NOT_FOUND', async () => {
    const r = res();
    await ctrl.createItem(req({ kind: 'thread', title: 'T', body: 'B', space_key: 'nope' }), r);
    expect(statusOf(r)).toBe(400);
    expect(bodyOf(r).code).toBe('SPACE_NOT_FOUND');
  });

  test('phone number in body -> 400 CONTACT_NOT_ALLOWED', async () => {
    const r = res();
    await ctrl.createItem(req({ kind: 'post', body: 'Call me on 9876543210' }), r);
    expect(statusOf(r)).toBe(400);
    expect(bodyOf(r).code).toBe('CONTACT_NOT_ALLOWED');
  });

  test('foreign media URL -> 400 MEDIA_NOT_ALLOWED', async () => {
    const r = res();
    await ctrl.createItem(req({ kind: 'post', body: 'Look', media: [{ url: 'https://evil.example/x.png' }] }), r);
    expect(statusOf(r)).toBe(400);
    expect(bodyOf(r).code).toBe('MEDIA_NOT_ALLOWED');
  });

  test('valid post -> 201, slug + author_id, media, mentions, sitemap bust', async () => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    const url = 'https://proj.supabase.co/storage/v1/object/public/images/community/a.png';
    const r = res();
    await ctrl.createItem(req({ kind: 'thread', title: 'My first thread', body: 'Hi @ravi, welcome', space_key: 'general', media: [{ url, width: 10, height: 20 }] }), r);
    expect(statusOf(r)).toBe(201);
    const payload = arg(callsOn('community_posts', 'insert')[0].ops, 'insert');
    expect(payload.slug).toMatch(/^[a-z0-9-]+-[a-z0-9]{6}$/);
    expect(payload.author_id).toBe(ME);
    expect(payload.space_id).toBe('sp-gen');
    expect(payload).not.toHaveProperty('like_count');
    const media = arg(callsOn('community_media', 'insert')[0].ops, 'insert');
    expect(media).toEqual([{ post_id: POST_ID, kind: 'image', url, width: 10, height: 20, alt: null, position: 0 }]);
    expect(arg(callsOn('community_mentions', 'insert')[0].ops, 'insert')).toEqual([{ post_id: POST_ID, mentioned_user_id: 'user-9' }]);
    expect(notify.onMentions).toHaveBeenCalledWith(expect.objectContaining({ comment: null, usernames: ['ravi'], actorId: ME }));
    expect(bustSitemapCache).toHaveBeenCalled();
    const { item } = bodyOf(r);
    expect(item.author.id).toBe(ME);
    expect(item.space).toEqual({ key: 'general', name: 'General' });
    expect(item.media[0].url).toBe(url);
  });

  test('slug unique violation retries once', async () => {
    let n = 0;
    db.on('community_posts', (ops) => {
      if (has(ops, 'insert')) {
        n += 1;
        return n === 1 ? { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "community_posts_slug_key"' } } : { data: { ...post(), ...arg(ops, 'insert') }, error: null };
      }
      return { data: post(), error: null };
    });
    const r = res();
    await ctrl.createItem(req({ kind: 'post', body: 'Hello world' }), r);
    expect(statusOf(r)).toBe(201);
    expect(n).toBe(2);
  });

  test('media insert failure soft-deletes the new post, then 500', async () => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    db.on('community_media', () => ({ data: null, error: { code: 'XX000', message: 'boom' } }));
    const r = res();
    const url = 'https://proj.supabase.co/storage/v1/object/public/images/community/a.png';
    await ctrl.createItem(req({ kind: 'post', body: 'Look at this', media: [{ url }] }), r);
    expect(statusOf(r)).toBe(500);
    const retire = callsOn('community_posts', 'update').map((c) => c.ops).find((ops) => arg(ops, 'update').status === 'deleted');
    expect(retire).toBeTruthy();
    expect(eqVal(retire, 'id')).toBe(POST_ID);
    expect(arg(retire, 'update').deleted_at).toBeTruthy();
    expect(bustSitemapCache).not.toHaveBeenCalled();
  });

  test('missing table -> 503 COMMUNITY_UNAVAILABLE', async () => {
    db.on('community_posts', () => ({ data: null, error: { code: '42P01', message: 'relation "community_posts" does not exist' } }));
    const r = res();
    await ctrl.createItem(req({ kind: 'post', body: 'Hello world' }), r);
    expect(statusOf(r)).toBe(503);
    expect(bodyOf(r).code).toBe('COMMUNITY_UNAVAILABLE');
  });
});

describe('linksAllowed (visible posts/comments only)', () => {
  const ago = (d) => new Date(Date.now() - d * DAY).toISOString();
  // Rows per table; the mock counts only rows matching the query's status filter.
  const rows = (posts, comments = []) => {
    const count = (list) => (ops) => {
      const status = eqVal(ops, 'status');
      return { data: null, count: list.filter((r) => !status || r.status === status).length, error: null };
    };
    db.on('community_posts', count(posts));
    db.on('community_comments', count(comments));
  };
  const v = (n) => Array.from({ length: n }, () => ({ status: 'visible' }));
  const removed = (n) => Array.from({ length: n }, () => ({ status: 'removed' }));

  test('8 days old with 3 visible -> true', async () => {
    rows(v(2), v(1));
    expect(await store.linksAllowed({ id: ME, created_at: ago(8) }, { post_count: 0 })).toBe(true);
  });
  test('8 days old with 2 visible + 5 removed -> false', async () => {
    rows([...v(2), ...removed(5)]);
    expect(await store.linksAllowed({ id: ME, created_at: ago(8) }, { post_count: 7, comment_count: 0 })).toBe(false);
  });
  test('2 days old with 10 visible -> false, no count query', async () => {
    rows(v(10));
    expect(await store.linksAllowed({ id: ME, created_at: ago(2) }, { post_count: 10 })).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
  test('stops counting once 3 visible posts found', async () => {
    rows(v(3), v(5));
    expect(await store.linksAllowed({ id: ME, created_at: ago(8) }, null)).toBe(true);
    expect(db.calls.map((c) => c.table)).toEqual(['community_posts']);
  });
  test('verified host or member flag -> true', async () => {
    expect(await store.linksAllowed({ id: ME, created_at: ago(0), is_host: true, is_verified: true }, null)).toBe(true);
    expect(await store.linksAllowed({ id: ME, created_at: ago(0) }, { links_allowed: true })).toBe(true);
  });
});

describe('edit / delete item', () => {
  test("editing someone else's item -> 403", async () => {
    setup({ postRow: post({ author_id: OTHER }) });
    const r = res();
    await ctrl.updateItem(req({ body: 'changed' }, { id: POST_ID }), r);
    expect(statusOf(r)).toBe(403);
    expect(callsOn('community_posts', 'update')).toHaveLength(0);
  });

  test('editing a removed item -> 409 NOT_EDITABLE', async () => {
    setup({ postRow: post({ status: 'removed' }) });
    const r = res();
    await ctrl.updateItem(req({ body: 'changed' }, { id: POST_ID }), r);
    expect(statusOf(r)).toBe(409);
    expect(bodyOf(r).code).toBe('NOT_EDITABLE');
  });

  test('editing own item updates body + edited_at, no re-notify', async () => {
    const r = res();
    await ctrl.updateItem(req({ body: 'changed @ravi' }, { id: POST_ID }), r);
    expect(statusOf(r)).toBe(200);
    const patch = arg(callsOn('community_posts', 'update')[0].ops, 'update');
    expect(patch.body).toBe('changed @ravi');
    expect(patch.edited_at).toBeTruthy();
    expect(notify.onMentions).not.toHaveBeenCalled();
  });

  test('deleting own item -> update status deleted', async () => {
    const r = res();
    await ctrl.deleteItem(req({}, { id: POST_ID }), r);
    expect(statusOf(r)).toBe(200);
    const patch = arg(callsOn('community_posts', 'update')[0].ops, 'update');
    expect(patch.status).toBe('deleted');
    expect(patch.deleted_at).toBeTruthy();
    expect(bustSitemapCache).toHaveBeenCalled();
  });

  test('delete loses a race with moderation -> 409 NOT_EDITABLE', async () => {
    db.on('community_posts', (ops) => ({ data: has(ops, 'update') ? null : post(), error: null }));
    const r = res();
    await ctrl.deleteItem(req({}, { id: POST_ID }), r);
    expect(statusOf(r)).toBe(409);
    expect(bodyOf(r).code).toBe('NOT_EDITABLE');
  });

  test("deleting someone else's item -> 403", async () => {
    setup({ postRow: post({ author_id: OTHER }) });
    const r = res();
    await ctrl.deleteItem(req({}, { id: POST_ID }), r);
    expect(statusOf(r)).toBe(403);
  });

  test('bad id -> 404', async () => {
    const r = res();
    await ctrl.deleteItem(req({}, { id: 'not-a-uuid' }), r);
    expect(statusOf(r)).toBe(404);
  });
});

describe('comments', () => {
  test('guest comment on a host-corner thread -> 403', async () => {
    setup({ postRow: post({ space_id: 'sp-hc', author_id: OTHER }) });
    const r = res();
    await ctrl.createComment(req({ body: 'Me too' }, { id: POST_ID }), r);
    expect(statusOf(r)).toBe(403);
    expect(callsOn('community_comments', 'insert')).toHaveLength(0);
  });

  test('comment created -> 201, notify.onComment once, indexable refreshed', async () => {
    setup({ postRow: post({ author_id: OTHER }) });
    const r = res();
    await ctrl.createComment(req({ body: 'Great point' }, { id: POST_ID }), r);
    expect(statusOf(r)).toBe(201);
    expect(notify.onComment).toHaveBeenCalledTimes(1);
    expect(notify.onComment).toHaveBeenCalledWith(expect.objectContaining({ actorId: ME, comment: expect.objectContaining({ id: COMMENT_ID }) }));
    const payload = arg(callsOn('community_comments', 'insert')[0].ops, 'insert');
    expect(payload).toMatchObject({ post_id: POST_ID, author_id: ME, body: 'Great point' });
    expect(bodyOf(r).comment.author.id).toBe(ME);
    expect(callsOn('community_posts', 'update').some((c) => 'is_indexable' in arg(c.ops, 'update'))).toBe(true);
  });

  test('notify rejection does not fail the request', async () => {
    notify.onComment.mockRejectedValueOnce(new Error('boom'));
    const r = res();
    await ctrl.createComment(req({ body: 'Great point' }, { id: POST_ID }), r);
    expect(statusOf(r)).toBe(201);
  });

  test("editing someone else's comment -> 403", async () => {
    setup({ commentRow: comment({ author_id: OTHER }) });
    const r = res();
    await ctrl.updateComment(req({ body: 'x' }, { id: COMMENT_ID }), r);
    expect(statusOf(r)).toBe(403);
  });

  test('deleting own comment -> status deleted', async () => {
    const r = res();
    await ctrl.deleteComment(req({}, { id: COMMENT_ID }), r);
    expect(statusOf(r)).toBe(200);
    expect(arg(callsOn('community_comments', 'update')[0].ops, 'update').status).toBe('deleted');
  });

  test('comment delete loses a race with moderation -> 409 NOT_EDITABLE', async () => {
    db.on('community_comments', (ops) => ({ data: has(ops, 'update') ? null : comment(), error: null }));
    const r = res();
    await ctrl.deleteComment(req({}, { id: COMMENT_ID }), r);
    expect(statusOf(r)).toBe(409);
    expect(bodyOf(r).code).toBe('NOT_EDITABLE');
  });
});

describe('accept answer', () => {
  test('non-question -> 400 NOT_A_QUESTION', async () => {
    const r = res();
    await ctrl.acceptAnswer(req({ comment_id: COMMENT_ID }, { id: POST_ID }), r);
    expect(statusOf(r)).toBe(400);
    expect(bodyOf(r).code).toBe('NOT_A_QUESTION');
  });
  test('not the item author -> 403', async () => {
    setup({ postRow: post({ format: 'question', author_id: OTHER }) });
    const r = res();
    await ctrl.acceptAnswer(req({ comment_id: COMMENT_ID }, { id: POST_ID }), r);
    expect(statusOf(r)).toBe(403);
  });
  test('author accepts a visible comment on the question', async () => {
    setup({ postRow: post({ format: 'question' }), commentRow: comment({ author_id: OTHER }) });
    const r = res();
    await ctrl.acceptAnswer(req({ comment_id: COMMENT_ID }, { id: POST_ID }), r);
    expect(statusOf(r)).toBe(200);
    expect(arg(callsOn('community_posts', 'update')[0].ops, 'update')).toEqual({ accepted_comment_id: COMMENT_ID });
  });
  test('comment from another item -> 400', async () => {
    setup({ postRow: post({ format: 'question' }), commentRow: comment({ post_id: 'other-post' }) });
    const r = res();
    await ctrl.acceptAnswer(req({ comment_id: COMMENT_ID }, { id: POST_ID }), r);
    expect(statusOf(r)).toBe(400);
  });
});

describe('reactions', () => {
  test('second like is a no-op (duplicate key ignored)', async () => {
    db.on('community_reactions', () => ({ data: null, error: { code: '23505', message: 'duplicate key value' } }));
    const r = res();
    await ctrl.addReaction(req({ target_type: 'post', target_id: POST_ID }), r);
    expect(statusOf(r)).toBe(200);
    expect(bodyOf(r)).toEqual({ liked: true });
    expect(callsOn('community_posts', 'update')).toHaveLength(0); // counters are trigger-owned
  });
  test('like on a hidden post by someone else -> 404', async () => {
    setup({ postRow: post({ status: 'hidden', author_id: OTHER }) });
    const r = res();
    await ctrl.addReaction(req({ target_type: 'post', target_id: POST_ID }), r);
    expect(statusOf(r)).toBe(404);
  });
  test('unlike returns 200 either way', async () => {
    const r = res();
    await ctrl.removeReaction(req({ target_type: 'comment', target_id: COMMENT_ID }), r);
    expect(statusOf(r)).toBe(200);
    expect(callsOn('community_reactions', 'delete')).toHaveLength(1);
  });
});

describe('reports', () => {
  test('reporting your own post -> 400 CANNOT_REPORT_SELF', async () => {
    const r = res();
    await ctrl.createReport(req({ target_type: 'post', target_id: POST_ID, reason: 'spam' }), r);
    expect(statusOf(r)).toBe(400);
    expect(bodyOf(r).code).toBe('CANNOT_REPORT_SELF');
  });
  test('third report hides the post', async () => {
    setup({ postRow: post({ author_id: OTHER }), reportCount: 3 });
    const r = res();
    await ctrl.createReport(req({ target_type: 'post', target_id: POST_ID, reason: 'spam' }), r);
    expect(statusOf(r)).toBe(201);
    const hide = callsOn('community_posts', 'update').find((c) => arg(c.ops, 'update').status === 'hidden');
    expect(hide).toBeTruthy();
    expect(eqVal(hide.ops, 'status')).toBe('visible');
    expect(bustSitemapCache).toHaveBeenCalled();
  });
  test('second report does not hide', async () => {
    setup({ postRow: post({ author_id: OTHER }), reportCount: 2 });
    const r = res();
    await ctrl.createReport(req({ target_type: 'post', target_id: POST_ID, reason: 'spam' }), r);
    expect(callsOn('community_posts', 'update').filter((c) => arg(c.ops, 'update').status === 'hidden')).toHaveLength(0);
  });
  test('duplicate report -> 200, idempotent', async () => {
    setup({ postRow: post({ author_id: OTHER }), reportCount: 5 });
    db.on('community_reports', () => ({ data: null, error: { code: '23505', message: 'duplicate key' } }));
    const r = res();
    await ctrl.createReport(req({ target_type: 'post', target_id: POST_ID, reason: 'spam' }), r);
    expect(statusOf(r)).toBe(200);
    expect(callsOn('community_posts', 'update')).toHaveLength(0);
  });
  test('bad reason -> 400', async () => {
    setup({ postRow: post({ author_id: OTHER }) });
    const r = res();
    await ctrl.createReport(req({ target_type: 'post', target_id: POST_ID, reason: 'meh' }), r);
    expect(statusOf(r)).toBe(400);
  });
  test('reporting yourself as a member -> 400', async () => {
    const r = res();
    await ctrl.createReport(req({ target_type: 'member', target_id: ME, reason: 'spam' }), r);
    expect(bodyOf(r).code).toBe('CANNOT_REPORT_SELF');
  });
});

describe('terms', () => {
  test('accept upserts terms_version and returns member', async () => {
    db.on('community_members', (ops) => ({ data: has(ops, 'upsert') ? { user_id: ME, ...arg(ops, 'upsert') } : null, error: null }));
    const r = res();
    await ctrl.acceptTerms(req({}, {}, null), r);
    expect(statusOf(r)).toBe(200);
    const payload = arg(callsOn('community_members', 'upsert')[0].ops, 'upsert');
    expect(payload).toMatchObject({ user_id: ME, terms_version: '2026-11-v1' });
    expect(bodyOf(r).member.terms_version).toBe('2026-11-v1');
  });
  test('banned member -> 403 COMMUNITY_BANNED', async () => {
    const r = res();
    await ctrl.acceptTerms(req({}, {}, { ...MEMBER, banned_until: new Date(Date.now() + DAY).toISOString() }), r);
    expect(statusOf(r)).toBe(403);
    expect(bodyOf(r).code).toBe('COMMUNITY_BANNED');
  });
});

describe('routes', () => {
  const router = require('../../../routes/communityRoutes');
  const gate = require('../../../middleware/communityGate');
  const { protect } = require('../../../middleware/authMiddleware');
  const chainOf = (method, path) => router.stack
    .find((l) => l.route && l.route.path === path && l.route.methods[method]).route.stack.map((s) => s.handle);

  test('POST /items chain', () => {
    expect(chainOf('post', '/items').slice(0, 5)).toEqual([protect, gate.communityGate, gate.requireWrites, gate.requireTerms, gate.postLimiter]);
  });
  test('POST /terms skips requireTerms', () => {
    expect(chainOf('post', '/terms').slice(0, 3)).toEqual([protect, gate.communityGate, gate.requireWrites]);
    expect(chainOf('post', '/terms')).not.toContain(gate.requireTerms);
  });
});
