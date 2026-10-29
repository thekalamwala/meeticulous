const inserted = [];
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (t) => ({
      insert: (row) => ({ select: () => ({ single: () => { inserted.push(row); return Promise.resolve({ data: { id: 'L1', ...row }, error: null }); } }) }),
      select: () => ({ order: () => Promise.resolve({ data: [{ id: 'L1', name: 'Topmate' }], error: null }) }),
    }),
  },
}));
const svc = require('../../services/crm/listService');

test('createList inserts name + trims', async () => {
  const r = await svc.createList({ name: '  Insta Oct  ', source: 'instagram', createdBy: 'admin1' });
  expect(r.name).toBe('Insta Oct');
  expect(inserted[0].source).toBe('instagram');
});
test('createList rejects blank name', async () => {
  await expect(svc.createList({ name: '' })).rejects.toThrow(/name/i);
});
