/**
 * templateSync — code copy reaches the DB, admin edits survive.
 * Supabase is an in-memory `email_templates` table.
 */
const mockDb = { rows: [], selectError: null };

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (table) => {
      if (table === 'notification_events') {
        return { upsert: () => Promise.resolve({ error: null }) };
      }
      return {
        select: () => ({
          eq: (_col, status) => Promise.resolve(mockDb.selectError
            ? { data: null, error: mockDb.selectError }
            : { data: mockDb.rows.filter((r) => r.status === status), error: null }),
        }),
        insert: (row) => { mockDb.rows.push({ id: `id-${mockDb.rows.length + 1}`, ...row }); return Promise.resolve({ error: null }); },
        update: (patch) => ({
          eq: (_col, id) => { Object.assign(mockDb.rows.find((r) => r.id === id), patch); return Promise.resolve({ error: null }); },
        }),
      };
    },
  },
}));
jest.mock('../../services/email/communicationEngine', () => ({ clearCache: jest.fn() }));

const { syncTemplates, templateHash, toRow } = require('../../services/email/templateSync');

const tpl = (over = {}) => ({
  event_key: 'WELCOME', audience: 'all', name: 'Welcome', category: 'Profile',
  subject: 'Hi', html_content: '<p>v1</p>', ...over,
});
const dbRow = (t, extra = {}) => ({ id: 'id-1', status: 'active', ...toRow(t), ...extra });

beforeEach(() => { mockDb.rows = []; mockDb.selectError = null; });

test('inserts a template missing from the DB, stamped with its hash', async () => {
  const r = await syncTemplates({ templates: [tpl()] });
  expect(r).toMatchObject({ inserted: 1, updated: 0 });
  expect(mockDb.rows[0]).toMatchObject({ event_key: 'WELCOME', status: 'active', seed_hash: templateHash(toRow(tpl())) });
});

test('updates a row nobody edited since the last sync', async () => {
  mockDb.rows = [dbRow(tpl(), { seed_hash: templateHash(toRow(tpl())) })];
  const r = await syncTemplates({ templates: [tpl({ html_content: '<p>v2</p>' })] });
  expect(r.updated).toBe(1);
  expect(mockDb.rows[0].html_content).toBe('<p>v2</p>');
  expect(mockDb.rows[0].seed_hash).toBe(templateHash(toRow(tpl({ html_content: '<p>v2</p>' }))));
});

test('keeps a row edited in the admin editor', async () => {
  const seeded = templateHash(toRow(tpl()));
  mockDb.rows = [dbRow(tpl({ subject: 'Admin wrote this' }), { seed_hash: seeded })];
  const r = await syncTemplates({ templates: [tpl({ html_content: '<p>v2</p>' })] });
  expect(r).toMatchObject({ updated: 0, kept: ['WELCOME/all'] });
  expect(mockDb.rows[0].subject).toBe('Admin wrote this');
});

test('force overwrites an admin edit', async () => {
  mockDb.rows = [dbRow(tpl({ subject: 'Admin wrote this' }), { seed_hash: 'old' })];
  const r = await syncTemplates({ templates: [tpl()], force: true });
  expect(r.updated).toBe(1);
  expect(mockDb.rows[0].subject).toBe('Hi');
});

test('untracked row: stamps it when it already matches, keeps it when it differs', async () => {
  mockDb.rows = [
    dbRow(tpl(), { seed_hash: null }),
    dbRow(tpl({ event_key: 'OTHER', subject: 'Different' }), { id: 'id-2', seed_hash: null }),
  ];
  const r = await syncTemplates({ templates: [tpl(), tpl({ event_key: 'OTHER' })] });
  expect(r).toMatchObject({ unchanged: 1, updated: 0, kept: ['OTHER/all'] });
  expect(mockDb.rows[0].seed_hash).toBe(templateHash(toRow(tpl())));
  expect(mockDb.rows[1].subject).toBe('Different');
});

test('null and empty-string fields hash the same (DB nulls are not edits)', () => {
  expect(templateHash({ ...toRow(tpl()), preview_text: null, sender_key: null }))
    .toBe(templateHash({ ...toRow(tpl()), preview_text: '', sender_key: '' }));
});

test('skips everything when the seed_hash column is missing (pre-v3.187)', async () => {
  mockDb.selectError = { message: 'column email_templates.seed_hash does not exist' };
  const r = await syncTemplates({ templates: [tpl()] });
  expect(r.skipped).toMatch(/v3\.187/);
  expect(mockDb.rows).toHaveLength(0);
});
