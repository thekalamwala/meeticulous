// syncRegistry seeds opt-in flags OFF on first insert. host_linkedin_login must
// land disabled even if the server boots before its v3.188 migration is applied.
const inserted = [];
const mockFrom = jest.fn(() => ({
  select: () => Promise.resolve({ data: [], error: null }),
  insert: (rows) => { inserted.push(...rows); return Promise.resolve({ error: null }); },
  update: () => ({ eq: () => Promise.resolve({ error: null }) }),
}));
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));

const { syncRegistry } = require('../../controllers/featureFlagController');

test('syncRegistry seeds host_linkedin_login disabled on an empty table', async () => {
  await syncRegistry();
  const row = inserted.find((r) => r.key === 'host_linkedin_login');
  expect(row).toBeDefined();
  expect(row.enabled).toBe(false);
  // a normal kill-switch still seeds ON
  expect(inserted.find((r) => r.key === 'cover_photo').enabled).toBe(true);
});
