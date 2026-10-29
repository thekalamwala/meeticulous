/**
 * tests/unit/productController.test.js
 * Tests createProduct/updateProduct persisting the v2.9 link fields
 * (product_url, file_name, file_size_bytes) with schema-fallback.
 */
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const { supabaseAdmin } = require('../../config/supabase');
const { createProduct, updateProduct } = require('../../controllers/productController');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};
const req = (body, params = {}, user = { id: 'host-1' }) => ({ body, params, user });

const SCHEMA_ERR = { message: "Could not find the 'product_url' column of 'products' in the schema cache" };

beforeEach(() => jest.clearAllMocks());

describe('createProduct — v2.9 link fields', () => {
  test('inserts product_url/file_name/file_size_bytes when columns exist', async () => {
    let inserted;
    supabaseAdmin.from.mockReturnValue({
      // uniqueHostSlug() looks up the host's existing slugs first.
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          like: jest.fn().mockResolvedValue({ data: [] }),
        }),
      }),
      insert: jest.fn().mockImplementation((p) => {
        inserted = p;
        return {
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: 'p1', ...p }, error: null }),
        };
      }),
    });
    const r = res();
    await createProduct(
      req({
        title: 'Guide', price: 0,
        product_url: 'https://store.example/guide',
        file_url: 'https://cdn/x.pdf', file_name: 'guide.pdf', file_size_bytes: 12345,
      }),
      r,
    );
    expect(r.status).toHaveBeenCalledWith(201);
    expect(inserted.product_url).toBe('https://store.example/guide');
    expect(inserted.file_name).toBe('guide.pdf');
    expect(inserted.file_size_bytes).toBe(12345);
    // Ownership: insert payload must carry host_id = req.user.id
    expect(inserted.host_id).toBe('host-1');
  });

  test('falls back (drops new fields) and still creates when columns missing', async () => {
    const calls = [];
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          like: jest.fn().mockResolvedValue({ data: [] }),
        }),
      }),
      insert: jest.fn().mockImplementation((p) => {
        calls.push(p);
        const first = calls.length === 1;
        return {
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(
            first
              ? { data: null, error: SCHEMA_ERR }
              : { data: { id: 'p1', ...p }, error: null },
          ),
        };
      }),
    });
    const r = res();
    await createProduct(
      req({
        title: 'Guide', price: 0,
        product_url: 'https://store.example/guide',
        file_name: 'guide.pdf', file_size_bytes: 12345,
      }),
      r,
    );
    expect(r.status).toHaveBeenCalledWith(201);
    // First insert had the new fields; the retry dropped them.
    expect(calls[0]).toHaveProperty('product_url');
    expect(calls[1]).not.toHaveProperty('product_url');
    expect(calls[1]).not.toHaveProperty('file_name');
    expect(calls[1]).not.toHaveProperty('file_size_bytes');
    expect(calls[1].title).toBe('Guide');
  });
});

describe('updateProduct — v2.9 link fields', () => {
  test('updates product_url/file_name/file_size_bytes when columns exist', async () => {
    let updated;
    supabaseAdmin.from.mockReturnValue({
      update: jest.fn().mockImplementation((p) => {
        updated = p;
        return {
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: 'p1', ...p }, error: null }),
        };
      }),
    });
    const r = res();
    await updateProduct(
      req(
        { product_url: 'https://store.example/v2', file_name: 'v2.pdf', file_size_bytes: 999 },
        { id: 'p1' },
      ),
      r,
    );
    expect(updated.product_url).toBe('https://store.example/v2');
    expect(updated.file_name).toBe('v2.pdf');
    expect(updated.file_size_bytes).toBe(999);
  });

  test('enforces host_id ownership scope on update', async () => {
    // Capture every argument pair passed to .eq() on the update chain so we can
    // assert that BOTH .eq('id', productId) and .eq('host_id', userId) are applied.
    const eqCalls = [];
    const eqMock = jest.fn().mockImplementation((col, val) => {
      eqCalls.push([col, val]);
      return chainObj; // eslint-disable-line no-use-before-define
    });
    const chainObj = {
      eq: eqMock,
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'p1', title: 'X' }, error: null }),
    };
    supabaseAdmin.from.mockReturnValue({
      update: jest.fn().mockReturnValue(chainObj),
    });

    const r = res();
    await updateProduct(req({ title: 'X' }, { id: 'p1' }, { id: 'vendor-42' }), r);

    // Must have called .eq('id', 'p1') and .eq('host_id', 'vendor-42')
    expect(eqCalls).toContainEqual(['id', 'p1']);
    expect(eqCalls).toContainEqual(['host_id', 'vendor-42']);
    expect(r.json).toHaveBeenCalled();
  });

  test('falls back (drops new fields) and still updates when columns missing', async () => {
    const calls = [];
    supabaseAdmin.from.mockReturnValue({
      update: jest.fn().mockImplementation((p) => {
        calls.push(p);
        const first = calls.length === 1;
        return {
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(
            first
              ? { data: null, error: SCHEMA_ERR }
              : { data: { id: 'p1', ...p }, error: null },
          ),
        };
      }),
    });
    const r = res();
    await updateProduct(
      req({ title: 'New', product_url: 'https://x', file_name: 'n.pdf', file_size_bytes: 7 }, { id: 'p1' }),
      r,
    );
    expect(calls[0]).toHaveProperty('product_url');
    expect(calls[1]).not.toHaveProperty('product_url');
    expect(calls[1]).not.toHaveProperty('file_name');
    expect(calls[1]).not.toHaveProperty('file_size_bytes');
    expect(calls[1].title).toBe('New');
  });
});
