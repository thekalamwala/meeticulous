// Community admin moderation API: controller handlers against a scripted supabase mock.
// db.on(table, fn): fn(ops) -> {data, error, count}; every query recorded in db.calls.
jest.mock('../../../services/auditService', () => ({ audit: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../services/community/notify', () => ({ onRemoved: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../utils/sitemapCache', () => ({ bustSitemapCache: jest.fn() }));
jest.mock('../../../config/supabase', () => {
  const db = { handlers: {}, calls: [] };
  db.on = (table, fn) => { db.handlers[table] = fn; };
  const chain = (table) => {
    const ops = [];
    const resolve = () => Promise.resolve((db.handlers[table] || (() => ({ data: null, error: null })))(ops));
    const c = { then: (ok, bad) => resolve().then(ok, bad), single: () => resolve(), maybeSingle: () => resolve() };
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'or', 'is', 'gt', 'lt', 'order', 'limit', 'ilike']) {
      c[m] = (...args) => { ops.push([m, ...args]); return c; };
    }
    db.calls.push({ table, ops });
    return c;
  };
  return { supabaseAdmin: { from: jest.fn(chain), __db: db } };
});

const { supabaseAdmin } = require('../../../config/supabase');
const { audit } = require('../../../services/auditService');
const notify = require('../../../services/community/notify');
const ctrl = require('../../../controllers/communityAdminController');
const { ROLES } = require('../../../lib/adminPermissions');

const db = supabaseAdmin.__db;
const has = (ops, m) => ops.some((o) => o[0] === m);
const arg = (ops, m) => (ops.find((o) => o[0] === m) || [])[1];
const callsOn = (table, m) => db.calls.filter((c) => c.table === table && has(c.ops, m));
const ADMIN = { id: 'adm-1', email: 'a@x.com', role: 'operations', permissions: [] };
const POST_ID = '11111111-1111-4111-8111-111111111111';
const COMMENT_ID = '22222222-2222-4222-8222-222222222222';
const USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const mkRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const run = async (fn, { body = {}, params = {}, query = {} } = {}) => {
  const res = mkRes();
  await fn({ admin: ADMIN, body, params, query, headers: {} }, res);
  return res;
};
const code = (res) => res.json.mock.calls[0][0].code;

const mkPost = (o = {}) => ({ id: POST_ID, kind: 'thread', format: 'text', slug: 'hello', title: 'T', body: 'b', author_id: USER, status: 'visible', is_pinned: false, is_indexable: false, comment_count: 0, ...o });

beforeEach(() => { jest.clearAllMocks(); db.handlers = {}; db.calls = []; });

describe('permissions', () => {
  test('support views but cannot moderate; operations has both', () => {
    expect(ROLES.support.permissions).toContain('community.view');
    expect(ROLES.support.permissions).not.toContain('community.moderate');
    expect(ROLES.operations.permissions).toEqual(expect.arrayContaining(['community.view', 'community.moderate']));
  });
});

describe('moderate', () => {
  test('remove post: status, moderator, audit, notify, resolves reports', async () => {
    const state = { post: mkPost() };
    db.on('community_posts', (ops) => {
      if (has(ops, 'update')) Object.assign(state.post, arg(ops, 'update'));
      return { data: state.post, error: null };
    });
    db.on('community_comments', () => ({ data: null, error: null, count: 0 }));
    db.on('community_members', () => ({ data: null, error: null }));
    db.on('profiles', () => ({ data: null, error: null }));
    const res = await run(ctrl.moderate, { params: { type: 'posts', id: POST_ID }, body: { action: 'remove', note: 'spam' } });
    expect(res.status).not.toHaveBeenCalledWith(400);
    const upd = arg(callsOn('community_posts', 'update')[0].ops, 'update');
    expect(upd).toMatchObject({ status: 'removed', moderated_by: 'adm-1', admin_note: 'spam' });
    expect(upd.moderated_at).toBeTruthy();
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'community.remove', resource_id: POST_ID }));
    expect(notify.onRemoved).toHaveBeenCalledWith(expect.objectContaining({ targetType: 'post', item: expect.objectContaining({ id: POST_ID }) }));
    expect(arg(callsOn('community_reports', 'update')[0].ops, 'update')).toMatchObject({ status: 'resolved', resolved_by: 'adm-1', resolution_note: 'remove: spam' });
  });

  test('invalid action -> 400', async () => {
    const res = await run(ctrl.moderate, { params: { type: 'posts', id: POST_ID }, body: { action: 'nuke' } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(code(res)).toBe('INVALID_ACTION');
    expect(audit).not.toHaveBeenCalled();
  });

  test('restore of an author-deleted post -> 409 NOT_RESTORABLE', async () => {
    db.on('community_posts', () => ({ data: mkPost({ status: 'deleted' }), error: null }));
    const res = await run(ctrl.moderate, { params: { type: 'posts', id: POST_ID }, body: { action: 'restore' } });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(code(res)).toBe('NOT_RESTORABLE');
    expect(callsOn('community_posts', 'update')).toHaveLength(0);
  });

  test('missing table -> 503', async () => {
    db.on('community_posts', () => ({ data: null, error: { code: '42P01', message: 'relation "community_posts" does not exist' } }));
    const res = await run(ctrl.moderate, { params: { type: 'posts', id: POST_ID }, body: { action: 'hide' } });
    expect(res.status).toHaveBeenCalledWith(503);
    expect(code(res)).toBe('COMMUNITY_UNAVAILABLE');
  });
});

describe('pin', () => {
  test('only visible posts', async () => {
    db.on('community_posts', () => ({ data: mkPost({ status: 'hidden' }), error: null }));
    const res = await run(ctrl.pin, { params: { id: POST_ID }, body: { pinned: true } });
    expect(res.status).toHaveBeenCalledWith(409);
  });
  test('pins and audits', async () => {
    db.on('community_posts', (ops) => ({ data: has(ops, 'update') ? { ...mkPost(), ...arg(ops, 'update') } : mkPost(), error: null }));
    await run(ctrl.pin, { params: { id: POST_ID }, body: { pinned: true, pinned_until: null } });
    expect(arg(callsOn('community_posts', 'update')[0].ops, 'update')).toMatchObject({ is_pinned: true, pinned_until: null });
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'community.pin' }));
  });
});

describe('members', () => {
  const upsertHandler = (ops) => ({ data: has(ops, 'upsert') ? { user_id: USER, ...arg(ops, 'upsert') } : null, error: null });
  test('badge official upserts', async () => {
    db.on('community_members', upsertHandler);
    const res = await run(ctrl.patchMember, { params: { userId: USER }, body: { badge: 'official' } });
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(arg(callsOn('community_members', 'upsert')[0].ops, 'upsert')).toMatchObject({ user_id: USER, badge: 'official' });
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'community.member' }));
  });
  test('badge king -> 400 INVALID_FIELD', async () => {
    db.on('community_members', upsertHandler);
    const res = await run(ctrl.patchMember, { params: { userId: USER }, body: { badge: 'king' } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toMatchObject({ code: 'INVALID_FIELD', field: 'badge' });
  });
  test('past ban date and non-boolean flags -> 400', async () => {
    db.on('community_members', upsertHandler);
    let res = await run(ctrl.patchMember, { params: { userId: USER }, body: { banned_until: '2020-01-01T00:00:00Z' } });
    expect(res.json.mock.calls[0][0].field).toBe('banned_until');
    res = await run(ctrl.patchMember, { params: { userId: USER }, body: { early_access: 'yes' } });
    expect(res.json.mock.calls[0][0].field).toBe('early_access');
  });
  test('list has no phone/email and no username for guests', async () => {
    db.on('profiles', () => ({ data: [{ id: USER, name: 'N', first_name: 'Asha', username: 'asha', is_host: false }], error: null }));
    db.on('community_members', () => ({ data: [{ user_id: USER, badge: null, early_access: false, links_allowed: false, banned_until: null, post_count: 2, comment_count: 1 }], error: null }));
    const res = await run(ctrl.listMembers, { query: { q: 'as%' } });
    const out = res.json.mock.calls[0][0].members[0];
    expect(out).toMatchObject({ user_id: USER, display_name: 'Asha', role: 'guest', post_count: 2 });
    expect(out.username).toBeUndefined();
    expect(JSON.stringify(db.calls)).not.toMatch(/phone|email/);
  });
});

describe('spaces', () => {
  test('invalid policy -> 400; valid patch updates', async () => {
    let res = await run(ctrl.patchSpace, { params: { key: 'general' }, body: { post_policy: 'nobody' } });
    expect(res.json.mock.calls[0][0]).toMatchObject({ code: 'INVALID_FIELD', field: 'post_policy' });
    db.on('community_spaces', (ops) => ({ data: has(ops, 'update') ? { key: 'general', ...arg(ops, 'update') } : { key: 'general', name: 'G' }, error: null }));
    res = await run(ctrl.patchSpace, { params: { key: 'general' }, body: { name: 'New', position: 3 } });
    expect(arg(callsOn('community_spaces', 'update')[0].ops, 'update')).toEqual({ name: 'New', position: 3 });
  });
});

describe('reports + content', () => {
  test('groups by target, defamation first, then count', async () => {
    const A = 'aaaaaaaa-1111-4111-8111-000000000001';
    const B = 'aaaaaaaa-1111-4111-8111-000000000002';
    const t = (n) => `2026-11-0${n}T10:00:00.000Z`;
    db.on('community_reports', () => ({ data: [
      { id: 'r1', target_type: 'post', target_id: A, reason: 'spam', created_at: t(1) },
      { id: 'r2', target_type: 'post', target_id: A, reason: 'spam', created_at: t(2) },
      { id: 'r3', target_type: 'post', target_id: A, reason: 'hate', created_at: t(3) },
      { id: 'r4', target_type: 'post', target_id: B, reason: 'defamation', created_at: t(1) },
      { id: 'r5', target_type: 'comment', target_id: COMMENT_ID, reason: 'spam', created_at: t(2) },
      { id: 'r6', target_type: 'comment', target_id: COMMENT_ID, reason: 'spam', created_at: t(3) },
    ], error: null }));
    db.on('community_posts', () => ({ data: [mkPost({ id: A, slug: 'a', body: 'x'.repeat(500) }), mkPost({ id: B, slug: 'b' }), mkPost({ id: 'p9', slug: 'c' })], error: null }));
    db.on('community_comments', () => ({ data: [{ id: COMMENT_ID, post_id: 'p9', author_id: USER, body: 'c', status: 'visible' }], error: null }));
    db.on('profiles', () => ({ data: [{ id: USER, is_host: false, first_name: 'Asha', name: 'Full Name' }], error: null }));
    db.on('community_members', () => ({ data: [], error: null }));
    const res = await run(ctrl.listReports, { query: { status: 'open' } });
    const g = res.json.mock.calls[0][0].groups;
    expect(g.map((x) => x.target_id)).toEqual([B, A, COMMENT_ID]);
    expect(g[1]).toMatchObject({ count: 3, reasons: { spam: 2, hate: 1 }, first_reported_at: t(1), latest_reported_at: t(3) });
    expect(g[1].preview.body.length).toBeLessThanOrEqual(200);
    expect(g[1].author).toMatchObject({ id: USER, display_name: 'Asha', role: 'guest' });
    expect(g[1].author.email).toBeUndefined();
  });

  test('content search escapes % and _ in q', async () => {
    db.on('community_posts', () => ({ data: [], error: null }));
    await run(ctrl.searchContent, { query: { q: '50%_off' } });
    const ops = callsOn('community_posts', 'or')[0].ops;
    expect(arg(ops, 'or')).toContain('50\\%\\_off');
  });
});

describe('ops summary', () => {
  test('attention includes open_community_reports (0 when table missing)', async () => {
    const { getSummary } = require('../../../controllers/opsAdminController');
    db.on('community_reports', () => ({ data: null, error: { message: 'relation does not exist' }, count: null }));
    const res = await run(getSummary);
    const row = res.json.mock.calls[0][0].attention.find((a) => a.key === 'open_community_reports');
    expect(row.count).toBe(0);
    expect(row.to).toBe('/admin/community');
  });
});
