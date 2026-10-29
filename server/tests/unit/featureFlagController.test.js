const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
jest.mock('../../services/featureFlags', () => ({ loadFlags: jest.fn(), clearCache: jest.fn() }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));
const featureFlags = require('../../services/featureFlags');
const { audit } = require('../../services/auditService');
const { getPublicFlags, toggleFlag } = require('../../controllers/featureFlagController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('getPublicFlags returns the loadFlags value map verbatim (client fails open per-key)', async () => {
  featureFlags.loadFlags.mockResolvedValue({ reschedule: false, reschedule_fee: true });
  const r = res();
  await getPublicFlags({}, r);
  expect(r.json).toHaveBeenCalledWith({ reschedule: false, reschedule_fee: true });
});

test('toggleFlag rejects non-boolean', async () => {
  const r = res();
  await toggleFlag({ params: { key: 'reschedule' }, body: { enabled: 'yes' } }, r);
  expect(r.status).toHaveBeenCalledWith(400);
});

test('toggleFlag updates + clears cache + audits the change (before/after)', async () => {
  mockFrom.mockImplementation(() => {
    const c = { update: jest.fn(() => c), eq: jest.fn(() => c), select: jest.fn(() => c),
      maybeSingle: jest.fn().mockResolvedValue({ data: { enabled: true }, error: null }), // prior value
      single: jest.fn().mockResolvedValue({ data: { key: 'reschedule', enabled: false }, error: null }) };
    return c;
  });
  const r = res();
  await toggleFlag({ params: { key: 'reschedule' }, body: { enabled: false }, admin: { id: 'a1' } }, r);
  expect(featureFlags.clearCache).toHaveBeenCalled();
  expect(r.json).toHaveBeenCalledWith({ key: 'reschedule', enabled: false });
  expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    action: 'feature_flag.toggle', resource_id: 'reschedule',
    before: { enabled: true }, after: { enabled: false },
  }));
});
