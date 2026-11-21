'use strict';
// Collaborators data layer (store.js). Scripted supabase mock: db.on(table, fn)
// returns {data, error} for each awaited query; db.calls records payloads.
jest.mock('../../../config/supabase', () => {
  const db = { handlers: {}, calls: [] };
  db.on = (table, fn) => { db.handlers[table] = fn; };
  const chain = (table) => {
    const ops = [];
    const resolve = () => Promise.resolve((db.handlers[table] || (() => ({ data: null, error: null })))(ops));
    const c = { then: (ok, bad) => resolve().then(ok, bad), single: () => resolve(), maybeSingle: () => resolve() };
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'or', 'is', 'gt', 'order', 'limit', 'ilike']) {
      c[m] = (...args) => { ops.push([m, ...args]); return c; };
    }
    db.calls.push({ table, ops });
    return c;
  };
  return { supabaseAdmin: { from: jest.fn(chain), __db: db } };
});

const { supabaseAdmin } = require('../../../config/supabase');
const store = require('../../../services/community/store');
const db = supabaseAdmin.__db;
const has = (ops, m) => ops.some((o) => o[0] === m);
const arg = (ops, m) => (ops.find((o) => o[0] === m) || [])[1];

const POST = '11111111-1111-4111-8111-111111111111';
const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const B = 'bbbbbbbb-0000-4000-8000-00000000000b';

beforeEach(() => { jest.clearAllMocks(); db.calls.length = 0; db.handlers = {}; });

test('loadCollaboratorsByPost maps post_id -> ordered collaborator chips', async () => {
  db.on('community_post_collaborators', () => ({ data: [
    { post_id: POST, position: 1, profile: { id: B, name: 'Bea', username: 'bea', profile_image: 'b.png' } },
    { post_id: POST, position: 0, profile: { id: A, name: 'Ava', username: 'ava', profile_image: null } },
  ], error: null }));
  const map = await store.loadCollaboratorsByPost([POST]);
  const list = map.get(POST);
  expect(list.map((c) => c.id)).toEqual([A, B]); // position order
  expect(list[0]).toEqual({ id: A, display_name: 'Ava', avatar_url: null, profile_url: '/ava' });
});

test('loadCollaboratorsByPost returns empty map when the table is missing', async () => {
  db.on('community_post_collaborators', () => ({ data: null, error: { code: '42P01', message: 'relation "community_post_collaborators" does not exist' } }));
  const map = await store.loadCollaboratorsByPost([POST]);
  expect(map.size).toBe(0);
});

test('loadCollaboratorsByPost on empty input makes no query', async () => {
  const map = await store.loadCollaboratorsByPost([]);
  expect(map.size).toBe(0);
  expect(db.calls.filter((c) => c.table === 'community_post_collaborators')).toHaveLength(0);
});

test('insertCollaborators inserts a row per id with position', async () => {
  let inserted = null;
  db.on('community_post_collaborators', (ops) => { if (has(ops, 'insert')) inserted = arg(ops, 'insert'); return { data: inserted, error: null }; });
  await store.insertCollaborators(POST, [A, B]);
  expect(inserted).toEqual([
    { post_id: POST, profile_id: A, position: 0 },
    { post_id: POST, profile_id: B, position: 1 },
  ]);
});

test('insertCollaborators with no ids makes no query', async () => {
  await store.insertCollaborators(POST, []);
  expect(db.calls.filter((c) => c.table === 'community_post_collaborators')).toHaveLength(0);
});

test('listAuthorPosts includes posts where the member is a collaborator', async () => {
  db.on('community_post_collaborators', () => ({ data: [{ post_id: POST }], error: null }));
  let orArg;
  db.on('community_posts', (ops) => { orArg = (ops.find((o) => o[0] === 'or') || [])[1]; return { data: [{ id: POST }], error: null }; });
  const rows = await store.listAuthorPosts({ authorId: A, cur: null, limit: 20 });
  expect(rows).toEqual([{ id: POST }]);
  expect(orArg).toContain(`author_id.eq.${A}`);
  expect(orArg).toContain(`id.in.(${POST})`);
});

test('listAuthorPosts falls back to author-only when collaborators table is missing', async () => {
  db.on('community_post_collaborators', () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } }));
  let eqAuthor;
  db.on('community_posts', (ops) => { eqAuthor = (ops.find((o) => o[0] === 'eq' && o[1] === 'author_id') || [])[2]; return { data: [], error: null }; });
  await store.listAuthorPosts({ authorId: A, cur: null, limit: 20 });
  expect(eqAuthor).toBe(A);
});
