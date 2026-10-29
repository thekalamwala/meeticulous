const { resolveAndValidateCategory } = require('../../lib/serviceCategory');

// Minimal supabase stub: .from(t).select().eq()... resolving preset data.
const makeStub = ({ primary, slugs }) => ({
  from: (table) => ({
    select: () => ({
      eq: (col, val) => {
        if (table === 'profiles') {
          return { single: async () => ({ data: { primary_category: primary } }) };
        }
        // service_categories: two chained .eq()
        return { eq: () => Promise.resolve({ data: slugs.map((s) => ({ slug: s })) }) };
      },
    }),
  }),
});

test('valid category returns value AND primary', async () => {
  const stub = makeStub({ primary: 'photographer', slugs: ['wedding-photography'] });
  const r = await resolveAndValidateCategory(stub, 'h1', 'wedding-photography');
  expect(r.ok).toBe(true);
  expect(r.value).toBe('wedding-photography');
  expect(r.primary).toBe('photographer');
});

test('empty category returns null value and null primary', async () => {
  const stub = makeStub({ primary: 'photographer', slugs: ['wedding-photography'] });
  const r = await resolveAndValidateCategory(stub, 'h1', '');
  expect(r.ok).toBe(true);
  expect(r.value).toBeNull();
  expect(r.primary).toBeNull();
});

test('profession with no categories returns null pair even when category sent', async () => {
  const stub = makeStub({ primary: 'obscure-prof', slugs: [] });
  const r = await resolveAndValidateCategory(stub, 'h1', 'anything');
  expect(r.ok).toBe(true);
  expect(r.value).toBeNull();
  expect(r.primary).toBeNull();
});

test('invalid category still rejects', async () => {
  const stub = makeStub({ primary: 'photographer', slugs: ['wedding-photography'] });
  const r = await resolveAndValidateCategory(stub, 'h1', 'seo-audit');
  expect(r.ok).toBe(false);
  expect(r.status).toBe(400);
});
