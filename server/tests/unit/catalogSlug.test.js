// resolveCatalogItem: slug → id → legacy_slugs, with the pre-v3.229 schema
// fallback (no legacy_slugs column = "not found", never an error to the page).
jest.mock('../../config/supabase', () => {
  const calls = [];
  const replies = [];
  const make = () => {
    const q = { filters: [] };
    ['select', 'limit'].forEach((k) => { q[k] = jest.fn(() => q); });
    q.eq = jest.fn((c, v) => { q.filters.push(['eq', c, v]); return q; });
    q.contains = jest.fn((c, v) => { q.filters.push(['contains', c, v]); return q; });
    q.maybeSingle = jest.fn(async () => replies.shift());
    q.then = (res, rej) => Promise.resolve(replies.shift()).then(res, rej);
    calls.push(q);
    return q;
  };
  return { supabaseAdmin: { from: jest.fn(make) }, __calls: calls, __replies: replies };
});

const { __calls: calls, __replies: replies } = require('../../config/supabase');
const { resolveCatalogItem } = require('../../services/catalogSlug');

const UUID = '3f2b8c1e-9d4a-4e6b-8f1a-2c3d4e5f6a7b';
const ROW = { id: UUID, slug: 'brand-kit' };
const has = (q, kind, col) => q.filters.some(([k, c]) => k === kind && c === col);

beforeEach(() => { calls.length = 0; replies.length = 0; });

test('current slug wins in one query', async () => {
  replies.push({ data: ROW, error: null });
  expect(await resolveCatalogItem('products', 'h1', 'brand-kit', 'id, slug')).toEqual({ data: ROW, error: null });
  expect(calls).toHaveLength(1);
  expect(has(calls[0], 'eq', 'slug')).toBe(true);
  expect(has(calls[0], 'eq', 'is_active')).toBe(true);
});

test('a UUID key falls back to the id', async () => {
  replies.push({ data: null, error: null }, { data: ROW, error: null });
  expect((await resolveCatalogItem('products', 'h1', UUID, 'id, slug')).data).toBe(ROW);
  expect(has(calls[1], 'eq', 'id')).toBe(true);
});

test('an old slug resolves through legacy_slugs', async () => {
  replies.push({ data: null, error: null }, { data: [ROW], error: null });
  expect((await resolveCatalogItem('courses', 'h1', 'demo-brand-kit', 'id, slug')).data).toBe(ROW);
  expect(calls[1].contains).toHaveBeenCalledWith('legacy_slugs', ['demo-brand-kit']);
});

test('pre-migration (no legacy_slugs column) → not found, no error', async () => {
  replies.push({ data: null, error: null }, { data: null, error: { message: 'column products.legacy_slugs does not exist' } });
  expect(await resolveCatalogItem('products', 'h1', 'demo-x', 'id')).toEqual({ data: null, error: null });
});

test('a key that is not a plain slug never reaches the array filter', async () => {
  replies.push({ data: null, error: null });
  expect(await resolveCatalogItem('products', 'h1', 'a,b}', 'id')).toEqual({ data: null, error: null });
  expect(calls).toHaveLength(1);
});
